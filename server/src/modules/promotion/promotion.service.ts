import { prisma } from '@/config/prisma.js';
import { SubjectService } from '@/modules/result/subject/subject.service.js';
import { MarksService } from '@/modules/marks/marks.service.js';
import { ExamService } from '@/modules/exam/exam.service.js';
import { yearEndExamIdForClass } from '@/modules/exam/exam-year-end.js';
import logger from '@/utils/logger.js';

type StudentWithMerit = Awaited<
  ReturnType<typeof PromotionService.fetchStudentsForPromotion>
>[0] & {
  total_marks?: number;
  gpa?: number;
  sort_value?: number;
  final_merit?: number;
  new_class?: number;
  new_section?: string;
  new_roll?: number;
};

export class PromotionService {
  static async updatePassFailStatus(year: number) {
    const students = await prisma.student_enrollments.findMany({
      where: { year },
      include: {
        student: true,
        marks: {
          include: {
            subject: {
              include: { parent: true },
            },
          },
        },
      },
    });

    if (!students.length) {
      return { updated: 0 };
    }

    const classBonusStatus: Record<number, boolean> = {};
    const classes = [...new Set(students.map((s) => s.class))];
    const yearEndExams = await ExamService.assertYearEndCoverage(year, classes);

    for (const c of classes) {
      classBonusStatus[c] = await MarksService.shouldApplyFourthSubjectBonus(c, year);
    }

    for (const student of students) {
      const yearEndExamId = yearEndExamIdForClass(yearEndExams, student.class);
      const yearEndMarks = student.marks.filter((mark) => mark.exam_id === yearEndExamId);
      const processedMarks = MarksService.aggregatePaperMarks(yearEndMarks);
      const { isFailed } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        classBonusStatus[student.class],
        student.class,
      );

      await prisma.student_enrollments.update({
        where: { id: student.id },
        data: { status: isFailed ? 'Failed' : 'Passed' },
      });
    }

