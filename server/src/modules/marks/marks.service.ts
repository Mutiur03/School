import { prisma } from '@/config/prisma.js';
import { Prisma } from '@prisma/client';
import { getRlsContext, patchRlsContext } from '@/config/rlsContextStore.js';
import { getFileBuffer, headObjectEtag } from '@/config/r2.js';
import logger from '@/utils/logger.js';
import PDFDocument from 'pdfkit';
import { pdf } from 'pdf-to-img';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const PDF_STYLES = {
  startX: 50,
  contentWidth: 495,
  rowHeight: 20,
  headerFontSize: 10,
  rowFontSize: 9,
  fontBold: 'Times-Bold',
  fontRegular: 'Times-Roman',
  fontItalic: 'Times-Italic',
};

const A4_PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARKSHEET_IMAGE_SCALE = 2;
// true  -> rasterize PDF to images then re-embed (tamper-resistant, slow).
// false -> return direct vector PDF (fast, selectable text).
const RASTERIZE_MARKSHEET = false;
const MARKSHEET_FONT_PATHS = {
  regular: [
    process.env.MARKSHEET_FONT_REGULAR,
    'C:\\Windows\\Fonts\\times.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf',
  ].filter(Boolean) as string[],
  bold: [
    process.env.MARKSHEET_FONT_BOLD,
    'C:\\Windows\\Fonts\\timesbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf',
  ].filter(Boolean) as string[],
};

// Gap between table end and signature block (PDF points)
const SIGNATURE_GAP_AFTER_TABLE = 40;
const SIGNATURE_BLOCK_HEIGHT = 88;
const SIGNATURE_IMAGE_WIDTH = 60;

const GROUPED_CLASSES = new Set([9, 10]);
const STUDENT_GROUPS = ['Science', 'Commerce', 'Humanities'] as const;

type ClassStatsSnapshot = {
  highestBySubject: Record<number, number>;
  classHighestTotal: number;
  classHighestGrandTotal: number;
};

type StatsByGroup = Record<string, ClassStatsSnapshot>;
// Bottom of signature must sit exactly on dotted line; image can only grow
// upward, capped so it never crosses into the content above the gap.
const SIGNATURE_IMAGE_MAX_HEIGHT = SIGNATURE_GAP_AFTER_TABLE - 10;
const PAGE_CONTENT_BOTTOM = 812;

const MONTH_SHORT = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatMarksheetDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const raw = String(dateStr).split('T')[0].trim();
  const parts = raw.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [year, month, day] = parts;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')} ${MONTH_SHORT[month - 1]}, ${year}`;
    }
  }
  return raw || null;
}

