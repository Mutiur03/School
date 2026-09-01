import { prisma } from '@/config/prisma.js';
import { SubjectService } from '@/modules/result/subject/subject.service.js';
import { MarksService } from '@/modules/marks/marks.service.js';
import { ExamService } from '@/modules/exam/exam.service.js';
import { yearEndExamIdForClass } from '@/modules/exam/exam-year-end.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { ApiError } from '@/utils/ApiError.js';
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

export type PromotionPreviewRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  new_class: number;
  new_section: string;
  new_roll: number;
};

export type PromotionPreview = {
  year: number;
  newYear: number;
  students: PromotionPreviewRow[];
  summary: {
    total: number;
    passed_promoted: number;
    failed_retained: number;
    section_a: number;
    section_b: number;
    existing_next_year_enrollments: number;
    subjects_will_clone: boolean;
  };
};

type PromotionPlan = {
  newYear: number;
  studentsWithMerit: StudentWithMerit[];
  subjectsExistInNewYear: number;
  existingNextYearCount: number;
};

export const PROMOTION_PASS_CLASSES = [6, 7, 8, 9, 10] as const;

export type PromotionPassRule = {
  class: number;
  max_failed: number;
};

export class PromotionService {
  static defaultPassRules(): PromotionPassRule[] {
    return PROMOTION_PASS_CLASSES.map((cls) => ({ class: cls, max_failed: 0 }));
  }

  static async getPassRules(year: number): Promise<PromotionPassRule[]> {
    const rows = await prisma.promotion_pass_rules.findMany({
      where: { year },
      select: { class: true, max_failed: true },
    });
    const byClass = new Map(
      rows.map((r: { class: number; max_failed: number }) => [r.class, r.max_failed]),
    );
    return PROMOTION_PASS_CLASSES.map((cls) => ({
      class: cls,
      max_failed: Number(byClass.get(cls) ?? 0),
    }));
  }

