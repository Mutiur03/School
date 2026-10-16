import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import logger from '@/utils/logger.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { AuthUser } from '../../common/current-user.decorator.js';
import { buildSessionTable } from '../promotion/v1/session-marksheet.pdf.js';
import { canAccessStudent } from '../marksheets/access.js';
import { MarksheetCacheService } from '../marksheets/cache/marksheet-cache.service.js';
import { MarksheetRenderer } from '../marksheets/pdf/marksheet-renderer.js';
import type { SaveMarksDto } from './dto/save-marks.dto.js';
import type { BulkUpdateFourthSubjectDto } from './dto/fourth-subject.dto.js';

type MarkValues = {
  cq_marks: number | null;
  mcq_marks: number | null;
  practical_marks: number | null;
  marks: number | null;
};
type MarkRow = MarkValues & { enrollment_id: number; subject_id: number };

const markChanged = (existing: MarkValues | undefined, next: MarkValues) =>
  !existing ||
  existing.cq_marks !== next.cq_marks ||
  existing.mcq_marks !== next.mcq_marks ||
  existing.practical_marks !== next.practical_marks ||
  existing.marks !== next.marks;

const markSnapshot = (row: MarkValues | undefined) => {
  if (!row) return null;
  const hasBreakdown = row.cq_marks != null || row.mcq_marks != null || row.practical_marks != null;
  return hasBreakdown
    ? { total: row.marks, cq: row.cq_marks, mcq: row.mcq_marks, practical: row.practical_marks }
    : { total: row.marks };
};

/** Teacher's assigned sections for a class/year; throws when they have none. */
const teacherSections = (user: AuthUser, cls: number, year: number): string[] => {
  const sections = (user.levels ?? [])
    .filter((l: any) => l.class_name === cls && l.year === year)
    .map((l: any) => l.section as string);
  if (sections.length === 0) throw new ForbiddenException('You are not assigned to this class.');
  return sections;
};

const warn = (what: string) => (err: unknown) =>
  logger.warn(`Marksheet invalidation failed after ${what}`, {
    error: err instanceof Error ? err.message : String(err),
  });