export class MarksService {
  private static validateMarksData(data: any) {
    if (!Array.isArray(data.students)) {
      throw new Error('Students data must be an array');
    }
    data.students.forEach((student: any) => {
      if (!student.studentId || !Array.isArray(student.subjectMarks)) {
        throw new Error('Invalid student data structure');
      }
      student.subjectMarks.forEach((mark: any) => {
        if (!mark.subjectId) {
          throw new Error('Invalid marks data structure - missing subjectId');
        }
        mark.cq_marks =
          mark.cq_marks === null || mark.cq_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.cq_marks));
        mark.mcq_marks =
          mark.mcq_marks === null || mark.mcq_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.mcq_marks));
        mark.practical_marks =
          mark.practical_marks === null || mark.practical_marks === undefined
            ? null
            : Math.max(0, parseInt(mark.practical_marks));
        mark.marks =
          mark.marks === null || mark.marks === undefined
            ? null
            : Math.max(0, parseInt(mark.marks));
      });
    });
  }

  private static checkAccess(
    user: any,
    studentId: number,
    className: number,
    section: string,
    year: number,
  ) {
    if (user.role === 'admin') return true;
    if (user.role === 'teacher') {
      return user.levels?.some(
        (level: any) =>
          level.class_name === className && level.section === section && level.year === year,
      );
    }
    if (user.role === 'student') {
      return user.id === studentId;
    }
    return false;
  }

  /** Throws if the user may not download this student's marksheet for an exam. */
  static async verifyMarksheetDownloadAccess(
    studentId: number,
    year: number | string,
    examName: string,
    user: any,
  ): Promise<void> {
    const yearInt = typeof year === 'string' ? parseInt(year) : year;
    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year: yearInt },
      select: { class: true, section: true },
    });
    if (!enrollment) {
      throw new Error('Student not enrolled for this year');
    }
    const hasMarks = examName
      ? await prisma.marks.findFirst({
          where: {
            enrollment: { student_id: studentId, year: yearInt },
            exam: { exam_name: examName, exam_year: yearInt },
            marks: { not: null },
          },
          select: { id: true },
        })
      : await prisma.marks.findFirst({
          where: {
            enrollment: { student_id: studentId, year: yearInt },
            marks: { not: null },
          },
          select: { id: true },
        });
    if (!hasMarks) {
      throw new Error('No marks found for this student');
    }
    if (!this.checkAccess(user, studentId, enrollment.class, enrollment.section, yearInt)) {
      throw new Error('You are not authorized to download this marksheet');
    }
    if (examName && user?.role === 'student') {
      await this.assertStudentPublishedExam(examName, yearInt);
    }
  }

  /** Students may only view marks for published (visible) exams. */
  static async assertStudentPublishedExam(examName: string, year: number) {
    const exam = await prisma.exams.findFirst({
      where: { exam_name: examName, exam_year: year, visible: true },
      select: { id: true },
    });
    if (!exam) {
      throw new Error('This result has not been published yet');
    }
  }

  /**
   * Class-highest stats for one (exam, class, year), computed with DB
   * aggregates instead of pulling every mark row into JS. Shared by the
   * write-time cache refresh and the read-time lazy fallback.
   * For class 9/10 pass `group` to scope stats to Science/Commerce/Humanities.
   * - highestBySubject: max mark per subject, across all assessment types.
   * - classHighestTotal: max over per-student totals, exam-type subjects only
   *   (feeds the "Total Marks" row).
   * - classHighestGrandTotal: max over per-student totals across ALL subjects
   *   incl. continuous (feeds the "Grand Total Marks" row).
   */
  static isGroupedClass(klass: number): boolean {
    return GROUPED_CLASSES.has(klass);
  }

  static normalizeStudentGroup(group: string | null | undefined): string | null {
    const g = typeof group === 'string' ? group.trim() : '';
    return g || null;
  }

  static statsFromRow(
    statsRow: {
      highest_by_subject: unknown;
      class_highest_total: number;
      class_highest_grand_total: number;
      stats_by_group?: unknown;
    } | null,
    klass: number,
    group: string | null | undefined,
  ): ClassStatsSnapshot | null {
    if (!statsRow) return null;
    if (this.isGroupedClass(klass)) {
      const groupName = this.normalizeStudentGroup(group);
      if (!groupName) return null;
      const byGroup = (statsRow.stats_by_group ?? {}) as StatsByGroup;
      const gStats = byGroup[groupName];
      if (!gStats) return null;
      return {
        highestBySubject: gStats.highestBySubject ?? {},
        classHighestTotal: gStats.classHighestTotal ?? 0,
        classHighestGrandTotal: gStats.classHighestGrandTotal ?? 0,
      };
    }
    return {
      highestBySubject: (statsRow.highest_by_subject as Record<number, number>) ?? {},
      classHighestTotal: statsRow.class_highest_total ?? 0,
      classHighestGrandTotal: statsRow.class_highest_grand_total ?? 0,
    };
  }

  static async computeStats(
    client: Prisma.TransactionClient | typeof prisma,
    examId: number,
    klass: number,
    year: number,
    group?: string | null,
  ): Promise<ClassStatsSnapshot> {
    const enrollmentWhere: Prisma.student_enrollmentsWhereInput = {
      class: klass,
      year,
    };
    if (group) enrollmentWhere.group = group;

    const [bySubject, byEnrollmentExam, byEnrollmentAll] = await Promise.all([
      client.marks.groupBy({
        by: ['subject_id'],
        where: { exam_id: examId, enrollment: enrollmentWhere },
        _max: { marks: true },
      }),
      client.marks.groupBy({
        by: ['enrollment_id'],
        where: {
          exam_id: examId,
          enrollment: enrollmentWhere,
          subject: { assessment_type: 'exam' },
        },
        _sum: { marks: true },
      }),
      client.marks.groupBy({
        by: ['enrollment_id'],
        where: { exam_id: examId, enrollment: enrollmentWhere },
        _sum: { marks: true },
      }),
    ]);

    const highestBySubject: Record<number, number> = {};
    for (const g of bySubject) {
      highestBySubject[g.subject_id] = Number(g._max.marks ?? 0);
    }
    const examTotals = byEnrollmentExam.map((g) => Number(g._sum.marks ?? 0));
    const classHighestTotal = examTotals.length > 0 ? Math.max(...examTotals) : 0;
    const grandTotals = byEnrollmentAll.map((g) => Number(g._sum.marks ?? 0));
    const classHighestGrandTotal = grandTotals.length > 0 ? Math.max(...grandTotals) : 0;

    return { highestBySubject, classHighestTotal, classHighestGrandTotal };
  }

  static async computeGroupedClassStatsAll(
    client: Prisma.TransactionClient | typeof prisma,
    examId: number,
    klass: number,
    year: number,
  ): Promise<{ classWide: ClassStatsSnapshot; byGroup: StatsByGroup }> {
    const byGroup: StatsByGroup = {};
    await Promise.all(
      STUDENT_GROUPS.map(async (g) => {
        byGroup[g] = await this.computeStats(client, examId, klass, year, g);
      }),
    );
    const classWide = await this.computeStats(client, examId, klass, year);
    return { classWide, byGroup };
  }

  static async resolveStudentClassStats(
    client: Prisma.TransactionClient | typeof prisma,
    statsRow: {
      highest_by_subject: unknown;
      class_highest_total: number;
      class_highest_grand_total: number;
      stats_by_group?: unknown;
    } | null,
    examId: number,
    klass: number,
    year: number,
    group: string | null | undefined,
  ): Promise<ClassStatsSnapshot> {
    const fromCache = this.statsFromRow(statsRow, klass, group);
    if (fromCache) return fromCache;
    const groupName = this.normalizeStudentGroup(group);
    if (this.isGroupedClass(klass) && groupName) {
      return this.computeStats(client, examId, klass, year, groupName);
    }
    return this.computeStats(client, examId, klass, year);
  }

  private static classStatsEqual(
    a: {
      highestBySubject: unknown;
      classHighestTotal: number;
      classHighestGrandTotal: number;
      statsByGroup?: unknown;
    },
    b: {
      highestBySubject: unknown;
      classHighestTotal: number;
      classHighestGrandTotal: number;
      statsByGroup?: unknown;
    },
  ): boolean {
    return (
      a.classHighestTotal === b.classHighestTotal &&
      a.classHighestGrandTotal === b.classHighestGrandTotal &&
      JSON.stringify(a.highestBySubject) === JSON.stringify(b.highestBySubject) &&
      JSON.stringify(a.statsByGroup ?? null) === JSON.stringify(b.statsByGroup ?? null)
    );
  }

  private static markRowChanged(
    existing:
      | {
          cq_marks: number | null;
          mcq_marks: number | null;
          practical_marks: number | null;
          marks: number | null;
        }
      | undefined,
    next: {
      cq_marks: number | null;
      mcq_marks: number | null;
      practical_marks: number | null;
      marks: number | null;
    },
  ): boolean {
    if (!existing) return true;
    return (
      existing.cq_marks !== next.cq_marks ||
      existing.mcq_marks !== next.mcq_marks ||
      existing.practical_marks !== next.practical_marks ||
      existing.marks !== next.marks
    );
  }

  private static markSnapshot(
    row:
      | {
          cq_marks: number | null;
          mcq_marks: number | null;
          practical_marks: number | null;
          marks: number | null;
        }
      | null
      | undefined,
  ) {
    if (!row) return null;
    const hasBreakdown =
      row.cq_marks != null || row.mcq_marks != null || row.practical_marks != null;
    if (hasBreakdown) {
      return {
        total: row.marks,
        cq: row.cq_marks,
        mcq: row.mcq_marks,
        practical: row.practical_marks,
      };
    }
    return { total: row.marks };
  }

  private static async logMarksSave(payload: {
    user: any;
    exam: { id: number; exam_name: string };
    year: number;
    changedRows: {
      enrollment_id: number;
      subject_id: number;
      cq_marks: number | null;
      mcq_marks: number | null;
      practical_marks: number | null;
      marks: number | null;
    }[];
    existingByKey: Map<
      string,
      {
        enrollment_id: number;
        subject_id: number;
        cq_marks: number | null;
        mcq_marks: number | null;
        practical_marks: number | null;
        marks: number | null;
      }
    >;
    enrollments: {
      id: number;
      student_id: number;
      class: number;
      section: string;
      roll: number;
    }[];
    subjectById: Map<number, { id: number; name: string }>;
    errors?: string[];
  }) {
    const { user, exam, year, changedRows, existingByKey, enrollments, subjectById, errors } =
      payload;

    if (changedRows.length === 0) return;

    const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
    const studentIds = [
      ...new Set(
        changedRows
          .map((r) => enrollmentById.get(r.enrollment_id)?.student_id)
          .filter((id): id is number => id != null),
      ),
    ];

    const students = await prisma.students.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const studentNameById = new Map(students.map((s) => [s.id, s.name]));

    const classes = new Set<number>();
    const sections = new Set<string>();
    const subjectNames = new Set<string>();
    const byStudent = new Map<
      number,
      {
        studentId: number;
        name: string;
        class: number;
        section: string;
        roll: number;
        subjects: {
          subjectId: number;
          subjectName: string;
          action: 'created' | 'updated';
          before: ReturnType<typeof MarksService.markSnapshot>;
          after: ReturnType<typeof MarksService.markSnapshot>;
        }[];
      }
    >();

    for (const row of changedRows) {
      const enrollment = enrollmentById.get(row.enrollment_id);
      if (!enrollment) continue;

      classes.add(enrollment.class);
      sections.add(enrollment.section);

      const subject = subjectById.get(row.subject_id);
      const subjectName = subject?.name ?? `Subject #${row.subject_id}`;
      subjectNames.add(subjectName);

      const key = `${row.enrollment_id}_${row.subject_id}`;
      const before = this.markSnapshot(existingByKey.get(key));
      const after = this.markSnapshot(row);

      let entry = byStudent.get(enrollment.student_id);
      if (!entry) {
        entry = {
          studentId: enrollment.student_id,
          name: studentNameById.get(enrollment.student_id) ?? 'Unknown',
          class: enrollment.class,
          section: enrollment.section,
          roll: enrollment.roll,
          subjects: [],
        };
        byStudent.set(enrollment.student_id, entry);
      }

      entry.subjects.push({
        subjectId: row.subject_id,
        subjectName,
        action: existingByKey.has(key) ? 'updated' : 'created',
        before,
        after,
      });
    }

    const MAX_STUDENT_CHANGES = 100;
    const studentChanges = [...byStudent.values()];
    const truncated = studentChanges.length > MAX_STUDENT_CHANGES;

    logger.info('[marks] saved', {
      user: {
        id: user?.id ?? null,
        name: user?.name ?? null,
        role: user?.role ?? null,
      },
      schoolId: getRlsContext()?.schoolId ?? null,
      exam: exam.exam_name,
      examId: exam.id,
      year,
      classes: [...classes].sort((a, b) => a - b),
      sections: [...sections].sort(),
      subjects: [...subjectNames].sort(),
      studentsAffected: studentChanges.length,
      rowsChanged: changedRows.length,
      changes: truncated ? studentChanges.slice(0, MAX_STUDENT_CHANGES) : studentChanges,
      ...(truncated ? { changesTruncated: true } : {}),
      ...(errors?.length ? { errors } : {}),
    });
  }

  /**
   * Recompute and persist the exam_class_stats cache row for one
   * (exam, class, year). Runs inside the addMarks transaction; school_id is
   * filled by the BEFORE INSERT trigger from the RLS context, exactly like the
   * marks upsert, so the ON CONFLICT target includes school_id.
   * Returns true when displayed class-highest values changed.
   */
  static async recomputeExamClassStats(
    tx: Prisma.TransactionClient,
    examId: number,
    klass: number,
    year: number,
  ): Promise<boolean> {
    const oldRow = await tx.exam_class_stats.findFirst({
      where: { exam_id: examId, class: klass, year },
      select: {
        highest_by_subject: true,
        class_highest_total: true,
        class_highest_grand_total: true,
        stats_by_group: true,
      },
    });
    let highestBySubject: Record<number, number>;
    let classHighestTotal: number;
    let classHighestGrandTotal: number;
    let statsByGroup: StatsByGroup | null = null;
    if (this.isGroupedClass(klass)) {
      const grouped = await this.computeGroupedClassStatsAll(tx, examId, klass, year);
      ({ highestBySubject, classHighestTotal, classHighestGrandTotal } = grouped.classWide);
      statsByGroup = grouped.byGroup;
    } else {
      ({ highestBySubject, classHighestTotal, classHighestGrandTotal } = await this.computeStats(
        tx,
        examId,
        klass,
        year,
      ));
    }
    const nextStats = {
      highestBySubject,
      classHighestTotal,
      classHighestGrandTotal,
      statsByGroup,
    };
    if (
      oldRow &&
      this.classStatsEqual(
        {
          highestBySubject: oldRow.highest_by_subject,
          classHighestTotal: oldRow.class_highest_total,
          classHighestGrandTotal: oldRow.class_highest_grand_total,
          statsByGroup: oldRow.stats_by_group,
        },
        nextStats,
      )
    ) {
      return false;
    }
    await tx.$executeRaw`
      INSERT INTO exam_class_stats (exam_id, "class", year, highest_by_subject, class_highest_total, class_highest_grand_total, stats_by_group)
      VALUES (${examId}, ${klass}, ${year}, ${JSON.stringify(highestBySubject)}::jsonb, ${classHighestTotal}, ${classHighestGrandTotal}, ${statsByGroup ? JSON.stringify(statsByGroup) : null}::jsonb)
      ON CONFLICT (exam_id, "class", year, school_id)
      DO UPDATE SET
        highest_by_subject = EXCLUDED.highest_by_subject,
        class_highest_total = EXCLUDED.class_highest_total,
        class_highest_grand_total = EXCLUDED.class_highest_grand_total,
        stats_by_group = EXCLUDED.stats_by_group,
        updated_at = NOW()
    `;
    return true;
  }

  static async addMarks(data: any, user: any) {
    this.validateMarksData(data);
    const { students, examName, year } = data;

    const exam = await prisma.exams.findFirst({
      where: {
        exam_name: examName,
        exam_year: parseInt(year),
      },
    });

    if (!exam) {
      const allExams = await prisma.exams.findMany({
        select: { id: true, exam_name: true, exam_year: true },
      });
      throw new Error(
        `Exam "${examName}" not found for year ${year}. Available: ${JSON.stringify(allExams)}`,
      );
    }

    const errors: string[] = [];
    const yearInt = parseInt(year);

    // Batch-fetch everything up front instead of querying per student/subject.
    const studentIds: number[] = students.map((s: any) => s.studentId);
    const subjectIds: number[] = Array.from(
      new Set(students.flatMap((s: any) => s.subjectMarks.map((m: any) => m.subjectId))),
    );

    const [enrollments, subjects] = await Promise.all([
      prisma.student_enrollments.findMany({
        where: { student_id: { in: studentIds }, year: yearInt },
      }),
      prisma.subjects.findMany({ where: { id: { in: subjectIds } } }),
    ]);

    const enrollmentByStudent = new Map(enrollments.map((e) => [e.student_id, e]));
    const enrollmentClassById = new Map(enrollments.map((e) => [e.id, e.class]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));

    // Deduped by (enrollment, subject) so the single upsert never touches
    // the same row twice.
    const rowsByKey = new Map<
      string,
      {
        enrollment_id: number;
        subject_id: number;
        cq_marks: number | null;
        mcq_marks: number | null;
        practical_marks: number | null;
        marks: number | null;
      }
    >();

    for (const student of students) {
      const enrollment = enrollmentByStudent.get(student.studentId);

      if (!enrollment) {
        errors.push(`Student ${student.studentId} not enrolled in ${year}`);
        continue;
      }

      if (
        !this.checkAccess(user, student.studentId, enrollment.class, enrollment.section, yearInt)
      ) {
        errors.push(
          `Teacher ${user.id} not authorized for Class ${enrollment.class} Section ${enrollment.section}`,
        );
        continue;
      }

      for (const {
        subjectId,
        cq_marks,
        mcq_marks,
        practical_marks,
        marks: providedTotal,
      } of student.subjectMarks) {
        const subject = subjectById.get(subjectId);

        if (!subject) {
          errors.push(`Subject ${subjectId} not found`);
          continue;
        }

        let totalMarks: number | null =
          (subject as any).marking_scheme === 'BREAKDOWN'
            ? (Number(cq_marks) || 0) + (Number(mcq_marks) || 0) + (Number(practical_marks) || 0)
            : providedTotal;

        if (
          (subject as any).marking_scheme === 'BREAKDOWN' &&
          cq_marks === null &&
          mcq_marks === null &&
          practical_marks === null
        ) {
          totalMarks = null;
        }

        rowsByKey.set(`${enrollment.id}_${subjectId}`, {
          enrollment_id: enrollment.id,
          subject_id: subjectId,
          cq_marks,
          mcq_marks,
          practical_marks,
          marks: totalMarks,
        });
      }
    }

    const rows = Array.from(rowsByKey.values());
    const studentIdByEnrollmentId = new Map(enrollments.map((e) => [e.id, e.student_id]));

    // Only touch rows whose values actually changed so updated_at (and
    // marksheet input_hash) are not bumped for the whole class on one edit.
    let changedRows = rows;
    const existingByKey = new Map<
      string,
      {
        enrollment_id: number;
        subject_id: number;
        cq_marks: number | null;
        mcq_marks: number | null;
        practical_marks: number | null;
        marks: number | null;
      }
    >();
    if (rows.length > 0) {
      const existingMarks = await prisma.marks.findMany({
        where: {
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
      for (const m of existingMarks) {
        existingByKey.set(`${m.enrollment_id}_${m.subject_id}`, m);
      }
      changedRows = rows.filter((r) =>
        this.markRowChanged(existingByKey.get(`${r.enrollment_id}_${r.subject_id}`), r),
      );
    }

    const changedStudentIds = [
      ...new Set(
        changedRows
          .map((r) => studentIdByEnrollmentId.get(r.enrollment_id))
          .filter((id): id is number => id != null),
      ),
    ];

    if (changedRows.length > 0) {
      // Single bulk upsert. Raw SQL bypasses the per-operation RLS extension,
      // so replicate its set_config calls inside the transaction; school_id
      // is filled by the BEFORE INSERT trigger from that context.
      const rlsContext = getRlsContext();
      const values = changedRows.map(
        (r) =>
          Prisma.sql`(${r.enrollment_id}, ${r.subject_id}, ${exam.id}, ${r.cq_marks}, ${r.mcq_marks}, ${r.practical_marks}, ${r.marks})`,
      );

      const classesWithStatsChange: number[] = [];
      await prisma.$transaction(async (tx) => {
        if (rlsContext) {
          await tx.$executeRaw`
            SELECT set_config('app.is_super_admin', ${rlsContext.isSuperAdmin ? '1' : '0'}, true)
          `;
          await tx.$executeRaw`
            SELECT set_config('app.school_id', ${rlsContext.schoolId ? String(rlsContext.schoolId) : ''}, true)
          `;
        }

        await tx.$executeRaw`
          INSERT INTO marks (enrollment_id, subject_id, exam_id, cq_marks, mcq_marks, practical_marks, marks)
          VALUES ${Prisma.join(values)}
          ON CONFLICT (enrollment_id, subject_id, exam_id)
          DO UPDATE SET
            cq_marks = EXCLUDED.cq_marks,
            mcq_marks = EXCLUDED.mcq_marks,
            practical_marks = EXCLUDED.practical_marks,
            marks = EXCLUDED.marks,
            updated_at = NOW()
        `;

        const affectedClasses = new Set<number>();
        for (const r of changedRows) {
          const cls = enrollmentClassById.get(r.enrollment_id);
          if (cls !== undefined) affectedClasses.add(cls);
        }
        patchRlsContext({ inRlsTransaction: true });
        try {
          for (const cls of affectedClasses) {
            const statsChanged = await this.recomputeExamClassStats(tx, exam.id, cls, yearInt);
            if (statsChanged) classesWithStatsChange.push(cls);
          }
        } finally {
          patchRlsContext({ inRlsTransaction: false });
        }
      });

      try {
        const { MarksheetService } = await import('./marksheet.service.js');
        // Visible or not: keep open-exam caches fresh. Freeze is result_date only
        // (same as head/teacher/design). Unpublished sheets still regen on mark edits.
        if (classesWithStatsChange.length > 0) {
          await MarksheetService.invalidateClasses(exam.id, classesWithStatsChange, yearInt);
        } else if (changedStudentIds.length > 0) {
          await MarksheetService.invalidate(changedStudentIds, exam.id);
        }
      } catch (invErr) {
        console.warn(
          'Marksheet invalidation failed after addMarks:',
          invErr instanceof Error ? invErr.message : invErr,
        );
      }

      try {
        await this.logMarksSave({
          user,
          exam,
          year: yearInt,
          changedRows,
          existingByKey,
          enrollments,
          subjectById,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (logErr) {
        logger.warn('[marks] audit log failed', {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    }

    return {
      success: true,
      count: changedRows.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  static async getStudentsForMarks(
    className: string,
    year: string,
    section: string | undefined,
    user: any,
  ) {
    const where: any = {
      class: Number(className),
      year: parseInt(year),
    };

    if (user.role === 'teacher') {
      const assignedSections = user.levels
        ?.filter((l: any) => l.class_name === Number(className) && l.year === parseInt(year))
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error('You are not assigned to this class.');
      }

      if (section) {
        if (!assignedSections.includes(section)) {
          throw new Error('You are not assigned to this section.');
        }
        where.section = section;
      } else {
        where.section = { in: assignedSections };
      }
    } else if (section) {
      where.section = section;
    }

    const students = await prisma.student_enrollments.findMany({
      where,
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: [{ section: 'asc' }, { roll: 'asc' }, { student: { name: 'asc' } }],
    });

    return students.map((enrollment: any) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      section: enrollment.section,
      group: enrollment.group,
      fourth_subject_id: enrollment.fourth_subject_id,
    }));
  }

  static async getClassMarks(className: string, year: string, exam: string, user: any) {
    const where: any = {
      class: Number(className),
      year: parseInt(year),
    };

    if (user.role === 'teacher') {
      const assignedSections = user.levels
        ?.filter((l: any) => l.class_name === Number(className) && l.year === parseInt(year))
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error('You are not assigned to this class.');
      }
      where.section = { in: assignedSections };
    }

    const result = await prisma.student_enrollments.findMany({
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

    if (result.length === 0) {
      return [];
    }

    return result.map((enrollment: any) => ({
      student_id: enrollment.student.id,
      name: enrollment.student.name,
      roll: enrollment.roll,
      class: enrollment.class,
      group: enrollment.group,
      section: enrollment.section,
      fourth_subject_id: enrollment.fourth_subject_id,
      marks: (enrollment.marks || []).map((mark: any) => ({
        subject_id: mark.subject.id,
        subject: mark.subject.name,
        priority: mark.subject.priority ?? 0,
        cq_marks: mark.cq_marks,
        mcq_marks: mark.mcq_marks,
        practical_marks: mark.practical_marks,
        marks: mark.marks,
        subject_info: {
          full_mark: mark.subject.full_mark,
          cq_mark: mark.subject.cq_mark,
          mcq_mark: mark.subject.mcq_mark,
          practical_mark: mark.subject.practical_mark,
          marking_scheme: (mark.subject as any).marking_scheme,
        },
      })),
    }));
  }

  static async getIndividualMarks(
    id: string,
    year: string,
    exam: string,
    user?: { role?: string; id?: number },
  ) {
    const yearInt = parseInt(year);
    if (user?.role === 'student') {
      await this.assertStudentPublishedExam(exam, yearInt);
    }

    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          student_id: parseInt(id),
          year: yearInt,
        },
        exam: {
          exam_name: exam,
          ...(user?.role === 'student' ? { visible: true } : {}),
        },
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

    return marks.map((mark) => ({
      subject: mark.subject.parent?.name || mark.subject.name,
      marks: mark.marks,
    }));
  }

  static async getIndividualSessionMarksPreview(studentId: string, year: string, user: any) {
    const sId = parseInt(studentId);
    const yearInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: sId, year: yearInt },
    });

    if (!enrollment) {
      throw new Error('Student enrollment not found for specified year');
    }

    if (!this.checkAccess(user, sId, enrollment.class, enrollment.section, yearInt)) {
      throw new Error("You are not authorized to view this student's marks");
    }

    const marks = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: sId, year: yearInt },
      },
      include: {
        enrollment: {
          include: { student: { select: { name: true } } },
        },
        subject: { select: { name: true, priority: true } },
        exam: { select: { exam_name: true } },
      },
    });

    if (marks.length === 0) return [];

    const grouped: any[] = [];
    const subjects: Record<string, any> = {};
    const totalMarksPerExam: Record<string, number> = {};

    marks.forEach((mark: any) => {
      const subjectName = mark.subject.parent?.name || mark.subject.name;

      if (!subjects[subjectName]) {
        subjects[subjectName] = {
          student_name: mark.enrollment.student.name,
          roll: mark.enrollment.roll,
          class: mark.enrollment.class,
          section: mark.enrollment.section,
          year: mark.enrollment.year,
          subject: subjectName,
          exam_marks: {},
          exam_breakdowns: {},
          priority: mark.subject.priority,
          final_merit: enrollment.final_merit,
        };
        grouped.push(subjects[subjectName]);
      }

      const examName = mark.exam.exam_name;
      const mVal = mark.marks ?? 0;
      subjects[subjectName].exam_marks[examName] =
        (subjects[subjectName].exam_marks[examName] || 0) + mVal;

      totalMarksPerExam[examName] = (totalMarksPerExam[examName] || 0) + mVal;
    });

    // Add totals to every entry for the frontend to consume
    grouped.forEach((entry) => {
      entry.total_marks_per_exam = totalMarksPerExam;
    });

    return grouped.sort((a, b) => a.priority - b.priority);
  }

  /** Subjects that appear as marksheet rows (papers + singles; not main parents). */
  private static readonly MARKSHEET_SUBJECT_SELECT = {
    id: true,
    name: true,
    priority: true,
    assessment_type: true,
    full_mark: true,
    pass_mark: true,
    cq_mark: true,
    mcq_mark: true,
    practical_mark: true,
    cq_pass_mark: true,
    mcq_pass_mark: true,
    practical_pass_mark: true,
    marking_scheme: true,
    subject_type: true,
    parent_id: true,
    group: true,
    parent: { select: { name: true } },
  } as const;

  /** Class roster used when filling empty subjects onto a marksheet. */
  static async loadMarksheetSubjects(classNum: number, year: number) {
    return prisma.subjects.findMany({
      where: {
        class: classNum,
        year,
        subject_type: { not: 'main' },
      },
      select: this.MARKSHEET_SUBJECT_SELECT,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
  }

  private static subjectMatchesStudentGroup(
    subject: { group?: string | null },
    studentGroup?: string | null,
  ) {
    if (!studentGroup) return true;
    return !subject.group || subject.group === '' || subject.group === studentGroup;
  }

  /**
   * Ensure every class subject appears on the sheet. Subjects with no marks row
   * are rendered as "-" (null marks) instead of being omitted.
   */
  static fillMissingSubjectMarks(
    existingMarks: any[],
    subjects: Awaited<ReturnType<typeof MarksService.loadMarksheetSubjects>>,
    studentGroup: string | null | undefined,
    base: {
      enrollment_id: number;
      exam_id: number;
      enrollment?: any;
      exam?: any;
    },
  ) {
    const bySubjectId = new Map<number, any>();
    for (const m of existingMarks) {
      bySubjectId.set(m.subject_id, m);
    }

    const filled: any[] = [];
    for (const sub of subjects) {
      if (!this.subjectMatchesStudentGroup(sub, studentGroup)) continue;
      const existing = bySubjectId.get(sub.id);
      if (existing) {
        filled.push(existing);
        bySubjectId.delete(sub.id);
      } else {
        filled.push({
          enrollment_id: base.enrollment_id,
          exam_id: base.exam_id,
          subject_id: sub.id,
          cq_marks: null,
          mcq_marks: null,
          practical_marks: null,
          marks: null,
          enrollment: base.enrollment ?? existingMarks[0]?.enrollment,
          exam: base.exam ?? existingMarks[0]?.exam,
          subject: sub,
        });
      }
    }

    // Keep orphan rows (e.g. subject removed from roster) so data is not lost.
    for (const leftover of bySubjectId.values()) {
      filled.push(leftover);
    }

    filled.sort((a, b) => {
      if (a.subject.assessment_type === 'exam' && b.subject.assessment_type !== 'exam') return -1;
      if (a.subject.assessment_type !== 'exam' && b.subject.assessment_type === 'exam') return 1;
      return (a.subject.priority || 0) - (b.subject.priority || 0);
    });

    return filled;
  }

  static aggregatePaperMarks(marksList: any[]) {
    const aggregatedData: Record<number, any> = {};
    const finalData: any[] = [];

    marksList.forEach((mark) => {
      const sub = mark.subject;
      if (sub.subject_type === 'paper' && sub.parent_id) {
        const pid = sub.parent_id;
        if (!aggregatedData[pid]) {
          aggregatedData[pid] = {
            subject: sub.parent?.name || 'Main Subject',
            marks: null as number | null,
            cq_marks: null as number | null,
            mcq_marks: null as number | null,
            practical_marks: null as number | null,
            full_mark: 0,
            cq_mark: 0,
            mcq_mark: 0,
            practical_mark: 0,
            cq_pass_mark: 0,
            mcq_pass_mark: 0,
            practical_pass_mark: 0,
            pass_mark: 0,
            priority: sub.priority,
            assessment_type: sub.assessment_type,
            marking_scheme: 'TOTAL',
            papers: [],
            isGroup: true,
            subject_id: pid,
          };
        }
        const g = aggregatedData[pid];
        if (mark.marks != null) g.marks = (g.marks ?? 0) + mark.marks;
        if (mark.cq_marks != null) g.cq_marks = (g.cq_marks ?? 0) + mark.cq_marks;
        if (mark.mcq_marks != null) g.mcq_marks = (g.mcq_marks ?? 0) + mark.mcq_marks;
        if (mark.practical_marks != null) {
          g.practical_marks = (g.practical_marks ?? 0) + mark.practical_marks;
        }
        g.full_mark += sub.full_mark || 0;
        g.cq_mark += sub.cq_mark || 0;
        g.mcq_mark += sub.mcq_mark || 0;
        g.practical_mark += sub.practical_mark || 0;
        g.cq_pass_mark += sub.cq_pass_mark || 0;
        g.mcq_pass_mark += sub.mcq_pass_mark || 0;
        g.practical_pass_mark += sub.practical_pass_mark || 0;
        g.pass_mark += sub.pass_mark || 0;
        g.priority = Math.min(g.priority, sub.priority);
        if ((sub as any).marking_scheme === 'BREAKDOWN') {
          g.marking_scheme = 'BREAKDOWN';
        }

        // Push simplified mark data for the paper
        g.papers.push({
          subject: sub.name,
          marks: mark.marks,
          cq_marks: mark.cq_marks,
          mcq_marks: mark.mcq_marks,
          practical_marks: mark.practical_marks,
          full_mark: sub.full_mark,
          highest_mark: mark.highest_mark || 0,
          subject_id: mark.subject_id,
          priority: sub.priority,
        });
      } else {
        finalData.push({
          subject: sub.name,
          marks: mark.marks,
          cq_marks: mark.cq_marks,
          mcq_marks: mark.mcq_marks,
          practical_marks: mark.practical_marks,
          full_mark: sub.full_mark,
          cq_mark: sub.cq_mark,
          mcq_mark: sub.mcq_mark,
          practical_mark: sub.practical_mark,
          cq_pass_mark: sub.cq_pass_mark,
          mcq_pass_mark: sub.mcq_pass_mark,
          practical_pass_mark: sub.practical_pass_mark,
          pass_mark: sub.pass_mark,
          priority: sub.priority,
          assessment_type: sub.assessment_type,
          marking_scheme: (sub as any).marking_scheme,
          isGroup: false,
          highest_mark: mark.highest_mark || 0,
          subject_id: mark.subject_id,
        });
      }
    });

    Object.values(aggregatedData).forEach((g) => {
      // Sort papers within the group by priority
      g.papers.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
      finalData.push(g);
    });

    return finalData.sort((a, b) => {
      if (a.assessment_type === 'exam' && b.assessment_type !== 'exam') return -1;
      if (a.assessment_type !== 'exam' && b.assessment_type === 'exam') return 1;
      return (a.priority || 0) - (b.priority || 0);
    });
  }

  static async generateMarksheetPDF(
    id: string,
    year: string,
    exam: string,
    user: any,
    frozenSignatories?: {
      headId: number | null;
      headRole: string | null;
      teacherId: number | null;
      /** When set, use these instead of live teacher rows (history freeze). */
      detail?: {
        head?: { name: string | null; signature: string | null } | null;
        teacher?: {
          name: string | null;
          signature: string | null;
          phone: string | null;
        } | null;
      } | null;
    },
  ) {
    const result = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: parseInt(id), year: parseInt(year) },
        exam: { exam_name: exam },
      },
      include: {
        enrollment: {
          include: { student: { select: { name: true } } },
        },
        subject: {
          select: {
            name: true,
            priority: true,
            assessment_type: true,
            full_mark: true,
            pass_mark: true,
            cq_mark: true,
            mcq_mark: true,
            practical_mark: true,
            cq_pass_mark: true,
            mcq_pass_mark: true,
            practical_pass_mark: true,
            marking_scheme: true,
            subject_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
        exam: { select: { exam_name: true, result_date: true, return_date: true } },
      },
    });
    if (result.length === 0 || !result.some((m) => m.marks !== null)) {
      throw new Error('No marks found for this student');
    }

    const enrollment = result[0].enrollment;
    const resultDate = result[0].exam?.result_date ?? null;
    const returnDate = result[0].exam?.return_date ?? null;
    if (
      !this.checkAccess(user, parseInt(id), enrollment.class, enrollment.section, parseInt(year))
    ) {
      throw new Error('You are not authorized to download this marksheet');
    }

    const studentName = result[0].enrollment.student.name;
    const studentClass = result[0].enrollment.class;
    const studentRoll = result[0].enrollment.roll;
    const studentSection = result[0].enrollment.section;

    // Class-highest stats come from the exam_class_stats cache (refreshed on
    // every addMarks) instead of rescanning the whole class here.
    const examId = result[0].exam_id;
    const yearInt = parseInt(year);
    const [statsRow, schoolMeta, classSubjects] = await Promise.all([
      prisma.exam_class_stats.findFirst({
        where: { exam_id: examId, class: studentClass, year: yearInt },
      }),
      this.getSchoolMarksheetMeta(),
      this.loadMarksheetSubjects(studentClass, yearInt),
    ]);
    const schoolPhone = schoolMeta.phone;
    const logoBuffer = schoolMeta.logoKey ? await getFileBuffer(schoolMeta.logoKey) : null;

    const filledResult = this.fillMissingSubjectMarks(result, classSubjects, enrollment.group, {
      enrollment_id: enrollment.id,
      exam_id: examId,
      enrollment,
      exam: result[0].exam,
    });

    // Resolve the signatories. For a frozen exam the worker passes the
    // snapshotted ids (+ optional name/signature/phone detail). Detail pins
    // history; without it (legacy rows) we still resolve live-by-id once.
    let teacherRec: {
      id: number | null;
      name: string | null;
      signature: string | null;
      phone: string | null;
    } | null = null;
    if (frozenSignatories) {
      if (frozenSignatories.detail?.teacher) {
        teacherRec =
          frozenSignatories.teacherId != null
            ? {
                id: frozenSignatories.teacherId,
                name: frozenSignatories.detail.teacher.name,
                signature: frozenSignatories.detail.teacher.signature,
                phone: frozenSignatories.detail.teacher.phone,
              }
            : null;
      } else if (frozenSignatories.teacherId != null) {
        const t = await prisma.teachers.findUnique({
          where: { id: frozenSignatories.teacherId },
          select: { id: true, name: true, signature: true, phone: true },
        });
        teacherRec = {
          id: frozenSignatories.teacherId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          phone: t?.phone ?? null,
        };
      } else {
        teacherRec = null;
      }
    } else {
      const level = await prisma.levels.findFirst({
        where: {
          class_name: studentClass,
          section: studentSection,
          year: yearInt,
        },
        include: { teacher: true },
      });
      teacherRec = level
        ? {
            id: level.teacher_id ?? null,
            name: level.teacher?.name ?? null,
            signature: level.teacher?.signature ?? null,
            phone: level.teacher?.phone ?? null,
          }
        : null;
    }

    let headRec: {
      id: number | null;
      name: string | null;
      signature: string | null;
      role: string;
    } | null = null;
    if (frozenSignatories) {
      if (frozenSignatories.detail?.head) {
        headRec =
          frozenSignatories.headId != null
            ? {
                id: frozenSignatories.headId,
                name: frozenSignatories.detail.head.name,
                signature: frozenSignatories.detail.head.signature,
                role: frozenSignatories.headRole ?? 'Headmaster',
              }
            : null;
      } else if (frozenSignatories.headId != null) {
        const t = await prisma.teachers.findUnique({
          where: { id: frozenSignatories.headId },
          select: { name: true, signature: true },
        });
        headRec = {
          id: frozenSignatories.headId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          role: frozenSignatories.headRole ?? 'Headmaster',
        };
      } else {
        headRec = null;
      }
    } else {
      const headMsg = await this.getHeadMsgForMarks();
      headRec = headMsg
        ? {
            id: headMsg.head_id ?? null,
            name: headMsg.teacher?.name ?? null,
            signature: headMsg.teacher?.signature ?? null,
            role: headMsg.head_role ?? 'Headmaster',
          }
        : null;
    }

    const [teacherSignature, headSignature] = await Promise.all([
      teacherRec?.signature ? getFileBuffer(teacherRec.signature) : null,
      headRec?.signature ? getFileBuffer(headRec.signature) : null,
    ]);
    const teacherName = teacherRec?.name ?? null;
    const teacherPhone = teacherRec?.phone ?? null;
    const headName = headRec?.name ?? null;
    const headRole = headRec?.role ?? 'Headmaster';
    const usedTeacherId = teacherRec?.id ?? null;
    const usedHeadId = headRec?.id ?? null;
    const usedHeadRole = headRec?.role ?? null;

    const resolvedStats = await this.resolveStudentClassStats(
      prisma,
      statsRow,
      examId,
      studentClass,
      yearInt,
      enrollment.group,
    );
    const highestMarksMap = resolvedStats.highestBySubject as Record<string, number>;
    const classHighestTotal = resolvedStats.classHighestTotal;
    const classHighestGrandTotal = resolvedStats.classHighestGrandTotal;

    const studentDetails = {
      name: studentName,
      class: studentClass,
      section: studentSection,
      roll: studentRoll,
      year: parseInt(year),
      exam: exam,
      classHighestTotal: classHighestTotal,
      classHighestGrandTotal: classHighestGrandTotal,
      fourth_subject_id: enrollment.fourth_subject_id,
      result_date: resultDate,
      return_date: returnDate,
    };

    const finalTableData = this.aggregatePaperMarks(
      filledResult.map((m) => ({
        ...m,
        highest_mark: highestMarksMap[m.subject_id] || 0,
      })),
    );

    const buffer = await this.renderStudentReportPDF(
      studentDetails,
      finalTableData,
      {
        teacher: teacherSignature,
        teacherName,
        teacherPhone,
        head: headSignature,
        headName,
        headRole,
        schoolPhone,
      },
      schoolMeta,
      logoBuffer,
    );
    return {
      buffer: await this.finalizeMarksheetBuffer(buffer),
      studentName,
      usedHeadId,
      usedHeadRole,
      usedTeacherId,
      usedHeadName: headName,
      usedHeadSignature: headRec?.signature ?? null,
      usedTeacherName: teacherName,
      usedTeacherSignature: teacherRec?.signature ?? null,
      usedTeacherPhone: teacherPhone,
    };
  }

  static async generateAllMarksheetsPDF(
    year: string,
    studentId?: string,
    className?: string,
    examName?: string,
  ) {
    const yearInt = parseInt(year);
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          year: yearInt,
          ...(studentId ? { student_id: parseInt(studentId) } : {}),
          ...(className ? { class: parseInt(className) } : {}),
        },
        ...(examName ? { exam: { exam_name: examName } } : {}),
      },
      include: {
        enrollment: {
          include: { student: { select: { id: true, name: true } } },
        },
        subject: {
          select: {
            id: true,
            name: true,
            priority: true,
            assessment_type: true,
            full_mark: true,
            pass_mark: true,
            cq_mark: true,
            mcq_mark: true,
            practical_mark: true,
            cq_pass_mark: true,
            mcq_pass_mark: true,
            practical_pass_mark: true,
            marking_scheme: true,
            subject_type: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
        exam: {
          select: {
            id: true,
            exam_name: true,
            result_date: true,
            return_date: true,
          },
        },
      },
      orderBy: {
        subject: {
          priority: 'asc',
        },
      },
    });

    if (marks.length === 0) throw new Error('No marks found');

    const classesAffected = Array.from(new Set(marks.map((m) => m.enrollment.class)));
    const examIds = Array.from(new Set(marks.map((m) => m.exam_id)));

    // Highest-per-subject and class-highest-total are read from the
    // exam_class_stats cache (per exam+class). Class 9/10 use group-scoped
    // stats (Science / Commerce / Humanities); other classes stay class-wide.
    const highestMarksMap: Record<string, Record<number, number>> = {};
    const highestMarksMapByGroup: Record<string, Record<string, Record<number, number>>> = {};
    const classHighestTotalByExam: Record<string, number> = {};
    const classHighestGrandTotalByExam: Record<string, number> = {};
    const classHighestTotalByExamAndGroup: Record<string, Record<string, number>> = {};
    const classHighestGrandTotalByExamAndGroup: Record<string, Record<string, number>> = {};

    const mergeStats = (
      examLabel: string,
      highestBySubject: Record<string, number>,
      classHighestTotal: number,
      classHighestGrandTotal: number,
    ) => {
      if (!highestMarksMap[examLabel]) highestMarksMap[examLabel] = {};
      for (const [sid, val] of Object.entries(highestBySubject)) {
        const subjId = Number(sid);
        const v = Number(val || 0);
        if (!highestMarksMap[examLabel][subjId] || v > highestMarksMap[examLabel][subjId]) {
          highestMarksMap[examLabel][subjId] = v;
        }
      }
      if (
        !classHighestTotalByExam[examLabel] ||
        classHighestTotal > classHighestTotalByExam[examLabel]
      ) {
        classHighestTotalByExam[examLabel] = classHighestTotal;
      }
      if (
        !classHighestGrandTotalByExam[examLabel] ||
        classHighestGrandTotal > classHighestGrandTotalByExam[examLabel]
      ) {
        classHighestGrandTotalByExam[examLabel] = classHighestGrandTotal;
      }
    };

    const mergeGroupStats = (examLabel: string, groupName: string, stats: ClassStatsSnapshot) => {
      if (!highestMarksMapByGroup[examLabel]) {
        highestMarksMapByGroup[examLabel] = {};
      }
      if (!highestMarksMapByGroup[examLabel][groupName]) {
        highestMarksMapByGroup[examLabel][groupName] = {};
      }
      for (const [sid, val] of Object.entries(stats.highestBySubject)) {
        const subjId = Number(sid);
        const v = Number(val || 0);
        const bucket = highestMarksMapByGroup[examLabel][groupName];
        if (!bucket[subjId] || v > bucket[subjId]) {
          bucket[subjId] = v;
        }
      }
      if (!classHighestTotalByExamAndGroup[examLabel]) {
        classHighestTotalByExamAndGroup[examLabel] = {};
      }
      classHighestTotalByExamAndGroup[examLabel][groupName] = stats.classHighestTotal;
      if (!classHighestGrandTotalByExamAndGroup[examLabel]) {
        classHighestGrandTotalByExamAndGroup[examLabel] = {};
      }
      classHighestGrandTotalByExamAndGroup[examLabel][groupName] = stats.classHighestGrandTotal;
    };

    const statsRows = await prisma.exam_class_stats.findMany({
      where: {
        exam_id: { in: examIds },
        class: { in: classesAffected },
        year: yearInt,
      },
      include: { exam: { select: { exam_name: true } } },
    });
    for (const row of statsRows) {
      if (this.isGroupedClass(row.class)) {
        const byGroup = row.stats_by_group as StatsByGroup | null;
        if (byGroup && Object.keys(byGroup).length > 0) {
          for (const [groupName, gStats] of Object.entries(byGroup)) {
            mergeGroupStats(row.exam.exam_name, groupName, gStats);
          }
        } else {
          const grouped = await this.computeGroupedClassStatsAll(
            prisma,
            row.exam_id,
            row.class,
            yearInt,
          );
          for (const [groupName, gStats] of Object.entries(grouped.byGroup)) {
            mergeGroupStats(row.exam.exam_name, groupName, gStats);
          }
        }
      } else {
        mergeStats(
          row.exam.exam_name,
          (row.highest_by_subject as Record<string, number>) ?? {},
          row.class_highest_total ?? 0,
          row.class_highest_grand_total ?? 0,
        );
      }
    }

    // Lazy fallback: fill any (exam, class) combo present in the data but
    // missing from the cache (marks predate this feature).
    const combos = new Map<string, { examId: number; klass: number; examName: string }>();
    for (const m of marks) {
      const key = `${m.exam_id}_${m.enrollment.class}`;
      if (!combos.has(key)) {
        combos.set(key, {
          examId: m.exam_id,
          klass: m.enrollment.class,
          examName: m.exam.exam_name,
        });
      }
    }
    const present = new Set(statsRows.map((r) => `${r.exam_id}_${r.class}`));
    for (const c of combos.values()) {
      if (present.has(`${c.examId}_${c.klass}`)) continue;
      if (this.isGroupedClass(c.klass)) {
        const grouped = await this.computeGroupedClassStatsAll(prisma, c.examId, c.klass, yearInt);
        for (const [groupName, gStats] of Object.entries(grouped.byGroup)) {
          mergeGroupStats(c.examName, groupName, gStats);
        }
      } else {
        const s = await this.computeStats(prisma, c.examId, c.klass, yearInt);
        mergeStats(
          c.examName,
          s.highestBySubject as Record<string, number>,
          s.classHighestTotal,
          s.classHighestGrandTotal,
        );
      }
    }

    const studentGrouped: Record<number, Record<string, any[]>> = {};
    const studentInfoMap: Record<number, any> = {};
    const resultDateByExam: Record<string, string | null> = {};
    const returnDateByExam: Record<string, string | null> = {};

    marks.forEach((m) => {
      const sid = m.enrollment.student_id;
      const en = m.exam.exam_name;
      if (!studentGrouped[sid]) studentGrouped[sid] = {};
      if (!studentGrouped[sid][en]) studentGrouped[sid][en] = [];
      studentGrouped[sid][en].push(m);

      if (!(en in resultDateByExam)) {
        resultDateByExam[en] = m.exam?.result_date ?? null;
        returnDateByExam[en] = m.exam?.return_date ?? null;
      }

      if (!studentInfoMap[sid]) {
        studentInfoMap[sid] = {
          name: m.enrollment.student.name,
          class: m.enrollment.class,
          section: m.enrollment.section,
          roll: m.enrollment.roll,
          year: m.enrollment.year,
          group: m.enrollment.group,
          fourth_subject_id: m.enrollment.fourth_subject_id,
        };
      }
    });

    const subjectsByClass = new Map<
      number,
      Awaited<ReturnType<typeof MarksService.loadMarksheetSubjects>>
    >();
    await Promise.all(
      classesAffected.map(async (cls) => {
        subjectsByClass.set(cls, await this.loadMarksheetSubjects(cls, yearInt));
      }),
    );

    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    this.registerMarksheetFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const buffer = await new Promise<Buffer>(async (resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const [headMsg, schoolMeta] = await Promise.all([
        this.getHeadMsgForMarks(),
        this.getSchoolMarksheetMeta(),
      ]);
      const schoolPhone = schoolMeta.phone;
      const logoBuffer = schoolMeta.logoKey ? await getFileBuffer(schoolMeta.logoKey) : null;
      const headSignature = headMsg?.teacher?.signature
        ? await getFileBuffer(headMsg.teacher.signature)
        : null;
      const headName = headMsg?.teacher?.name ?? null;
      const headRole = headMsg?.head_role ?? 'Headmaster';
      const teacherSigs: Record<
        string,
        { signature: Buffer | null; name: string | null; phone: string | null }
      > = {};

      const studentIdsOrdered = Object.keys(studentGrouped)
        .map(Number)
        .sort((a, b) => {
          const sa = studentInfoMap[a];
          const sb = studentInfoMap[b];
          const sectionCmp = String(sa.section ?? '').localeCompare(String(sb.section ?? ''));
          if (sectionCmp !== 0) return sectionCmp;
          if (sa.roll !== sb.roll) return sa.roll - sb.roll;
          return sa.name.localeCompare(sb.name);
        });

      for (let i = 0; i < studentIdsOrdered.length; i++) {
        const sid = studentIdsOrdered[i];
        if (i > 0) doc.addPage();

        const info = studentInfoMap[sid];
        const exams = Object.keys(studentGrouped[sid]);
        const studentGroup = this.normalizeStudentGroup(info.group);
        const isGroupedStudent = this.isGroupedClass(info.class);
        const highestMarkForSubject = (examLabel: string, subjectId: number) => {
          if (isGroupedStudent && studentGroup) {
            return highestMarksMapByGroup[examLabel]?.[studentGroup]?.[subjectId] || 0;
          }
          return highestMarksMap[examLabel]?.[subjectId] || 0;
        };
        const classHighestTotalForExam = (examLabel: string) => {
          if (isGroupedStudent && studentGroup) {
            return classHighestTotalByExamAndGroup[examLabel]?.[studentGroup] || 0;
          }
          return classHighestTotalByExam[examLabel] || 0;
        };
        const classHighestGrandTotalForExam = (examLabel: string) => {
          if (isGroupedStudent && studentGroup) {
            return classHighestGrandTotalByExamAndGroup[examLabel]?.[studentGroup] || 0;
          }
          return classHighestGrandTotalByExam[examLabel] || 0;
        };

        const sigKey = `${info.class}_${info.section}_${info.year}`;
        if (!(sigKey in teacherSigs)) {
          const lv = await prisma.levels.findFirst({
            where: {
              class_name: info.class,
              section: info.section,
              year: info.year,
            },
            include: { teacher: true },
          });
          teacherSigs[sigKey] = {
            signature: lv?.teacher?.signature ? await getFileBuffer(lv.teacher.signature) : null,
            name: lv?.teacher?.name ?? null,
            phone: lv?.teacher?.phone ?? null,
          };
        }
        const teacherSignature = teacherSigs[sigKey].signature;
        const teacherName = teacherSigs[sigKey].name;
        const teacherPhone = teacherSigs[sigKey].phone;

        // Draw page shell
        const classSubjects = subjectsByClass.get(info.class) || [];
        const allExamsTableData = exams.map((en) => {
          const raw = studentGrouped[sid][en] || [];
          const filled = this.fillMissingSubjectMarks(raw, classSubjects, info.group, {
            enrollment_id: raw[0]?.enrollment_id,
            exam_id: raw[0]?.exam_id,
            enrollment: raw[0]?.enrollment,
            exam: raw[0]?.exam,
          });
          return {
            exam: en,
            rows: this.aggregatePaperMarks(
              filled.map((m: any) => ({
                ...m,
                highest_mark: highestMarkForSubject(en, m.subject_id),
              })),
            ),
          };
        });
        const consolidatedQrText = this.buildMarksQrText(info, allExamsTableData);

        const drawPageHeader = async (examDisplayName: string) => {
          this.drawProperBackground(doc);
          await this.drawWatermark(doc, logoBuffer);
          this.drawGradingSystemTable(doc, 425, 75);
          await this.drawProperHeader(
            doc,
            { ...info, exam: examDisplayName },
            schoolMeta,
            consolidatedQrText,
          );
          this.drawProperStudentInfo(doc, info);
        };

        await drawPageHeader('Consolidated Report');
        doc.y = 230;

        for (let j = 0; j < exams.length; j++) {
          const examName = exams[j];
          const rawMarks = studentGrouped[sid][examName] || [];
          const studentMarks = this.fillMissingSubjectMarks(rawMarks, classSubjects, info.group, {
            enrollment_id: rawMarks[0]?.enrollment_id,
            exam_id: rawMarks[0]?.exam_id,
            enrollment: rawMarks[0]?.enrollment,
            exam: rawMarks[0]?.exam,
          });

          const finalTableData = this.aggregatePaperMarks(
            studentMarks.map((m) => ({
              ...m,
              highest_mark: highestMarkForSubject(examName, m.subject_id),
            })),
          );

          // Check for space before rendering this exam's table
          const estimatedHeight = 50 + finalTableData.length * 20 + 40; // title + table + summary
          if (doc.y + estimatedHeight > 750) {
            doc.addPage();
            await drawPageHeader('Consolidated Report (Contd.)');
            doc.y = 230;
          }

          const sX = PDF_STYLES.startX;
          const cW = PDF_STYLES.contentWidth;
          doc.x = sX;
          doc.moveDown(0.5);
          doc
            .fillColor('#000000')
            .font('Times-Bold')
            .fontSize(12)
            .text(`EXAM: ${examName.toUpperCase()}`, {
              align: 'center',
              width: cW,
              underline: true,
            });
          doc.moveDown(0.3);

          const headers = this.useBreakdownLayout(info.class, finalTableData)
            ? [
                'Name of Subjects',
                'CQ',
                'MCQ',
                'PRAC',
                'Total',
                'Letter Grade',
                'Grade Point',
                'Highest Marks',
              ]
            : [
                'Name of Subjects',
                'Obtained Marks',
                'Total',
                'Letter Grade',
                'Grade Point',
                'Highest Marks',
              ];

          const { y: tableY, colWidths } = this.drawProperTable(
            doc,
            doc.y,
            headers,
            finalTableData,
            info.class,
            classHighestTotalForExam(examName),
          );
          const summaryY = await this.drawSummary(
            doc,
            tableY,
            finalTableData,
            info.class,
            classHighestTotalForExam(examName),
            info.fourth_subject_id,
            info.year,
            colWidths,
            resultDateByExam[examName] ?? null,
            classHighestGrandTotalForExam(examName),
            returnDateByExam[examName] ?? null,
          );
          doc.y = summaryY;
        }

        this.drawSignatures(
          doc,
          {
            teacher: teacherSignature,
            teacherName,
            teacherPhone,
            head: headSignature,
            headName,
            headRole,
            schoolPhone,
          },
          doc.y,
        );
      }
      doc.end();
    });
    return this.finalizeMarksheetBuffer(buffer);
  }

  private static async renderStudentMarksheetPage(
    doc: any,
    student: any,
    tableData: any[],
    signatures?: {
      teacher?: Buffer | null;
      teacherName?: string | null;
      teacherPhone?: string | null;
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
      schoolPhone?: string | null;
    },
    schoolMeta?: {
      name?: string | null;
      location?: string | null;
      eiin?: string | null;
      website?: string | null;
      phone?: string | null;
    } | null,
    logoBuffer?: Buffer | null,
  ) {
    this.drawProperBackground(doc);
    await this.drawWatermark(doc, logoBuffer);
    this.drawGradingSystemTable(doc, 425, 75);
    await this.drawProperHeader(
      doc,
      student,
      schoolMeta,
      this.buildMarksQrText(student, [{ exam: student.exam, rows: tableData }]),
    );
    this.drawProperStudentInfo(doc, student);

    const y = doc.y + 5;
    const headers = this.useBreakdownLayout(student.class, tableData)
      ? [
          'Name of Subjects',
          'CQ',
          'MCQ',
          'PRAC',
          'Total',
          'Letter Grade',
          'Grade Point',
          'Highest Marks',
        ]
      : [
          'Name of Subjects',
          'Obtained Marks',
          'Total',
          'Letter Grade',
          'Grade Point',
          'Highest Marks',
        ];

    const { y: finalY, colWidths } = this.drawProperTable(
      doc,
      y,
      headers,
      tableData,
      student.class,
      student.classHighestTotal,
    );

    const tableEndY = await this.drawSummary(
      doc,
      finalY,
      tableData,
      student.class,
      student.classHighestTotal,
      student.fourth_subject_id,
      student.year,
      colWidths,
      student.result_date,
      student.classHighestGrandTotal,
      student.return_date,
    );

    this.drawSignatures(doc, signatures, tableEndY);
  }

  private static async renderStudentReportPDF(
    student: any,
    tableData: any[],
    signatures?: {
      teacher?: Buffer | null;
      teacherName?: string | null;
      teacherPhone?: string | null;
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
      schoolPhone?: string | null;
    },
    schoolMeta?: {
      name?: string | null;
      location?: string | null;
      eiin?: string | null;
      website?: string | null;
      phone?: string | null;
    } | null,
    logoBuffer?: Buffer | null,
  ): Promise<Buffer> {
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    this.registerMarksheetFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      await this.renderStudentMarksheetPage(
        doc,
        student,
        tableData,
        signatures,
        schoolMeta,
        logoBuffer,
      );
      doc.end();
    });
  }

  private static registerMarksheetFonts(doc: any) {
    const regularFont = MARKSHEET_FONT_PATHS.regular.find((fontPath) => fs.existsSync(fontPath));
    const boldFont = MARKSHEET_FONT_PATHS.bold.find((fontPath) => fs.existsSync(fontPath));

    if (regularFont) {
      doc.registerFont(PDF_STYLES.fontRegular, regularFont);
    }
    if (boldFont) {
      doc.registerFont(PDF_STYLES.fontBold, boldFont);
    }
  }

  private static async finalizeMarksheetBuffer(buffer: Buffer): Promise<Buffer> {
    return RASTERIZE_MARKSHEET ? this.convertPdfToImagePdf(buffer) : buffer;
  }

  private static async convertPdfToImagePdf(pdfBuffer: Buffer): Promise<Buffer> {
    const sourcePdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const sourceDocument = await pdf(sourcePdfDataUrl, {
      scale: MARKSHEET_IMAGE_SCALE,
    });
    const doc = new (PDFDocument as any)({
      autoFirstPage: false,
      margin: 0,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        for await (const pageImage of sourceDocument) {
          doc.addPage({ size: A4_PAGE_SIZE, margin: 0 });
          doc.image(pageImage, 0, 0, {
            width: A4_PAGE_SIZE[0],
            height: A4_PAGE_SIZE[1],
          });
        }
        doc.end();
      } catch (error) {
        reject(error);
      } finally {
        sourceDocument.destroy();
      }
    });
  }

  // Class 9/10 marksheets only show CQ/MCQ/PRAC columns when at least one
  // subject actually uses the BREAKDOWN scheme; pure TOTAL data uses the
  // simpler "Obtained Marks" layout like junior classes.
  private static useBreakdownLayout(className: number | undefined, data: any[]): boolean {
    if (className !== 9 && className !== 10) return false;
    return data.some((row: any) => row.marking_scheme === 'BREAKDOWN');
  }

  static async shouldApplyFourthSubjectBonus(className: number, year: number): Promise<boolean> {
    const enrollments = await prisma.student_enrollments.findMany({
      where: {
        class: className,
        year: year,
      },
      select: { fourth_subject_id: true },
    });

    if (enrollments.length === 0) return false;
    return enrollments.every((e) => e.fourth_subject_id !== null);
  }

  static calculateGPA(
    marksData: any[],
    fourthSubjectId: number | null,
    applyBonus: boolean,
    className?: number,
  ) {
    let totalMarks = 0;
    let totalGP = 0;
    let isFailed = false;
    let subjectCount = 0;
    const hasFourthSubject = fourthSubjectId !== null;

    marksData.forEach((row) => {
      if (row.assessment_type === 'exam') {
        const obtained = Number(row.marks);
        const fullMark = Number(row.full_mark || 100);

        if (!Number.isFinite(obtained) || !Number.isFinite(fullMark) || fullMark <= 0) {
          return;
        }

        totalMarks += obtained;
        const percentage = (obtained / fullMark) * 100;

        const isOptional = row.subject_id === fourthSubjectId;

        const grade = this.getGradeByPercentage(percentage, {
          total: row.marks,
          total_pass: row.pass_mark,
          cq: row.cq_marks,
          cq_pass: row.cq_pass_mark,
          mcq: row.mcq_marks,
          mcq_pass: row.mcq_pass_mark,
          pr: row.practical_marks,
          pr_pass: row.practical_pass_mark,
          className: className,
          isOptional: isOptional,
          marking_scheme: row.marking_scheme,
        });

        if (isOptional && applyBonus) {
          // 4th subject logic: Add points above 2.0
          if (grade.gp > 2.0) {
            totalGP += grade.gp - 2.0;
          }
          // 4th subject doesn't increase subjectCount and doesn't cause failure
        } else {
          totalGP += grade.gp;
          if (grade.lg === 'F') isFailed = true;
          subjectCount++;
        }
      }
    });

    let gpaResult = 0.0;
    if (!isFailed) {
      if (!hasFourthSubject) {
        if (className === 6 || className === 7 || className === 8) {
          gpaResult = subjectCount > 0 ? totalGP / subjectCount : 0.0;
        } else {
          // When no 4th subject is provided, apply requested normalization:
          // GPA = (sum of exam-subject GPs - 2) / (exam-subject count - 1)
          gpaResult = subjectCount > 1 ? (totalGP - 2.0) / (subjectCount - 1) : 0.0;
        }
      } else {
        gpaResult = subjectCount > 0 ? totalGP / subjectCount : 0.0;
      }
    }

    return {
      gpa: Math.min(gpaResult, 5.0),
      totalMarks,
      isFailed: isFailed && subjectCount > 0,
    };
  }

  private static async drawSummary(
    doc: any,
    y: number,
    tableData: any[],
    className?: number,
    classHighestTotal?: number,
    fourth_subject_id?: number | null,
    year?: number,
    colWidths?: number[],
    resultDate?: string | null,
    classHighestGrandTotal?: number,
    returnDate?: string | null,
  ) {
    // Grand Total row shows the class-highest grand total (all subjects); fall
    // back to the exam-only highest if the grand value wasn't supplied.
    const grandHighest =
      classHighestGrandTotal !== undefined && classHighestGrandTotal !== null
        ? classHighestGrandTotal
        : classHighestTotal;
    const { startX, contentWidth, rowHeight } = PDF_STYLES;

    const applyBonus =
      className && year ? await this.shouldApplyFourthSubjectBonus(className, year) : false;

    const { gpa } = this.calculateGPA(tableData, fourth_subject_id ?? null, applyBonus, className);
    const grandTotalMarks = tableData.reduce((sum: number, row: any) => {
      const marks = Number(row.marks || 0);
      return Number.isFinite(marks) ? sum + marks : sum;
    }, 0);

    // If any key numeric is invalid, skip rendering the summary row entirely
    if (
      !Number.isFinite(gpa) ||
      !Number.isFinite(grandTotalMarks) ||
      (classHighestTotal !== undefined &&
        classHighestTotal !== null &&
        !Number.isFinite(classHighestTotal))
    ) {
      return y + 20;
    }

    const isBreakdown = this.useBreakdownLayout(className, tableData);
    // Use passed colWidths or fall back to calculation if not provided
    let actualColWidths = colWidths;
    if (!actualColWidths) {
      const { fontBold, headerFontSize } = PDF_STYLES;
      doc.font(fontBold).fontSize(headerFontSize);
      const headers = isBreakdown
        ? [
            'Name of Subjects',
            'CQ',
            'MCQ',
            'PRAC',
            'Total',
            'Letter Grade',
            'Grade Point',
            'Highest Marks',
          ]
        : [
            'Name of Subjects',
            'Obtained Marks',
            'Total',
            'Letter Grade',
            'Grade Point',
            'Highest Marks',
          ];
      const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
      const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
      actualColWidths = [contentWidth - usedWidth, ...otherColWidths];
    }

    const totalTableWidth = actualColWidths.reduce((a, b) => a + b, 0);

    // --- Render Column-Aligned Single Summary Row ---
    const rowY = y; // Remove the gap
    doc.lineWidth(0.5).rect(startX, rowY, totalTableWidth, rowHeight).stroke('#000000');

    if (isBreakdown) {
      // Breakdown (8 cols): Subj(0), CQ(1), MCQ(2), PRAC(3), Total(4), LG(5), GP(6), High(7)
      // Merge 0-3 for Grand Total Label, Val in 4
      const w03 = actualColWidths[0] + actualColWidths[1] + actualColWidths[2] + actualColWidths[3];
      this.drawDynamicText(doc, 'Grand Total Marks', startX + 5, rowY, w03 - 10, rowHeight, {
        align: 'right',
        bold: true,
      });
      doc
        .moveTo(startX + w03, rowY)
        .lineTo(startX + w03, rowY + rowHeight)
        .stroke();

      const x4 = startX + w03;
      this.drawDynamicText(doc, String(grandTotalMarks), x4, rowY, actualColWidths[4], rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x4 + actualColWidths[4], rowY)
        .lineTo(x4 + actualColWidths[4], rowY + rowHeight)
        .stroke();

      const x5 = x4 + actualColWidths[4];
      this.drawDynamicText(doc, 'GPA', x5 + 5, rowY, actualColWidths[5] - 10, rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x5 + actualColWidths[5], rowY)
        .lineTo(x5 + actualColWidths[5], rowY + rowHeight)
        .stroke();

      const x6 = x5 + actualColWidths[5];
      this.drawDynamicText(doc, gpa.toFixed(2), x6, rowY, actualColWidths[6], rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x6 + actualColWidths[6], rowY)
        .lineTo(x6 + actualColWidths[6], rowY + rowHeight)
        .stroke();

      const x7 = x6 + actualColWidths[6];
      this.drawDynamicText(
        doc,
        `${grandHighest || '-'}`,
        x7 + 2,
        rowY,
        actualColWidths[7] - 4,
        rowHeight,
        { align: 'center', bold: true },
      );
    } else {
      // Standard (6 cols): Subj(0), Obt(1), Total(2), LG(3), GP(4), High(5)
      // Merge 0-1 for Grand Total Label, Val in 2
      const w01 = actualColWidths[0] + actualColWidths[1];
      this.drawDynamicText(doc, 'Grand Total Marks', startX + 5, rowY, w01 - 10, rowHeight, {
        align: 'right',
        bold: true,
      });
      doc
        .moveTo(startX + w01, rowY)
        .lineTo(startX + w01, rowY + rowHeight)
        .stroke();

      const x2 = startX + w01;
      this.drawDynamicText(doc, String(grandTotalMarks), x2, rowY, actualColWidths[2], rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x2 + actualColWidths[2], rowY)
        .lineTo(x2 + actualColWidths[2], rowY + rowHeight)
        .stroke();

      const x3 = x2 + actualColWidths[2]; // Column 3 (LG)
      this.drawDynamicText(doc, 'GPA', x3, rowY, actualColWidths[3], rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x3 + actualColWidths[3], rowY)
        .lineTo(x3 + actualColWidths[3], rowY + rowHeight)
        .stroke();

      const x4 = x3 + actualColWidths[3]; // Column 4 (GP)
      this.drawDynamicText(doc, gpa.toFixed(2), x4, rowY, actualColWidths[4], rowHeight, {
        align: 'center',
        bold: true,
      });
      doc
        .moveTo(x4 + actualColWidths[4], rowY)
        .lineTo(x4 + actualColWidths[4], rowY + rowHeight)
        .stroke();

      const x5 = x4 + actualColWidths[4]; // Column 5 (Highest)
      this.drawDynamicText(doc, `${grandHighest || '-'}`, x5, rowY, actualColWidths[5], rowHeight, {
        align: 'center',
        bold: true,
      });
    }

    let endY = rowY + rowHeight;
    const formattedResultDate = formatMarksheetDate(resultDate);
    if (formattedResultDate) {
      const dateY = endY + 8;
      doc.font(PDF_STYLES.fontRegular).fontSize(PDF_STYLES.rowFontSize).fillColor('#000000');
      doc.text(`Date of result published: ${formattedResultDate}.`, startX, dateY, {
        width: contentWidth,
        align: 'left',
      });
      endY = dateY + (returnDate ? 13 : PDF_STYLES.rowHeight);
    }

    const formattedReturnDate = formatMarksheetDate(returnDate);
    if (formattedReturnDate) {
      const returnY = endY + 2;
      doc.font(PDF_STYLES.fontRegular).fontSize(PDF_STYLES.rowFontSize).fillColor('#000000');
      doc.text(
        `This academic transcript (mark sheet) must be returned by ${formattedReturnDate}.`,
        startX,
        returnY,
        { width: contentWidth, align: 'left' },
      );
      const correctionsY = returnY + 13;
      doc.text('Please contact the class teacher for any corrections.', startX, correctionsY, {
        width: contentWidth,
        align: 'left',
      });
      endY = correctionsY + PDF_STYLES.rowHeight;
    }

    return endY;
  }

  private static drawFittedCenteredText(
    doc: any,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: { fontSize?: number; minFontSize?: number; font?: string } = {},
  ) {
    const maxFontSize = options.fontSize ?? 10;
    const minFontSize = options.minFontSize ?? 7;
    const font = options.font ?? 'Times-Roman';

    let fontSize = maxFontSize;
    doc.font(font).fillColor('#000000');

    while (fontSize > minFontSize && doc.fontSize(fontSize).widthOfString(text) > maxWidth) {
      fontSize--;
    }

    doc.fontSize(fontSize);
    const textWidth = doc.widthOfString(text);

    if (textWidth <= maxWidth) {
      doc.text(text, x + (maxWidth - textWidth) / 2, y, { lineBreak: false });
      return;
    }

    const scaleX = maxWidth / textWidth;
    doc.save();
    doc.translate(x + maxWidth / 2, y);
    doc.scale(scaleX, 1);
    doc.text(text, -textWidth / 2, 0, { lineBreak: false });
    doc.restore();
  }

  private static drawSignatures(
    doc: any,
    signatures?: {
      teacher?: Buffer | null;
      teacherName?: string | null;
      teacherPhone?: string | null;
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
      schoolPhone?: string | null;
    },
    tableEndY?: number,
  ) {
    doc.fontSize(10).font('Times-Bold').fillColor('#000000');

    let lineY =
      tableEndY !== undefined
        ? tableEndY + SIGNATURE_GAP_AFTER_TABLE
        : PAGE_CONTENT_BOTTOM - SIGNATURE_BLOCK_HEIGHT;

    if (lineY + SIGNATURE_BLOCK_HEIGHT > PAGE_CONTENT_BOTTOM) {
      doc.addPage();
      this.drawProperBackground(doc);
      lineY = 100;
    }

    const textY = lineY + 8;
    const guardianStartX = 65;
    const guardianLineWidth = 95;
    const teacherStartX = 252.5;
    const teacherLineWidth = 115;
    const headStartX = 430;
    const headLineWidth = 115;

    // Dotted lines for signatures
    doc.lineWidth(0.5).dash(1, { space: 1 });

    // Render Teacher signature if provided
    if (signatures?.teacher) {
      try {
        doc.image(
          signatures.teacher,
          teacherStartX + (teacherLineWidth - SIGNATURE_IMAGE_WIDTH) / 2,
          lineY - SIGNATURE_IMAGE_MAX_HEIGHT,
          {
            fit: [SIGNATURE_IMAGE_WIDTH, SIGNATURE_IMAGE_MAX_HEIGHT],
            align: 'center',
            valign: 'bottom',
          },
        );
      } catch (err) {
        console.error('Teacher signature image error:', err);
      }
    }

    // Render Headmaster signature if provided
    if (signatures?.head) {
      try {
        doc.image(
          signatures.head,
          headStartX + (headLineWidth - SIGNATURE_IMAGE_WIDTH) / 2,
          lineY - SIGNATURE_IMAGE_MAX_HEIGHT,
          {
            fit: [SIGNATURE_IMAGE_WIDTH, SIGNATURE_IMAGE_MAX_HEIGHT],
            align: 'center',
            valign: 'bottom',
          },
        );
      } catch (err) {
        console.error('Head signature image error:', err);
      }
    }

    const drawNameAndRole = (
      x: number,
      name: string | null | undefined,
      role: string,
      width: number,
      phone?: string | null,
    ) => {
      doc.fillColor('#000000').fontSize(10);

      if (name) {
        this.drawFittedCenteredText(doc, name, x, textY, width, {
          fontSize: 10,
          font: 'Times-Roman',
        });
        this.drawFittedCenteredText(doc, role, x, textY + 12, width, {
          fontSize: 10,
          minFontSize: 8,
          font: 'Times-Roman',
        });
        if (phone) {
          this.drawFittedCenteredText(doc, phone, x, textY + 24, width, {
            fontSize: 9,
            minFontSize: 7,
            font: 'Times-Roman',
          });
        }
        return;
      }

      this.drawFittedCenteredText(doc, role, x, textY, width, {
        fontSize: 10,
        font: 'Times-Roman',
      });
      if (phone) {
        this.drawFittedCenteredText(doc, phone, x, textY + 12, width, {
          fontSize: 9,
          minFontSize: 7,
          font: 'Times-Roman',
        });
      }
    };

    doc
      .moveTo(guardianStartX, lineY)
      .lineTo(guardianStartX + guardianLineWidth, lineY)
      .stroke();
    this.drawFittedCenteredText(
      doc,
      "Guardian's Signature",
      guardianStartX,
      textY,
      guardianLineWidth,
      {
        fontSize: 10,
        font: 'Times-Bold',
      },
    );

    doc
      .moveTo(teacherStartX, lineY)
      .lineTo(teacherStartX + teacherLineWidth, lineY)
      .stroke();
    drawNameAndRole(
      teacherStartX,
      signatures?.teacherName,
      'Class Teacher',
      teacherLineWidth,
      signatures?.teacherPhone,
    );

    doc
      .moveTo(headStartX, lineY)
      .lineTo(headStartX + headLineWidth, lineY)
      .stroke();
    drawNameAndRole(
      headStartX,
      signatures?.headName,
      signatures?.headRole ?? 'Headmaster',
      headLineWidth,
    );

    doc.undash();
  }

  private static drawProperBackground(doc: any) {
    doc.rect(20, 20, 555, 802).lineWidth(2).stroke('#000000');
    doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke('#666666');
  }

  private static normalizeSchoolWebsite(customDomain?: string | null): string | null {
    const raw = customDomain?.trim() || '';
    if (!raw) return null;

    try {
      if (/^https?:\/\//i.test(raw)) {
        return new URL(raw).hostname || null;
      }
      return raw.replace(/\/+$/, '').replace(/:\d+$/, '').toLowerCase();
    } catch {
      const cleaned = raw
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        ?.replace(/:\d+$/, '');
      return cleaned || null;
    }
  }

  /** Header/watermark fields drawn on every marksheet page. */
  private static async getSchoolMarksheetMeta(): Promise<{
    name: string | null;
    location: string | null;
    eiin: string | null;
    website: string | null;
    phone: string | null;
    logoKey: string | null;
    logoEtag: string | null;
  }> {
    const empty = {
      name: null,
      location: null,
      eiin: null,
      website: null,
      phone: null,
      logoKey: null,
      logoEtag: null,
    };
    const schoolId = getRlsContext()?.schoolId;
    if (!schoolId) return empty;
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        upazila: true,
        district: true,
        address: true,
        eiin: true,
        customDomain: true,
        phone: true,
        logo: true,
      },
    });
    if (!school) return empty;
    const place = [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', ');
    const logoKey = school.logo || null;
    return {
      name: school.name?.trim() || null,
      location: place || school.address?.trim() || null,
      eiin: school.eiin?.trim() || null,
      website: this.normalizeSchoolWebsite(school.customDomain),
      phone: school.phone?.trim() || null,
      logoKey,
      logoEtag: logoKey ? await headObjectEtag(logoKey) : null,
    };
  }

  private static async getHeadMsgForMarks() {
    const schoolId = getRlsContext()?.schoolId;
    return prisma.head_msg.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: 'desc' },
      include: { teacher: true },
    });
  }

  private static buildMarksQrText(
    student: any,
    exams: { exam?: string | null; rows: any[] }[],
  ): string {
    const lines = [
      `Name: ${student.name ?? ''}`,
      `Class: ${student.class ?? ''}`,
      `Section: ${student.section ?? ''}`,
      `Roll: ${student.roll ?? ''}`,
      `Year: ${student.year ?? ''}`,
    ];

    for (const examBlock of exams) {
      if (examBlock.exam) {
        lines.push(`Exam: ${examBlock.exam}`);
      }
      for (const row of examBlock.rows || []) {
        const subject = row.subject ?? 'Subject';
        const marks = row.marks ?? '-';
        lines.push(`${subject}: ${marks}`);
      }
    }

    return lines.join('\n');
  }

  private static async drawProperHeader(
    doc: any,
    exam?: any,
    school?: {
      name?: string | null;
      location?: string | null;
      eiin?: string | null;
      website?: string | null;
      phone?: string | null;
    } | null,
    qrText?: string | null,
  ) {
    // Mirror grading chart (x=425, y=75, w=120): QR on left, same top
    // Align QR left edge with marks table (PDF_STYLES.startX = 50)
    const qrSize = 85;
    const qrX = PDF_STYLES.startX;
    const qrY = 75;
    // Center header text on the full content width (same band as school name),
    // not the asymmetric gap between QR and grading chart.
    const pageHeaderX = PDF_STYLES.startX;
    const pageHeaderWidth = PDF_STYLES.contentWidth;

    // Top line spans full page — above side widgets
    doc
      .font('Times-Bold')
      .fontSize(10)
      .text("Government of the People's Republic of Bangladesh", pageHeaderX, 40, {
        align: 'center',
        width: pageHeaderWidth,
      });

    const schoolName = school?.name?.trim() || 'School Name';
    const maxWidth = pageHeaderWidth - 4;
    let fontSize = 15;
    doc.font('Times-Bold');
    while (doc.fontSize(fontSize).widthOfString(schoolName) > maxWidth && fontSize > 8) {
      fontSize--;
    }
    doc
      .fontSize(fontSize)
      .text(schoolName, pageHeaderX, 55, { align: 'center', width: pageHeaderWidth });

    if (qrText) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrText, {
          margin: 1,
          width: 260,
          errorCorrectionLevel: 'M',
        });
        doc.image(qrDataUrl, qrX, qrY, { width: qrSize });
      } catch (err) {
        console.error('Marksheet QR code error:', err);
      }
    }

    const location = school?.location?.trim() || '';
    if (location) {
      doc.font('Times-Bold').fontSize(11).text(location, pageHeaderX, 75, {
        align: 'center',
        width: pageHeaderWidth,
      });
    }

    doc.font('Times-Bold').fontSize(10);
    const websiteStr = school?.website?.trim() || '';
    const headerOffset = websiteStr ? 14 : 0;

    if (websiteStr) {
      const host = websiteStr.replace(/^https?:\/\//, '');
      const websiteUrl = /^https?:\/\//i.test(websiteStr)
        ? websiteStr.replace(/\/+$/, '')
        : `https://${host}`;
      doc.text(websiteUrl, pageHeaderX, 90, {
        align: 'center',
        width: pageHeaderWidth,
      });
    }

    const infoBits: string[] = [];
    if (school?.eiin) infoBits.push(`EIIN: ${school.eiin}`);
    if (school?.phone) infoBits.push(`Phone: ${school.phone}`);
    const infoText = infoBits.join(', ');
    if (infoText) {
      doc.text(infoText, pageHeaderX, 90 + headerOffset, {
        align: 'center',
        width: pageHeaderWidth,
      });
    }

    if (exam && (exam.exam || exam.year)) {
      const examName = exam.exam || '';
      const session = exam.year ? String(exam.year) : '';
      const headerText = examName && session ? `${examName} ${session}` : examName || session;

      doc
        .fillColor('#000000')
        .font('Times-Bold')
        .fontSize(14)
        .text(headerText, pageHeaderX, 105 + headerOffset, {
          align: 'center',
          width: pageHeaderWidth,
        });
    }

    const titleW = 200;
    const titleX = pageHeaderX + (pageHeaderWidth - titleW) / 2;
    doc
      .rect(titleX, 128 + headerOffset, titleW, 25)
      .fill('#f3f4f6')
      .stroke('#000000');
    doc
      .fillColor('#000000')
      .font('Times-Bold')
      .fontSize(14)
      .text('ACADEMIC TRANSCRIPT', titleX, 135 + headerOffset, {
        align: 'center',
        width: titleW,
      });
  }

  private static async drawWatermark(doc: any, logoBuffer?: Buffer | null) {
    let image: Buffer | string | null = logoBuffer ?? null;
    if (!image) {
      const logoPath = path.join('public', 'icon.jpg');
      if (fs.existsSync(logoPath)) image = logoPath;
    }
    if (!image) return;
    try {
      const grayscaleBuffer = await sharp(image).grayscale().toBuffer();
      doc.save();
      doc.opacity(0.1);
      doc.image(grayscaleBuffer, 150, 236, { width: 300 });
      doc.restore();
    } catch (e) {
      doc.save();
      doc.opacity(0.1);
      doc.image(image, 150, 236, { width: 300 });
      doc.restore();
    }
  }

  private static getClassText(classNum: number | string): string {
    const classMap: Record<string, string> = {
      '6': 'Six',
      '7': 'Seven',
      '8': 'Eight',
      '9': 'Nine',
      '10': 'Ten',
    };
    return classMap[String(classNum)] || String(classNum);
  }

  private static drawProperStudentInfo(doc: any, student: any) {
    const startY = 185;
    const lineHeight = 18;
    doc.fillColor('#000000');

    // Row 1: Student's Name
    this.drawDynamicText(doc, "Student's Name:", 50, startY, 100, lineHeight, {
      fontSize: 11,
      bold: true,
    });
    this.drawDynamicText(doc, student.name, 150, startY, 350, lineHeight, {
      fontSize: 11,
      font: 'Times-Roman',
    });

    // Row 2: Class, Section, Roll No
    const row2Y = startY + lineHeight;

    // Class
    this.drawDynamicText(doc, 'Class:', 50, row2Y, 50, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, this.getClassText(student.class), 100, row2Y, 90, lineHeight, {
      fontSize: 11,
      font: 'Times-Roman',
    });

    // Section
    this.drawDynamicText(doc, 'Section:', 230, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, student.section || '-', 290, row2Y, 50, lineHeight, {
      fontSize: 11,
      font: 'Times-Roman',
    });

    // Roll No
    this.drawDynamicText(doc, 'Roll No:', 350, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, String(student.roll || '-'), 410, row2Y, 50, lineHeight, {
      fontSize: 11,
      font: 'Times-Roman',
    });
  }

  static getGradeByPercentage(
    percentage: number,
    breakdown?: {
      total?: number;
      total_pass?: number;
      cq?: number;
      cq_pass?: number;
      mcq?: number;
      mcq_pass?: number;
      pr?: number;
      pr_pass?: number;
      className?: number;
      isOptional?: boolean;
      marking_scheme?: string;
    },
  ) {
    if (
      breakdown &&
      (breakdown.className === 9 || breakdown.className === 10) &&
      !breakdown.isOptional
    ) {
      // Component-wise pass checks only apply to BREAKDOWN subjects;
      // TOTAL subjects store null CQ/MCQ/PRAC marks which would wrongly read as 0.
      if (
        breakdown.marking_scheme === 'BREAKDOWN' &&
        ((breakdown.cq_pass && (breakdown.cq || 0) < (breakdown.cq_pass || 0)) ||
          (breakdown.mcq_pass && (breakdown.mcq || 0) < (breakdown.mcq_pass || 0)) ||
          (breakdown.pr_pass && (breakdown.pr || 0) < (breakdown.pr_pass || 0)))
      ) {
        return { lg: 'F', gp: 0.0 };
      }
    }

    // Pass mark is an absolute mark, so compare it against obtained marks,
    // not the percentage (they only coincide when full mark is 100).
    if (
      breakdown?.total !== undefined &&
      breakdown?.total !== null &&
      breakdown?.total_pass !== undefined &&
      breakdown?.total_pass !== null &&
      Number(breakdown.total) < Number(breakdown.total_pass)
    ) {
      return { lg: 'F', gp: 0.0 };
    }

    if (percentage < 33) {
      return { lg: 'F', gp: 0.0 };
    }

    if (percentage >= 80) return { lg: 'A+', gp: 5.0 };
    if (percentage >= 70) return { lg: 'A', gp: 4.0 };
    if (percentage >= 60) return { lg: 'A-', gp: 3.5 };
    if (percentage >= 50) return { lg: 'B', gp: 3.0 };
    if (percentage >= 40) return { lg: 'C', gp: 2.0 };
    if (percentage >= 33) return { lg: 'D', gp: 1.0 };
    return { lg: 'F', gp: 0.0 };
  }

  private static formatSubjectWithFullMark(subject: string, fullMark?: number | null): string {
    if (fullMark !== undefined && fullMark !== null && fullMark > 0) {
      return `${subject} (${fullMark})`;
    }
    return subject;
  }

  private static drawProperTable(
    doc: any,
    y: number,
    headers: string[],
    data: any[],
    className?: number,
    classHighestTotal?: number,
  ) {
    const { startX, contentWidth, rowHeight, headerFontSize, rowFontSize, fontBold, fontRegular } =
      PDF_STYLES;
    const isBreakdown = this.useBreakdownLayout(className, data);

    doc.font(fontBold).fontSize(headerFontSize);
    const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
    const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
    const subjectWidth = Math.max(100, contentWidth - usedWidth);
    const colWidths = [subjectWidth, ...otherColWidths];

    doc
      .fillAndStroke('#f3f4f6', '#000000')
      .lineWidth(0.5)
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke();
    doc.fillColor('#000000').font(fontBold).fontSize(headerFontSize);

    let currentX = startX;
    headers.forEach((h, i) => {
      this.drawDynamicText(doc, h, currentX + 5, y, colWidths[i] - 10, rowHeight, {
        fontSize: headerFontSize,
        align: i === 0 ? 'left' : 'center',
        bold: true,
      });
      if (i < headers.length - 1) {
        doc
          .moveTo(currentX + colWidths[i], y)
          .lineTo(currentX + colWidths[i], y + rowHeight)
          .stroke();
      }
      currentX += colWidths[i];
    });

    y += rowHeight;
    doc.font(fontRegular).fontSize(rowFontSize);

    const drawExamSubjectsTotalRow = () => {
      const examRows = data.filter((row: any) => row.assessment_type === 'exam');
      if (examRows.length === 0) return;

      const examTotalMarks = examRows.reduce(
        (sum: number, row: any) => sum + Number(row.marks || 0),
        0,
      );

      if (y + rowHeight > 750) {
        doc.addPage();
        this.drawProperBackground(doc);
        y = 50;
      }

      doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke('#000000');

      if (isBreakdown) {
        const w03 = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
        this.drawDynamicText(doc, 'Total Marks', startX + 5, y, w03 - 10, rowHeight, {
          align: 'right',
          bold: true,
          fontSize: rowFontSize,
        });
        doc
          .moveTo(startX + w03, y)
          .lineTo(startX + w03, y + rowHeight)
          .stroke();

        const x4 = startX + w03;
        this.drawDynamicText(doc, String(examTotalMarks), x4, y, colWidths[4], rowHeight, {
          align: 'center',
          bold: true,
          fontSize: rowFontSize,
        });
        doc
          .moveTo(x4 + colWidths[4], y)
          .lineTo(x4 + colWidths[4], y + rowHeight)
          .stroke();

        const x5 = x4 + colWidths[4];
        doc
          .moveTo(x5 + colWidths[5], y)
          .lineTo(x5 + colWidths[5], y + rowHeight)
          .stroke();

        const x6 = x5 + colWidths[5];
        doc
          .moveTo(x6 + colWidths[6], y)
          .lineTo(x6 + colWidths[6], y + rowHeight)
          .stroke();

        const x7 = x6 + colWidths[6];
        this.drawDynamicText(
          doc,
          `${classHighestTotal ?? '-'}`,
          x7 + 2,
          y,
          colWidths[7] - 4,
          rowHeight,
          { align: 'center', bold: true, fontSize: rowFontSize },
        );
      } else {
        const w01 = colWidths[0] + colWidths[1];
        this.drawDynamicText(doc, 'Total Marks', startX + 5, y, w01 - 10, rowHeight, {
          align: 'right',
          bold: true,
          fontSize: rowFontSize,
        });
        doc
          .moveTo(startX + w01, y)
          .lineTo(startX + w01, y + rowHeight)
          .stroke();

        const x2 = startX + w01;
        this.drawDynamicText(doc, String(examTotalMarks), x2, y, colWidths[2], rowHeight, {
          align: 'center',
          bold: true,
          fontSize: rowFontSize,
        });
        doc
          .moveTo(x2 + colWidths[2], y)
          .lineTo(x2 + colWidths[2], y + rowHeight)
          .stroke();

        const x3 = x2 + colWidths[2];
        doc
          .moveTo(x3 + colWidths[3], y)
          .lineTo(x3 + colWidths[3], y + rowHeight)
          .stroke();

        const x4 = x3 + colWidths[3];
        doc
          .moveTo(x4 + colWidths[4], y)
          .lineTo(x4 + colWidths[4], y + rowHeight)
          .stroke();

        const x5 = x4 + colWidths[4];
        this.drawDynamicText(doc, `${classHighestTotal ?? '-'}`, x5, y, colWidths[5], rowHeight, {
          align: 'center',
          bold: true,
          fontSize: rowFontSize,
        });
      }

      y += rowHeight;
      doc.font(fontRegular).fontSize(rowFontSize);
    };

    let lastType = 'exam';
    let examTotalDrawn = false;
    data.forEach((row: any) => {
      if (row.assessment_type !== lastType) {
        if (lastType === 'exam' && row.assessment_type === 'continuous' && !examTotalDrawn) {
          drawExamSubjectsTotalRow();
          examTotalDrawn = true;
        }
        lastType = row.assessment_type;

        // Nudge label down so it sits closer to the continuous assessment table.
        const caLabelNudge = 6;
        const caLabelFontSize = headerFontSize + 1;
        doc.font(fontBold).fontSize(caLabelFontSize).fillColor('#000000');
        this.drawDynamicText(
          doc,
          'Continuous assessment',
          startX,
          y + caLabelNudge,
          contentWidth,
          rowHeight - caLabelNudge,
          {
            align: 'center',
            bold: true,
            fontSize: caLabelFontSize,
          },
        );
        doc.fillColor('#000000').font(fontRegular).fontSize(rowFontSize);
        y += rowHeight;
      }

      const rowCount = row.isGroup && row.papers ? row.papers.length : 1;
      const totalHeight = rowCount * rowHeight;

      if (y + totalHeight > 750) {
        doc.addPage();
        this.drawProperBackground(doc);
        y = 50;
      }

      doc.lineWidth(0.5).rect(startX, y, contentWidth, totalHeight).stroke();

      if (row.isGroup) {
        row.papers.forEach((paper: any, pIdx: number) => {
          const py = y + pIdx * rowHeight;
          if (pIdx > 0) {
            const hLineEnd = isBreakdown
              ? startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
              : startX + colWidths[0] + colWidths[1];
            doc.moveTo(startX, py).lineTo(hLineEnd, py).stroke();

            // Also draw horizontal line for the "Highest" column
            const highestStart = isBreakdown
              ? startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4] +
                colWidths[5] +
                colWidths[6]
              : startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];

            doc
              .moveTo(highestStart, py)
              .lineTo(startX + contentWidth, py)
              .stroke();
          }

          this.drawDynamicText(
            doc,
            this.formatSubjectWithFullMark(paper.subject, paper.full_mark),
            startX + 5,
            py,
            colWidths[0] - 10,
            rowHeight,
            { fontSize: rowFontSize },
          );
          if (isBreakdown) {
            this.drawDynamicText(
              doc,
              paper.cq_marks ?? '-',
              startX + colWidths[0] + 5,
              py,
              colWidths[1] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );
            this.drawDynamicText(
              doc,
              paper.mcq_marks ?? '-',
              startX + colWidths[0] + colWidths[1] + 5,
              py,
              colWidths[2] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );
            this.drawDynamicText(
              doc,
              paper.practical_marks ?? '-',
              startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
              py,
              colWidths[3] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );
            // Render Highest Mark for paper in breakdown
            this.drawDynamicText(
              doc,
              paper.highest_mark ? String(paper.highest_mark) : '-',
              startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4] +
                colWidths[5] +
                colWidths[6] +
                5,
              py,
              colWidths[7] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );
          } else {
            this.drawDynamicText(
              doc,
              paper.marks ?? '-',
              startX + colWidths[0] + 5,
              py,
              colWidths[1] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );

            // DO NOT draw full_mark in Column 2 for junior groups to avoid overlap with spanned obtained total
            // (Full marks are already included in parenthesized subject name)

            // Render Highest Mark for paper in standard (Column 5)
            this.drawDynamicText(
              doc,
              paper.highest_mark ? String(paper.highest_mark) : '-',
              startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5,
              py,
              colWidths[5] - 10,
              rowHeight,
              {
                fontSize: rowFontSize,
                align: 'center',
              },
            );
          }
        });

        let vx = startX;
        const middleStart = isBreakdown ? 4 : 2;
        for (let i = 0; i < middleStart; i++) {
          vx += colWidths[i];
          doc
            .moveTo(vx, y)
            .lineTo(vx, y + totalHeight)
            .stroke();
        }

        vx = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          vx += colWidths[i];
          if (i >= middleStart - 1) {
            doc
              .moveTo(vx, y)
              .lineTo(vx, y + totalHeight)
              .stroke();
          }
        }

        const mx = startX + colWidths.slice(0, middleStart).reduce((a, b) => a + b, 0);
        const fullMark = Number(row.full_mark);
        const hasMarks = row.marks !== null && row.marks !== undefined;
        const grade = hasMarks
          ? this.getGradeByPercentage((row.marks / fullMark) * 100, {
              total: row.marks,
              total_pass: row.pass_mark,
              cq: row.cq_marks,
              cq_pass: row.cq_pass_mark,
              mcq: row.mcq_marks,
              mcq_pass: row.mcq_pass_mark,
              pr: row.practical_marks,
              pr_pass: row.practical_pass_mark,
              marking_scheme: row.marking_scheme,
            })
          : { lg: '-', gp: NaN };

        this.drawDynamicText(
          doc,
          row.marks ?? '-',
          mx + 5,
          y,
          colWidths[middleStart] - 10,
          totalHeight,
          {
            fontSize: rowFontSize,
            align: 'center',
          },
        );
        this.drawDynamicText(
          doc,
          grade.lg,
          mx + colWidths[middleStart] + 5,
          y,
          colWidths[middleStart + 1] - 10,
          totalHeight,
          {
            fontSize: rowFontSize,
            align: 'center',
          },
        );
        this.drawDynamicText(
          doc,
          Number.isFinite(grade.gp) ? grade.gp.toFixed(2) : '-',
          mx + colWidths[middleStart] + colWidths[middleStart + 1] + 5,
          y,
          colWidths[middleStart + 2] - 10,
          totalHeight,
          {
            fontSize: rowFontSize,
            align: 'center',
          },
        );

        y += totalHeight;
      } else {
        let vx = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          vx += colWidths[i];
          doc
            .moveTo(vx, y)
            .lineTo(vx, y + rowHeight)
            .stroke();
        }

        const fullMark = Number(row.full_mark || 100);
        const hasMarks = row.marks !== null && row.marks !== undefined;
        const grade = hasMarks
          ? this.getGradeByPercentage((row.marks / fullMark) * 100, {
              total: row.marks,
              total_pass: row.pass_mark,
              cq: row.cq_marks,
              cq_pass: row.cq_pass_mark,
              mcq: row.mcq_marks,
              mcq_pass: row.mcq_pass_mark,
              pr: row.practical_marks,
              pr_pass: row.practical_pass_mark,
              className: className,
              marking_scheme: row.marking_scheme,
            })
          : { lg: '-', gp: NaN };

        let cols: string[] = [];
        if (isBreakdown) {
          cols = [
            this.formatSubjectWithFullMark(row.subject, row.full_mark),
            String(row.cq_marks ?? '-'),
            String(row.mcq_marks ?? '-'),
            String(row.practical_marks ?? '-'),
            String(row.marks ?? '-'),
            grade.lg,
            Number.isFinite(grade.gp) ? grade.gp.toFixed(2) : '-',
            row.highest_mark ? String(row.highest_mark) : '-',
          ];
        } else {
          cols = [
            this.formatSubjectWithFullMark(row.subject, row.full_mark),
            String(row.marks ?? '-'),
            String(row.marks ?? '-'),
            grade.lg,
            Number.isFinite(grade.gp) ? grade.gp.toFixed(2) : '-',
            row.highest_mark ? String(row.highest_mark) : '-',
          ];
        }

        currentX = startX;
        cols.forEach((c, i) => {
          this.drawDynamicText(doc, c, currentX + 5, y, colWidths[i] - 10, rowHeight, {
            fontSize: rowFontSize,
            align: i === 0 ? 'left' : 'center',
          });
          currentX += colWidths[i];
        });
        y += rowHeight;
      }
    });

    return { y, colWidths };
  }
  private static drawDynamicText(
    doc: any,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    options: { fontSize?: number; align?: string; font?: string; bold?: boolean } = {},
  ) {
    const fontSize = options.fontSize || 10;
    const align = options.align || 'left';
    const font = options.bold ? 'Times-Bold' : options.font || 'Times-Roman';
    doc.font(font).fontSize(fontSize);

    const stringText = String(text ?? '-');
    const actualWidth = doc.widthOfString(stringText);
    const textHeight = doc.currentLineHeight();
    const verticalOffset = Math.max(0, (maxHeight - textHeight) / 2);

    // If the text is empty or zero-width, or the target box is too small,
    // avoid any scaling math that could produce NaN/Infinity for PDFKit.
    if (actualWidth > maxWidth - 1 && actualWidth > 0 && maxWidth > 1) {
      const scaleX = (maxWidth - 1) / actualWidth;
      if (Number.isFinite(scaleX) && scaleX > 0) {
        doc.save();
        doc.scale(scaleX, 1);
        doc.text(stringText, x / scaleX, y + verticalOffset, {
          width: maxWidth / scaleX,
          align: align,
          lineBreak: false,
        });
        doc.restore();
        return fontSize;
      }
    }

    // Fallback: draw normally without scaling
    doc.text(stringText, x, y + verticalOffset, {
      width: maxWidth + 2, // Slight extra width to prevent early wrapping
      align: align,
      lineBreak: false,
    });
    return fontSize;
  }

  private static drawGradingSystemTable(doc: any, x: number, y: number) {
    const grades = [
      { range: '80% - 100%', lg: 'A+', gp: '5.00' },
      { range: '70% - 79%', lg: 'A', gp: '4.00' },
      { range: '60% - 69%', lg: 'A-', gp: '3.50' },
      { range: '50% - 59%', lg: 'B', gp: '3.00' },
      { range: '40% - 49%', lg: 'C', gp: '2.00' },
      { range: '33% - 39%', lg: 'D', gp: '1.00' },
      { range: '0% - 32%', lg: 'F', gp: '0.00' },
    ];

    const rowWidth = 120;
    const rowHeight = 11;
    const colWidths = [50, 35, 35];

    doc.lineWidth(0.5).rect(x, y, rowWidth, rowHeight).fillAndStroke('#d1d1d1', '#000000');
    doc
      .fillColor('#000000')
      .font('Times-Bold')
      .fontSize(7)
      .text('GRADING SYSTEM CHART', x, y + 2, {
        align: 'center',
        width: rowWidth,
      });

    y += rowHeight;

    doc.lineWidth(0.5).rect(x, y, rowWidth, rowHeight).fillAndStroke('#e5e5e5', '#000000');
    doc.fillColor('#000000').font('Times-Bold').fontSize(7);

    let curX = x;
    const headers = ['Marks Range', 'LG', 'GP'];
    headers.forEach((h, i) => {
      doc.text(h, curX + 2, y + 2, {
        width: colWidths[i] - 4,
        align: 'center',
      });
      if (i < headers.length - 1) {
        doc
          .moveTo(curX + colWidths[i], y)
          .lineTo(curX + colWidths[i], y + rowHeight)
          .stroke();
      }
      curX += colWidths[i];
    });

    y += rowHeight;
    doc.font('Times-Roman').fontSize(7);

    grades.forEach((g) => {
      doc.lineWidth(0.5).rect(x, y, rowWidth, rowHeight).stroke();
      let curX = x;
      const values = [g.range, g.lg, g.gp];
      values.forEach((v, i) => {
        doc.text(String(v), curX + 2, y + 2, {
          width: colWidths[i] - 4,
          align: 'center',
        });
        if (i < values.length - 1) {
          doc
            .moveTo(curX + colWidths[i], y)
            .lineTo(curX + colWidths[i], y + rowHeight)
            .stroke();
        }
        curX += colWidths[i];
      });
      y += rowHeight;
    });
  }

  // private static drawTableGrid(
  //   doc: any,
  //   y: number,
  //   headers: string[],
  //   data: any[],
  //   exams: string[],
  //   totals: any,
  //   gpas: any,
  // ) {
  //   const {
  //     startX,
  //     contentWidth,
  //     rowHeight,
  //     headerFontSize,
  //     rowFontSize,
  //     fontBold,
  //     fontRegular,
  //   } = PDF_STYLES;
  //   const subjectWidth = 150;
  //   const colWidth = (contentWidth - subjectWidth) / (exams.length || 1);

  //   doc
  //     .fillColor("#000000")
  //     .font(fontBold)
  //     .fontSize(headerFontSize)
  //     .lineWidth(0.5);

  //   doc
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f3f4f6", "#000000");

  //   this.drawDynamicText(doc, headers[0], startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: headerFontSize,
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();

  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, exam, curX, y, colWidth, rowHeight, {
  //       fontSize: headerFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });

  //   y += rowHeight;

  //   doc.font(fontRegular).fontSize(rowFontSize);
  //   data.forEach((row: any) => {
  //     if (y > 780) {
  //       doc.addPage();
  //       this.drawProperBackground(doc);
  //       y = 50;
  //     }

  //     doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke();
  //     this.drawDynamicText(doc, row.subject, startX + 5, y, subjectWidth - 10, rowHeight, {
  //       fontSize: rowFontSize,
  //     });

  //     doc
  //       .moveTo(startX + subjectWidth, y)
  //       .lineTo(startX + subjectWidth, y + rowHeight)
  //       .stroke();

  //     exams.forEach((exam, i) => {
  //       const curX = startX + subjectWidth + i * colWidth;
  //       if (i < exams.length - 1) {
  //         doc
  //           .moveTo(curX + colWidth, y)
  //           .lineTo(curX + colWidth, y + rowHeight)
  //           .stroke();
  //       }
  //       this.drawDynamicText(doc, String(row.exam_marks[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //         fontSize: rowFontSize,
  //         align: "center",
  //       });
  //     });
  //     y += rowHeight;
  //   });

  //   doc
  //     .lineWidth(0.5)
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f9fafb", "#000000");
  //   doc.fillColor("#000000").font(fontBold);
  //   this.drawDynamicText(doc, "TOTAL", startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: rowFontSize,
  //     align: "right",
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();

  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, String(totals[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //       fontSize: rowFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });
  //   y += rowHeight;

  //   // Add GPA row
  //   doc
  //     .lineWidth(0.5)
  //     .rect(startX, y, contentWidth, rowHeight)
  //     .fillAndStroke("#f1f5f9", "#000000");
  //   doc.fillColor("#000000").font(fontBold);
  //   this.drawDynamicText(doc, "GPA", startX + 5, y, subjectWidth - 10, rowHeight, {
  //     fontSize: rowFontSize,
  //     align: "right",
  //     bold: true,
  //   });

  //   doc
  //     .moveTo(startX + subjectWidth, y)
  //     .lineTo(startX + subjectWidth, y + rowHeight)
  //     .stroke();

  //   exams.forEach((exam, i) => {
  //     const curX = startX + subjectWidth + i * colWidth;
  //     if (i < exams.length - 1) {
  //       doc
  //         .moveTo(curX + colWidth, y)
  //         .lineTo(curX + colWidth, y + rowHeight)
  //         .stroke();
  //     }
  //     this.drawDynamicText(doc, String(gpas[exam] ?? "-"), curX, y, colWidth, rowHeight, {
  //       fontSize: rowFontSize,
  //       align: "center",
  //       bold: true,
  //     });
  //   });
  // }

  static async updateFourthSubject(
    studentId: string,
    year: string,
    subjectId: number | null,
    user: any,
  ) {
    const sId = parseInt(studentId);
    const yInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: sId, year: yInt },
    });

    if (!enrollment) {
      throw new Error('Student enrollment not found for specified year');
    }

    if (!this.checkAccess(user, sId, enrollment.class, enrollment.section, yInt)) {
      throw new Error("You are not authorized to update this student's 4th subject");
    }

    const updated = await prisma.student_enrollments.update({
      where: { id: enrollment.id },
      data: { fourth_subject_id: subjectId },
    });

    // 4th subject changes the rendered sheet — invalidate whether published or not.
    // Freeze gate is result_date inside invalidate paths / design fingerprint.
    try {
      const affectedExams = await prisma.marks.findMany({
        where: {
          enrollment_id: enrollment.id,
          exam: { exam_year: yInt },
        },
        distinct: ['exam_id'],
        select: { exam_id: true },
      });
      if (affectedExams.length > 0) {
        const { MarksheetService } = await import('./marksheet.service.js');
        for (const { exam_id } of affectedExams) {
          await MarksheetService.invalidate([sId], exam_id);
        }
      }
    } catch (invErr) {
      console.warn(
        'Marksheet invalidation failed after updateFourthSubject:',
        invErr instanceof Error ? invErr.message : invErr,
      );
    }

    return updated;
  }

  /**
   * Set the same 4th subject on every enrollment in a class (9 or 10) + group
   * for a year. Group is required so Science / Commerce / Humanities are never
   * mixed. Admin only.
   */
  static async bulkUpdateFourthSubject(
    classNum: number,
    year: number,
    subjectId: number | null,
    user: any,
    group?: string | null,
  ) {
    if (user?.role !== 'admin') {
      throw new Error('Only admin can bulk-update 4th subjects');
    }
    if (classNum !== 9 && classNum !== 10) {
      throw new Error('Bulk 4th subject update is only for class 9 or 10');
    }
    if (!Number.isFinite(year) || year < 2000) {
      throw new Error('Valid year is required');
    }
    const groupName = typeof group === 'string' ? group.trim() : '';
    if (!groupName) {
      throw new Error('Group is required (Science, Commerce, or Humanities)');
    }
    if (!['Science', 'Commerce', 'Humanities'].includes(groupName)) {
      throw new Error(`Invalid group: ${groupName}. Allowed: Science, Commerce, Humanities`);
    }

    if (subjectId != null) {
      const subject = await prisma.subjects.findFirst({
        where: { id: subjectId },
        select: {
          id: true,
          class: true,
          subject_type: true,
          group: true,
        },
      });
      if (!subject) {
        throw new Error('Subject not found');
      }
      if (subject.class !== classNum) {
        throw new Error(`Subject belongs to class ${subject.class}, not ${classNum}`);
      }
      if (subject.subject_type === 'main') {
        throw new Error('Cannot set a main (group) subject as 4th subject');
      }
      if (subject.group && subject.group !== groupName) {
        throw new Error(
          `Subject group (${subject.group}) does not match selected group (${groupName})`,
        );
      }
    }

    const where: Prisma.student_enrollmentsWhereInput = {
      class: classNum,
      year,
      group: groupName,
    };

    const enrollments = await prisma.student_enrollments.findMany({
      where,
      select: { id: true, student_id: true },
    });

    if (enrollments.length === 0) {
      return { updatedCount: 0, studentIds: [] as number[] };
    }

    const enrollmentIds = enrollments.map((e) => e.id);
    const studentIds = enrollments.map((e) => e.student_id);

    const result = await prisma.student_enrollments.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { fourth_subject_id: subjectId },
    });

    try {
      const affectedExams = await prisma.marks.findMany({
        where: {
          enrollment_id: { in: enrollmentIds },
          exam: { exam_year: year },
        },
        distinct: ['exam_id'],
        select: { exam_id: true },
      });
      if (affectedExams.length > 0) {
        const { MarksheetService } = await import('./marksheet.service.js');
        for (const { exam_id } of affectedExams) {
          await MarksheetService.invalidate(studentIds, exam_id);
        }
      }
    } catch (invErr) {
      console.warn(
        'Marksheet invalidation failed after bulkUpdateFourthSubject:',
        invErr instanceof Error ? invErr.message : invErr,
      );
    }

    return { updatedCount: result.count, studentIds };
  }
}