  static async savePassRules(year: number, rules: PromotionPassRule[]) {
    const normalized = new Map<number, number>();
    for (const rule of rules) {
      const cls = Number(rule.class);
      const maxFailed = Number(rule.max_failed);
      if (!PROMOTION_PASS_CLASSES.includes(cls as (typeof PROMOTION_PASS_CLASSES)[number])) {
        continue;
      }
      if (!Number.isFinite(maxFailed) || maxFailed < 0 || maxFailed > 15) {
        throw new ApiError(400, `Invalid allowed fail count for class ${cls}`);
      }
      normalized.set(cls, Math.floor(maxFailed));
    }

    const schoolId = requireSchoolId();
    await prisma.$transaction(
      PROMOTION_PASS_CLASSES.map((cls) =>
        prisma.promotion_pass_rules.upsert({
          where: {
            school_id_year_class: { school_id: schoolId, year, class: cls },
          },
          create: {
            school_id: schoolId,
            year,
            class: cls,
            max_failed: normalized.get(cls) ?? 0,
          },
          update: { max_failed: normalized.get(cls) ?? 0 },
        }),
      ),
    );

    return this.getPassRules(year);
  }

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
      return { updated: 0, passed: 0, failed: 0 };
    }

    const classBonusStatus: Record<number, boolean> = {};
    const classes = [...new Set(students.map((s) => s.class))];
    const yearEndExams = await ExamService.assertYearEndCoverage(year, classes);

    for (const c of classes) {
      classBonusStatus[c] = await MarksService.shouldApplyFourthSubjectBonus(c, year);
    }

    const passRules = await this.getPassRules(year);
    const maxFailedByClass = Object.fromEntries(
      passRules.map((r) => [r.class, r.max_failed]),
    ) as Record<number, number>;

    let passed = 0;
    let failed = 0;

    for (const student of students) {
      const yearEndExamId = yearEndExamIdForClass(yearEndExams, student.class);
      const yearEndMarks = student.marks.filter((mark) => mark.exam_id === yearEndExamId);
      const processedMarks = MarksService.aggregatePaperMarks(yearEndMarks);
      const maxAllowedFails = maxFailedByClass[student.class] ?? 0;
      const { isFailed, failedSubjectCount } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        classBonusStatus[student.class],
        student.class,
        maxAllowedFails,
      );

      await prisma.student_enrollments.update({
        where: { id: student.id },
        data: {
          status: isFailed ? 'Failed' : 'Passed',
          fail_count: failedSubjectCount,
        },
      });
      if (isFailed) failed += 1;
      else passed += 1;
    }

    return { updated: students.length, passed, failed };
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

  static async computePromotionPlan(year: number): Promise<PromotionPlan> {
    const newYear = year + 1;
    const students = await PromotionService.fetchStudentsForPromotion(year);

    const [subjectsExistInNewYear, existingNextYearCount] = await Promise.all([
      prisma.subjects.count({ where: { year: newYear } }),
      prisma.student_enrollments.count({ where: { year: newYear } }),
    ]);

    if (!students.length) {
      return {
        newYear,
        studentsWithMerit: [],
        subjectsExistInNewYear,
        existingNextYearCount,
      };
    }

    const classBonusStatus: Record<string, boolean> = {};
    const classYears = new Set(students.map((s) => `${s.class}-${s.year}`));
    const yearEndExams = await ExamService.assertYearEndCoverage(year, [
      ...new Set(students.map((s) => s.class)),
    ]);

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

    return {
      newYear,
      studentsWithMerit,
      subjectsExistInNewYear,
      existingNextYearCount,
    };
  }

  static async previewPromotion(year: number): Promise<PromotionPreview> {
    const plan = await PromotionService.computePromotionPlan(year);
    const students = plan.studentsWithMerit
      .filter(
        (s) => s.new_class != null && s.new_section != null && s.new_roll != null && s.final_merit,
      )
      .map((s) => ({
        enrollment_id: s.id,
        student_id: s.student_id,
        name: s.student.name,
        class: s.class,
        section: s.section,
        roll: s.roll,
        group: s.group,
        status: s.status,
        gpa: s.gpa ?? 0,
        final_merit: s.final_merit ?? 0,
        new_class: s.new_class!,
        new_section: s.new_section!,
        new_roll: s.new_roll!,
      }))
      .sort(
        (a, b) =>
          a.class - b.class ||
          (a.group || '').localeCompare(b.group || '') ||
          a.final_merit - b.final_merit,
      );

    return {
      year,
      newYear: plan.newYear,
      students,
      summary: {
        total: students.length,
        passed_promoted: students.filter((s) => s.status === 'Passed').length,
        failed_retained: students.filter((s) => s.status === 'Failed').length,
        section_a: students.filter((s) => s.new_section === 'A').length,
        section_b: students.filter((s) => s.new_section === 'B').length,
        existing_next_year_enrollments: plan.existingNextYearCount,
        subjects_will_clone: plan.subjectsExistInNewYear === 0,
      },
    };
  }

  static async resolveSubjectMapping(
    year: number,
    newYear: number,
    subjectsExistInNewYear: number,
  ) {
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

    return subjectMapping;
  }

  static async promoteStudents(year: number) {
    const plan = await PromotionService.computePromotionPlan(year);
    const { newYear, studentsWithMerit, subjectsExistInNewYear } = plan;

    if (!studentsWithMerit.length) {
      return { promoted: 0, newYear };
    }

    const subjectMapping = await PromotionService.resolveSubjectMapping(
      year,
      newYear,
      subjectsExistInNewYear,
    );

    let promoted = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of studentsWithMerit) {
        if (student.class !== 127) {
          await tx.student_enrollments.update({
            where: { id: student.id },
            data: { final_merit: student.final_merit },
          });
        }
      }

      await tx.student_enrollments.deleteMany({ where: { year: newYear } });

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

        await tx.student_enrollments.update({
          where: { id: enrollment_id },
          data: {
            next_year_section: new_section,
            next_year_roll: new_roll,
          },
        });

        const oldFourthSubjectId = student.fourth_subject_id;
        const newFourthSubjectId = oldFourthSubjectId
          ? subjectMapping[oldFourthSubjectId] || null
          : null;

        await tx.student_enrollments.create({
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
        promoted += 1;
      }
    });

    return { promoted, newYear };
  }

  static async updateEnrollmentStatus(id: number, status: string) {
    return prisma.student_enrollments.update({
      where: { id },
      data: { status },
    });
  }

  static async getYearStats(year: number) {
    const newYear = year + 1;
    const promotionWhere = {
      year,
      class: { in: [6, 7, 8, 9] },
      student: { available: true },
    };
    const class10Where = {
      year,
      class: 10,
      student: { available: true },
    };

    const [promotionByStatus, class10ByStatus, meritCount, nextYearCount] = await Promise.all([
      prisma.student_enrollments.groupBy({
        by: ['status'],
        where: promotionWhere,
        _count: { _all: true },
      }),
      prisma.student_enrollments.groupBy({
        by: ['status'],
        where: class10Where,
        _count: { _all: true },
      }),
      prisma.student_enrollments.count({
        where: { ...promotionWhere, final_merit: { gt: 0 } },
      }),
      prisma.student_enrollments.count({ where: { year: newYear } }),
    ]);

    const tally = (rows: { status: string; _count: { _all: number } }[]) => {
      const counts = { passed: 0, failed: 0, pending: 0, graduated: 0, total: 0 };
      for (const row of rows) {
        counts.total += row._count._all;
        if (row.status === 'Passed') counts.passed += row._count._all;
        else if (row.status === 'Failed') counts.failed += row._count._all;
        else if (row.status === 'Pending') counts.pending += row._count._all;
        else if (row.status === 'Graduated') counts.graduated += row._count._all;
      }
      return counts;
    };

    return {
      year,
      newYear,
      promotion: tally(promotionByStatus),
      class10: tally(class10ByStatus),
      merit_assigned: meritCount > 0,
      next_year_enrollments: nextYearCount,
    };
  }

  /** SSC batch for class-10 students completing academic year `year`. */
  static sscBatchForYear(year: number) {
    return String(year + 1);
  }

  static async fetchStudentsForGraduation(year: number) {
    return prisma.student_enrollments.findMany({
      where: {
        year,
        class: 10,
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
      orderBy: [{ group: 'asc' }, { section: 'asc' }, { roll: 'asc' }],
    });
  }

  static async computeGraduationPlan(year: number) {
    const newYear = year + 1;
    const students = await PromotionService.fetchStudentsForGraduation(year);
    const sscBatch = PromotionService.sscBatchForYear(year);

    const existingClass10NextYear = await prisma.student_enrollments.count({
      where: { year: newYear, class: 10 },
    });

    if (!students.length) {
      return {
        year,
        newYear,
        sscBatch,
        rows: [] as GraduationPlanRow[],
        existingClass10NextYear,
      };
    }

    const applyBonus = await MarksService.shouldApplyFourthSubjectBonus(10, year);
    const yearEndExams = await ExamService.assertYearEndCoverage(year, [10]);
    const yearEndExamId = yearEndExamIdForClass(yearEndExams, 10);

    type GraduationStudent = (typeof students)[0] & {
      gpa?: number;
      total_marks?: number;
      sort_value?: number;
      final_merit?: number;
      new_section?: string;
      new_roll?: number;
    };

    const withMarks: GraduationStudent[] = students.map((student) => {
      const yearEndMarks = student.marks.filter((mark) => mark.exam_id === yearEndExamId);
      const processedMarks = MarksService.aggregatePaperMarks(yearEndMarks);
      const { gpa, totalMarks } = MarksService.calculateGPA(
        processedMarks,
        student.fourth_subject_id || null,
        applyBonus,
        10,
      );
      return { ...student, gpa, total_marks: totalMarks, sort_value: gpa };
    });

    const grouped: Record<string, GraduationStudent[]> = {};
    for (const student of withMarks) {
      const key = student.group || 'default';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(student);
    }

    const sortByMerit = (a: GraduationStudent, b: GraduationStudent) => {
      if ((b.sort_value ?? 0) !== (a.sort_value ?? 0)) {
        return (b.sort_value ?? 0) - (a.sort_value ?? 0);
      }
      if ((b.total_marks ?? 0) !== (a.total_marks ?? 0)) {
        return (b.total_marks ?? 0) - (a.total_marks ?? 0);
      }
      if (a.section !== b.section) return a.section === 'A' ? -1 : 1;
      return a.roll - b.roll;
    };

    for (const key of Object.keys(grouped)) {
      const group = grouped[key];
      const passed = group.filter((s) => s.status === 'Passed').sort(sortByMerit);
      const failed = group.filter((s) => s.status !== 'Passed').sort(sortByMerit);
      const sorted = [...passed, ...failed];
      for (let i = 0; i < sorted.length; i++) {
        sorted[i].final_merit = i + 1;
      }
      grouped[key] = sorted;
    }

    const rollCounters: Record<string, { A: number; B: number }> = {};

    for (const key of Object.keys(grouped)) {
      const failedInGroup = grouped[key].filter((s) => s.status !== 'Passed');
      const counterKey = `10-${key}`;
      if (!rollCounters[counterKey]) rollCounters[counterKey] = { A: 1, B: 1 };

      failedInGroup.sort((a, b) => (a.final_merit ?? 0) - (b.final_merit ?? 0));
      for (const student of failedInGroup) {
        const isOddMerit = (student.final_merit ?? 0) % 2 === 1;
        const newSection: 'A' | 'B' = isOddMerit ? 'A' : 'B';
        student.new_section = newSection;
        student.new_roll = rollCounters[counterKey][newSection]++;
      }
    }

    const rows: GraduationPlanRow[] = withMarks.map((s) => {
      const graduate = s.status === 'Passed';
      return {
        enrollment_id: s.id,
        student_id: s.student_id,
        name: s.student.name,
        section: s.section,
        roll: s.roll,
        group: s.group,
        status: s.status,
        gpa: s.gpa ?? 0,
        final_merit: s.final_merit ?? 0,
        action: graduate ? ('graduate' as const) : ('retain' as const),
        ssc_batch: graduate ? sscBatch : null,
        new_section: graduate ? null : (s.new_section ?? null),
        new_roll: graduate ? null : (s.new_roll ?? null),
        fourth_subject_id: s.fourth_subject_id,
      };
    });

    rows.sort(
      (a, b) => (a.group || '').localeCompare(b.group || '') || a.final_merit - b.final_merit,
    );

    return { year, newYear, sscBatch, rows, existingClass10NextYear };
  }

  static async previewGraduation(year: number): Promise<GraduationPreview> {
    const plan = await PromotionService.computeGraduationPlan(year);
    const graduates = plan.rows.filter((r) => r.action === 'graduate');
    const retained = plan.rows.filter((r) => r.action === 'retain');

    return {
      year: plan.year,
      newYear: plan.newYear,
      sscBatch: plan.sscBatch,
      students: plan.rows,
      summary: {
        total: plan.rows.length,
        graduates: graduates.length,
        retained: retained.length,
        existing_class10_next_year: plan.existingClass10NextYear,
      },
    };
  }

  static async graduateStudents(year: number) {
    const plan = await PromotionService.computeGraduationPlan(year);
    const { newYear, rows } = plan;

    if (!rows.length) {
      return { graduated: 0, retained: 0, newYear };
    }

    let graduated = 0;
    let retained = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (row.action === 'graduate') {
          await tx.student_enrollments.update({
            where: { id: row.enrollment_id },
            data: {
              final_merit: row.final_merit,
              status: 'Graduated',
              next_year_roll: 0,
              next_year_section: null,
            },
          });
        } else {
          await tx.student_enrollments.update({
            where: { id: row.enrollment_id },
            data: {
              final_merit: row.final_merit,
              next_year_section: row.new_section!,
              next_year_roll: row.new_roll!,
            },
          });
        }

        if (row.action === 'graduate') {
          await tx.students.update({
            where: { id: row.student_id },
            data: {
              batch: row.ssc_batch!,
              available: false,
            },
          });
          graduated += 1;
        } else {
          const existing = await tx.student_enrollments.findFirst({
            where: { student_id: row.student_id, year: newYear },
          });

          if (existing) {
            await tx.student_enrollments.update({
              where: { id: existing.id },
              data: {
                class: 10,
                roll: row.new_roll!,
                section: row.new_section!,
                group: row.group,
                status: 'Pending',
              },
            });
          } else {
            await tx.student_enrollments.create({
              data: {
                student_id: row.student_id,
                class: 10,
                roll: row.new_roll!,
                section: row.new_section!,
                year: newYear,
                status: 'Pending',
                group: row.group,
                fourth_subject_id: row.fourth_subject_id,
              },
            });
          }
          retained += 1;
        }
      }
    });

    return { graduated, retained, newYear, sscBatch: plan.sscBatch };
  }
}

export type GraduationPlanRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  action: 'graduate' | 'retain';
  ssc_batch: string | null;
  new_section: string | null;
  new_roll: number | null;
  fourth_subject_id: number | null;
};

export type GraduationPreview = {
  year: number;
  newYear: number;
  sscBatch: string;
  students: GraduationPlanRow[];
  summary: {
    total: number;
    graduates: number;
    retained: number;
    existing_class10_next_year: number;
  };
};