    return { updated: students.length };
  }

  static async fetchStudentsForPromotion(year: number) {
    return prisma.student_enrollments.findMany({
      where: {
        year,
        class: { in: [6, 7, 8, 9] },
        student: { available: true },
      },
      include: {
        student: true,
        marks: {
          include: {
            subject: {
              include: { parent: true },
            },
          },
        },
      },
      orderBy: [{ class: 'asc' }, { group: 'asc' }],
    });
  }

  static async promoteStudents(year: number) {
    const newYear = year + 1;
    const students = await PromotionService.fetchStudentsForPromotion(year);

    const subjectsExistInNewYear = await prisma.subjects.count({
      where: { year: newYear },
    });

    let subjectMapping: Record<number, number> = {};

    if (subjectsExistInNewYear === 0) {
      const cloningResult = await SubjectService.cloneSubjects(year, newYear);
      if (cloningResult.success && cloningResult.mapping) {
        subjectMapping = cloningResult.mapping;
      }
    } else {
      const currentSubjects = await prisma.subjects.findMany({ where: { year } });
      const nextSubjects = await prisma.subjects.findMany({ where: { year: newYear } });

      currentSubjects.forEach((oldSub) => {
        const matchingNewSub = nextSubjects.find(
          (newSub) =>
            newSub.name === oldSub.name &&
            newSub.class === oldSub.class &&
            newSub.group === oldSub.group,
        );
        if (matchingNewSub) {
          subjectMapping[oldSub.id] = matchingNewSub.id;
        }
      });
    }

    const classBonusStatus: Record<string, boolean> = {};
    const classYears = new Set(students.map((s) => `${s.class}-${s.year}`));
    const yearEndExams = students.length
      ? await ExamService.assertYearEndCoverage(year, [...new Set(students.map((s) => s.class))])
      : [];

    for (const cy of classYears) {
      const [c, y] = cy.split('-');
      classBonusStatus[cy] = await MarksService.shouldApplyFourthSubjectBonus(
        parseInt(c, 10),
        parseInt(y, 10),
      );
    }

    const studentsWithMerit: StudentWithMerit[] = students.map((student) => {
      const applyBonus = classBonusStatus[`${student.class}-${student.year}`];
      const yearEndExamId = yearEndExamIdForClass(yearEndExams, student.class);
      const yearEndMarks = student.marks.filter((mark) => mark.exam_id === yearEndExamId);
      const processedMarks = MarksService.aggregatePaperMarks(yearEndMarks);
      const { gpa, totalMarks } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        applyBonus,
        student.class,
      );

      return {
        ...student,
        total_marks: totalMarks,
        gpa,
        sort_value: gpa,
      };
    });

    const groupedStudents: Record<string, StudentWithMerit[]> = {};

    studentsWithMerit.forEach((student) => {
      const key = `${student.class}-${student.group}`;
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(student);
    });

    const sortByMerit = (a: StudentWithMerit, b: StudentWithMerit) => {
      if ((b.sort_value ?? 0) !== (a.sort_value ?? 0)) {
        return (b.sort_value ?? 0) - (a.sort_value ?? 0);
      }
      if ((b.total_marks ?? 0) !== (a.total_marks ?? 0)) {
        return (b.total_marks ?? 0) - (a.total_marks ?? 0);
      }
      if (a.section !== b.section) {
        return a.section === 'A' ? -1 : 1;
      }
      return a.roll - b.roll;
    };

    Object.keys(groupedStudents).forEach((key) => {
      const group = groupedStudents[key];
      const passedStudents = group.filter((s) => s.status === 'Passed').sort(sortByMerit);
      const failedStudents = group.filter((s) => s.status === 'Failed').sort(sortByMerit);
      const sortedGroup = [...passedStudents, ...failedStudents];

      for (let i = 0; i < sortedGroup.length; i++) {
        sortedGroup[i].final_merit = i + 1;
      }

      groupedStudents[key] = sortedGroup;
    });

    for (const student of studentsWithMerit) {
      if (student.class !== 127) {
        await prisma.student_enrollments.update({
          where: { id: student.id },
          data: { final_merit: student.final_merit },
        });
      }
    }

    await prisma.student_enrollments.deleteMany({ where: { year: newYear } });

    const rollCounters: Record<string, { A: number; B: number }> = {};

    Object.keys(groupedStudents).forEach((key) => {
      const [currentClass, groupName] = key.split('-');
      const classNum = parseInt(currentClass, 10);
      const group = groupedStudents[key];

      group.forEach((student) => {
        if (student.status === 'Passed') {
          student.new_class = classNum === 8 ? 9 : classNum + 1;
        } else {
          student.new_class = classNum;
        }
      });

      const newClassGroups: Record<string, StudentWithMerit[]> = {};

      group.forEach((student) => {
        const newClassKey =
          classNum === 9 && student.new_class === 10
            ? `${student.new_class}-${groupName}`
            : `${student.new_class}`;

        if (!newClassGroups[newClassKey]) {
          newClassGroups[newClassKey] = [];
        }
        newClassGroups[newClassKey].push(student);
      });

      Object.keys(newClassGroups).forEach((newClassKey) => {
        if (!rollCounters[newClassKey]) {
          rollCounters[newClassKey] = { A: 1, B: 1 };
        }

        const newClassGroup = newClassGroups[newClassKey];
        newClassGroup.sort((a, b) => (a.final_merit ?? 0) - (b.final_merit ?? 0));

        newClassGroup.forEach((student) => {
          const isOddMerit = (student.final_merit ?? 0) % 2 === 1;
          const newSection = isOddMerit ? 'A' : 'B';
          const rollNumber = rollCounters[newClassKey][newSection]++;

          student.new_section = newSection;
          student.new_roll = rollNumber;
        });
      });
    });

    for (const student of studentsWithMerit) {
      const { id: enrollment_id, student_id, group, new_class, new_section, new_roll } = student;

      if (!new_class || !new_section || !new_roll) {
        logger.error(`Missing required fields for student ${student_id}`, {
          new_class,
          new_section,
          new_roll,
        });
        continue;
      }

      try {
        await prisma.student_enrollments.update({
          where: { id: enrollment_id },
          data: {
            next_year_section: new_section,
            next_year_roll: new_roll,
          },
        });
      } catch (error) {
        logger.error('Error assigning roll number', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const oldFourthSubjectId = student.fourth_subject_id;
      const newFourthSubjectId = oldFourthSubjectId
        ? subjectMapping[oldFourthSubjectId] || null
        : null;

      await prisma.student_enrollments.create({
        data: {
          student_id,
          class: new_class,
          roll: new_roll,
          section: new_section,
          year: newYear,
          status: 'Pending',
          group,
          fourth_subject_id: newFourthSubjectId,
        },
      });
    }

    return { promoted: studentsWithMerit.length, newYear };
  }

  static async updateEnrollmentStatus(id: number, status: string) {
    return prisma.student_enrollments.update({
      where: { id },
      data: { status },
    });
  }
}