@Injectable()
export class MarksService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly marksheets: MarksheetCacheService,
    private readonly renderer: MarksheetRenderer,
  ) {}

  /** Bulk upsert of one exam's marks; only changed rows are written. */
  async saveMarks(schoolId: number, dto: SaveMarksDto, user: AuthUser) {
    const { students, examName, year } = dto;
    const exam = await this.prisma.exams.findFirst({
      where: { school_id: schoolId, exam_name: examName, exam_year: year },
    });
    if (!exam) throw new NotFoundException(`Exam "${examName}" not found for year ${year}`);

    const errors: string[] = [];
    const studentIds = students.map((s) => s.studentId);
    const subjectIds = [
      ...new Set(students.flatMap((s) => s.subjectMarks.map((m) => m.subjectId))),
    ];

    const [enrollments, subjects] = await Promise.all([
      this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, student_id: { in: studentIds }, year },
      }),
      this.prisma.subjects.findMany({ where: { school_id: schoolId, id: { in: subjectIds } } }),
    ]);
    const enrollmentByStudent = new Map(enrollments.map((e) => [e.student_id, e]));
    const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

    // Deduped by (enrollment, subject) so the single upsert never touches the same row twice.
    const rowsByKey = new Map<string, MarkRow>();
    for (const student of students) {
      const enrollment = enrollmentByStudent.get(student.studentId);
      if (!enrollment) {
        errors.push(`Student ${student.studentId} not enrolled in ${year}`);
        continue;
      }
      if (!canAccessStudent(user, student.studentId, enrollment.class, enrollment.section, year)) {
        errors.push(
          `Teacher ${user.id} not authorized for Class ${enrollment.class} Section ${enrollment.section}`,
        );
        continue;
      }
      for (const mark of student.subjectMarks) {
        const subject = subjectById.get(mark.subjectId);
        if (!subject) {
          errors.push(`Subject ${mark.subjectId} not found`);
          continue;
        }
        const cq_marks = mark.cq_marks ?? null;
        const mcq_marks = mark.mcq_marks ?? null;
        const practical_marks = mark.practical_marks ?? null;
        // BREAKDOWN subjects: total = cq + mcq + practical (null when all parts are empty).
        const marks =
          subject.marking_scheme === 'BREAKDOWN'
            ? cq_marks === null && mcq_marks === null && practical_marks === null
              ? null
              : (cq_marks ?? 0) + (mcq_marks ?? 0) + (practical_marks ?? 0)
            : (mark.marks ?? null);
        rowsByKey.set(`${enrollment.id}_${mark.subjectId}`, {
          enrollment_id: enrollment.id,
          subject_id: mark.subjectId,
          cq_marks,
          mcq_marks,
          practical_marks,
          marks,
        });
      }
    }

    const rows = [...rowsByKey.values()];
    // Only touch rows whose values changed so updated_at (and marksheet input_hash) stay put.
    const existingByKey = new Map<string, MarkRow>();
    if (rows.length > 0) {
      const existing = await this.prisma.marks.findMany({
        where: {
          school_id: schoolId,
          exam_id: exam.id,
          enrollment_id: { in: [...new Set(rows.map((r) => r.enrollment_id))] },
          subject_id: { in: [...new Set(rows.map((r) => r.subject_id))] },
        },
        select: {
          enrollment_id: true,
          subject_id: true,
          cq_marks: true,
          mcq_marks: true,
          practical_marks: true,
          marks: true,
        },
      });
      for (const m of existing) existingByKey.set(`${m.enrollment_id}_${m.subject_id}`, m);
    }
    const changedRows = rows.filter((r) =>
      markChanged(existingByKey.get(`${r.enrollment_id}_${r.subject_id}`), r),
    );

    if (changedRows.length > 0) {
      // Raw SQL bypasses the RLS extension, so it runs inside rlsTransaction (GUCs set on the connection).
      const values = changedRows.map(
        (r) =>
          Prisma.sql`(${schoolId}, ${r.enrollment_id}, ${r.subject_id}, ${exam.id}, ${r.cq_marks}, ${r.mcq_marks}, ${r.practical_marks}, ${r.marks})`,
      );
      const classesWithStatsChange: number[] = [];
      await rlsTransaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO marks (school_id, enrollment_id, subject_id, exam_id, cq_marks, mcq_marks, practical_marks, marks)
          VALUES ${Prisma.join(values)}
          ON CONFLICT (enrollment_id, subject_id, exam_id)
          DO UPDATE SET
            cq_marks = EXCLUDED.cq_marks,
            mcq_marks = EXCLUDED.mcq_marks,
            practical_marks = EXCLUDED.practical_marks,
            marks = EXCLUDED.marks,
            updated_at = NOW()
        `;
        const classes = new Set(changedRows.map((r) => enrollmentById.get(r.enrollment_id)!.class));
        for (const cls of classes) {
          if (await this.renderer.recomputeExamClassStats(tx, schoolId, exam.id, cls, year)) {
            classesWithStatsChange.push(cls);
          }
        }
      });

      // Open-exam caches regenerate on edits whether published or not (freeze is result_date only).
      const changedStudentIds = [
        ...new Set(changedRows.map((r) => enrollmentById.get(r.enrollment_id)!.student_id)),
      ];
      await (
        classesWithStatsChange.length > 0
          ? this.marksheets.invalidateClasses(schoolId, exam.id, classesWithStatsChange, year)
          : this.marksheets.invalidate(schoolId, changedStudentIds, exam.id)
      ).catch(warn('saveMarks'));

      await this.logMarksSave(
        schoolId,
        user,
        exam,
        year,
        changedRows,
        existingByKey,
        enrollmentById,
        subjectById,
        errors,
      ).catch((err) =>
        logger.warn('[marks] audit log failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return {
      success: true,
      count: changedRows.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async logMarksSave(
    schoolId: number,
    user: AuthUser,
    exam: { id: number; exam_name: string },
    year: number,
    changedRows: MarkRow[],
    existingByKey: Map<string, MarkRow>,
    enrollmentById: Map<
      number,
      { student_id: number; class: number; section: string; roll: number }
    >,
    subjectById: Map<number, { name: string }>,
    errors: string[],
  ) {
    const studentIds = [
      ...new Set(changedRows.map((r) => enrollmentById.get(r.enrollment_id)!.student_id)),
    ];
    const students = await this.prisma.students.findMany({
      where: { school_id: schoolId, id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(students.map((s) => [s.id, s.name]));

    const classes = new Set<number>();
    const sections = new Set<string>();
    const subjectNames = new Set<string>();
    const byStudent = new Map<number, any>();
    for (const row of changedRows) {
      const e = enrollmentById.get(row.enrollment_id)!;
      classes.add(e.class);
      sections.add(e.section);
      const subjectName = subjectById.get(row.subject_id)?.name ?? `Subject #${row.subject_id}`;
      subjectNames.add(subjectName);
      const key = `${row.enrollment_id}_${row.subject_id}`;
      let entry = byStudent.get(e.student_id);
      if (!entry) {
        entry = {
          studentId: e.student_id,
          name: nameById.get(e.student_id) ?? 'Unknown',
          class: e.class,
          section: e.section,
          roll: e.roll,
          subjects: [],
        };
        byStudent.set(e.student_id, entry);
      }
      entry.subjects.push({
        subjectId: row.subject_id,
        subjectName,
        action: existingByKey.has(key) ? 'updated' : 'created',
        before: markSnapshot(existingByKey.get(key)),
        after: markSnapshot(row),
      });
    }

    const MAX_STUDENT_CHANGES = 100;
    const changes = [...byStudent.values()];
    const truncated = changes.length > MAX_STUDENT_CHANGES;
    logger.info('[marks] saved', {
      user: { id: user.id ?? null, name: (user as any).name ?? null, role: user.role ?? null },
      schoolId,
      exam: exam.exam_name,
      examId: exam.id,
      year,
      classes: [...classes].sort((a, b) => a - b),
      sections: [...sections].sort(),
      subjects: [...subjectNames].sort(),
      studentsAffected: changes.length,
      rowsChanged: changedRows.length,
      changes: truncated ? changes.slice(0, MAX_STUDENT_CHANGES) : changes,
      ...(truncated ? { changesTruncated: true } : {}),
      ...(errors.length ? { errors } : {}),
    });
  }

  /** Students of a class (teachers: only their sections) for the marks entry grid. */
  async getRoster(
    schoolId: number,
    cls: number,
    year: number,
    section: string | undefined,
    user: AuthUser,
  ) {
    const where: Prisma.student_enrollmentsWhereInput = { school_id: schoolId, class: cls, year };
    if (user.role === 'teacher') {
      const assigned = teacherSections(user, cls, year);
      if (section && !assigned.includes(section)) {
        throw new ForbiddenException('You are not assigned to this section.');
      }
      where.section = section || { in: assigned };
    } else if (section) {
      where.section = section;
    }

    const rows = await this.prisma.student_enrollments.findMany({
      where,
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ section: 'asc' }, { roll: 'asc' }, { student: { name: 'asc' } }],
    });
    return rows.map((e) => ({
      student_id: e.student.id,
      name: e.student.name,
      roll: e.roll,
      class: e.class,
      section: e.section,
      group: e.group,
      fourth_subject_id: e.fourth_subject_id,
    }));
  }

  /** Every student's marks in a class for one exam (teachers: only their sections). */
  async getClassMarks(schoolId: number, cls: number, year: number, exam: string, user: AuthUser) {
    const where: Prisma.student_enrollmentsWhereInput = { school_id: schoolId, class: cls, year };
    if (user.role === 'teacher') where.section = { in: teacherSections(user, cls, year) };

    const rows = await this.prisma.student_enrollments.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
        marks: {
          where: { exam: { exam_name: exam } },
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                priority: true,
                full_mark: true,
                cq_mark: true,
                mcq_mark: true,
                practical_mark: true,
                marking_scheme: true,
              },
            },
            exam: { select: { exam_name: true } },
          },
        },
      },
      orderBy: [{ section: 'asc' }, { roll: 'asc' }, { student: { name: 'asc' } }],
    });

    return rows.map((e) => ({
      student_id: e.student.id,
      name: e.student.name,
      roll: e.roll,
      class: e.class,
      group: e.group,
      section: e.section,
      fourth_subject_id: e.fourth_subject_id,
      marks: e.marks.map((m) => ({
        subject_id: m.subject.id,
        subject: m.subject.name,
        priority: m.subject.priority ?? 0,
        cq_marks: m.cq_marks,
        mcq_marks: m.mcq_marks,
        practical_marks: m.practical_marks,
        marks: m.marks,
        subject_info: {
          full_mark: m.subject.full_mark,
          cq_mark: m.subject.cq_mark,
          mcq_mark: m.subject.mcq_mark,
          practical_mark: m.subject.practical_mark,
          marking_scheme: m.subject.marking_scheme,
        },
      })),
    }));
  }

  /** Enrollment for the year, after checking the user may see this student. */
  private async accessibleEnrollment(
    schoolId: number,
    studentId: number,
    year: number,
    user: AuthUser,
  ) {
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: { school_id: schoolId, student_id: studentId, year },
    });
    if (!enrollment) throw new NotFoundException('Student enrollment not found for specified year');
    if (!canAccessStudent(user, studentId, enrollment.class, enrollment.section, year)) {
      throw new ForbiddenException("You are not authorized to view this student's marks");
    }
    return enrollment;
  }

  /** One student's marks for one exam. Students only see published (visible) exams. */
  async getStudentMarks(
    schoolId: number,
    studentId: number,
    year: number,
    exam: string,
    user: AuthUser,
  ) {
    const isStudent = user.role === 'student';
    if (isStudent) {
      const published = await this.prisma.exams.findFirst({
        where: { school_id: schoolId, exam_name: exam, exam_year: year, visible: true },
        select: { id: true },
      });
      if (!published) throw new ForbiddenException('This result has not been published yet');
    }
    await this.accessibleEnrollment(schoolId, studentId, year, user);

    const marks = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        enrollment: { student_id: studentId, year },
        exam: { exam_name: exam, ...(isStudent ? { visible: true } : {}) },
      },
      include: {
        subject: {
          select: {
            name: true,
            priority: true,
            assessment_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
      },
    });
    return marks.map((m) => ({
      subject: m.subject.parent?.name || m.subject.name,
      marks: m.marks,
    }));
  }

  /** Session (previous + year-end exam) result preview for one student; null when nothing to show. */
  async getSessionPreview(schoolId: number, studentId: number, year: number, user: AuthUser) {
    const enrollment = await this.accessibleEnrollment(schoolId, studentId, year, user);
    const { pages } = await this.renderer.loadSessionMarksheetPages(schoolId, year, {
      classLevel: enrollment.class,
      enrollmentIds: [enrollment.id],
    });
    const page = pages[0];
    if (!page) return null;
    const r = page.result;
    return {
      student: {
        name: r.studentName,
        class: r.classLevel,
        section: r.section,
        roll: r.roll,
        group: r.group,
        year,
      },
      previous_exam_name: page.previousExamName,
      year_end_exam_name: page.yearEndExamName,
      ...buildSessionTable(r),
      grand_total: r.grandTotal,
      gpa: r.gpa,
      is_failed: r.isFailed,
      fail_count: r.failCount,
      position: r.position,
    };
  }

  /** Marks the year's marksheets of these students stale (4th subject changes the rendered sheet). */
  private async invalidateYear(
    schoolId: number,
    enrollmentIds: number[],
    studentIds: number[],
    year: number,
  ) {
    const exams = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        enrollment_id: { in: enrollmentIds },
        exam: { exam_year: year },
      },
      distinct: ['exam_id'],
      select: { exam_id: true },
    });
    for (const { exam_id } of exams)
      await this.marksheets.invalidate(schoolId, studentIds, exam_id);
  }

  async updateFourthSubject(
    schoolId: number,
    studentId: number,
    year: number,
    subjectId: number | null,
    user: AuthUser,
  ) {
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: { school_id: schoolId, student_id: studentId, year },
    });
    if (!enrollment) throw new NotFoundException('Student enrollment not found for specified year');
    if (!canAccessStudent(user, studentId, enrollment.class, enrollment.section, year)) {
      throw new ForbiddenException("You are not authorized to update this student's 4th subject");
    }
    if (subjectId != null) {
      await this.assertFourthSubject(schoolId, subjectId, enrollment.class, enrollment.group);
    }

    const updated = await this.prisma.student_enrollments.update({
      where: { id: enrollment.id, school_id: schoolId },
      data: { fourth_subject_id: subjectId },
    });
    await this.invalidateYear(schoolId, [enrollment.id], [studentId], year).catch(
      warn('updateFourthSubject'),
    );
    return updated;
  }

  /** Same 4th subject for every enrollment of a class 9/10 group (groups never mixed). Admin only. */
  async bulkUpdateFourthSubject(schoolId: number, dto: BulkUpdateFourthSubjectDto) {
    const { class: cls, year, group } = dto;
    const subjectId = dto.subjectId ?? null;
    if (subjectId != null) await this.assertFourthSubject(schoolId, subjectId, cls, group);

    const enrollments = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, class: cls, year, group },
      select: { id: true, student_id: true },
    });
    if (enrollments.length === 0) return { updatedCount: 0, studentIds: [] as number[] };

    const enrollmentIds = enrollments.map((e) => e.id);
    const studentIds = enrollments.map((e) => e.student_id);
    const result = await this.prisma.student_enrollments.updateMany({
      where: { school_id: schoolId, id: { in: enrollmentIds } },
      data: { fourth_subject_id: subjectId },
    });
    await this.invalidateYear(schoolId, enrollmentIds, studentIds, year).catch(
      warn('bulkUpdateFourthSubject'),
    );
    return { updatedCount: result.count, studentIds };
  }

  /** A 4th subject must be this school's, same class, not a main subject, and match the group. */
  private async assertFourthSubject(
    schoolId: number,
    subjectId: number,
    cls: number,
    group: string | null,
  ) {
    const subject = await this.prisma.subjects.findFirst({
      where: { school_id: schoolId, id: subjectId },
      select: { id: true, class: true, subject_type: true, group: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.class !== cls) {
      throw new BadRequestException(`Subject belongs to class ${subject.class}, not ${cls}`);
    }
    if (subject.subject_type === 'main') {
      throw new BadRequestException('Cannot set a main (group) subject as 4th subject');
    }
    if (subject.group && subject.group !== group) {
      throw new BadRequestException(
        `Subject group (${subject.group}) does not match selected group (${group})`,
      );
    }
  }
}
