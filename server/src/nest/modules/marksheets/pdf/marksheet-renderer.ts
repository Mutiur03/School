import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { getFileBuffer, headObjectEtag } from '@/config/r2.js';
import { VALID_GROUPS } from '@school/shared-schemas';
import { loadSessionResults } from '@/nest/modules/promotion/session-results.js';
import { PRISMA } from '../../../common/prisma.module.js';
import { canAccessStudent } from '../access.js';
import type { AccessUser } from '../access.js';
import {
  MARKSHEET_SUBJECT_SELECT,
  aggregatePaperMarks,
  classStatsEqual,
  fillMissingSubjectMarks,
  isGroupedClass,
  normalizeStudentGroup,
  statsFromRow,
} from './grading.js';
import type { ClassStatsSnapshot, StatsByGroup } from './grading.js';
import {
  finalizeMarksheetBuffer,
  normalizeSchoolWebsite,
  renderSessionMarksheetsPDF,
  renderStudentReportPDF,
} from './marksheet-draw.js';
import type {
  MarksheetSignatures,
  SchoolMarksheetMeta,
  SessionMarksheetPage,
} from './marksheet-draw.js';

type FrozenSignatories = {
  headId: number | null;
  headRole: string | null;
  teacherId: number | null;
  /** When set, use these instead of live teacher rows (history freeze). */
  detail?: {
    head?: { name: string | null; signature: string | null } | null;
    teacher?: { name: string | null; signature: string | null; phone: string | null } | null;
  } | null;
};

type StatsRow = {
  highest_by_subject: unknown;
  class_highest_total: number;
  class_highest_grand_total: number;
  stats_by_group?: unknown;
} | null;

/**
 * Loads marksheet data (marks, class stats, signatories, school header) and renders
 * per-exam / session marksheet PDFs. Drawing itself is pure (marksheet-draw.ts).
 */
@Injectable()
export class MarksheetRenderer {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Throws if the user may not download this student's marksheet for an exam ('' = session). */
  async verifyMarksheetDownloadAccess(
    schoolId: number,
    studentId: number,
    year: number,
    examName: string,
    user: AccessUser,
  ): Promise<void> {
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: { school_id: schoolId, student_id: studentId, year },
      select: { class: true, section: true },
    });
    if (!enrollment) {
      throw new NotFoundException('Student not enrolled for this year');
    }
    const hasMarks = await this.prisma.marks.findFirst({
      where: {
        school_id: schoolId,
        enrollment: { student_id: studentId, year },
        ...(examName ? { exam: { exam_name: examName, exam_year: year } } : {}),
        marks: { not: null },
      },
      select: { id: true },
    });
    if (!hasMarks) {
      throw new NotFoundException('No marks found for this student');
    }
    if (!canAccessStudent(user, studentId, enrollment.class, enrollment.section, year)) {
      throw new ForbiddenException('You are not authorized to download this marksheet');
    }
    if (examName && user.role === 'student') {
      // Students may only view marks for published (visible) exams.
      const exam = await this.prisma.exams.findFirst({
        where: { school_id: schoolId, exam_name: examName, exam_year: year, visible: true },
        select: { id: true },
      });
      if (!exam) {
        throw new ForbiddenException('This result has not been published yet');
      }
    }
  }

  /**
   * Recompute and persist the exam_class_stats cache row for one
   * (exam, class, year). Runs inside the addMarks transaction.
   * Returns true when displayed class-highest values changed.
   */
  async recomputeExamClassStats(
    tx: Prisma.TransactionClient,
    schoolId: number,
    examId: number,
    klass: number,
    year: number,
  ): Promise<boolean> {
    const oldRow = await tx.exam_class_stats.findFirst({
      where: { school_id: schoolId, exam_id: examId, class: klass, year },
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
    if (isGroupedClass(klass)) {
      const grouped = await this.computeGroupedClassStatsAll(tx, schoolId, examId, klass, year);
      ({ highestBySubject, classHighestTotal, classHighestGrandTotal } = grouped.classWide);
      statsByGroup = grouped.byGroup;
    } else {
      ({ highestBySubject, classHighestTotal, classHighestGrandTotal } = await this.computeStats(
        tx,
        schoolId,
        examId,
        klass,
        year,
      ));
    }
    const nextStats = { highestBySubject, classHighestTotal, classHighestGrandTotal, statsByGroup };
    if (
      oldRow &&
      classStatsEqual(
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
      INSERT INTO exam_class_stats (school_id, exam_id, "class", year, highest_by_subject, class_highest_total, class_highest_grand_total, stats_by_group)
      VALUES (${schoolId}, ${examId}, ${klass}, ${year}, ${JSON.stringify(highestBySubject)}::jsonb, ${classHighestTotal}, ${classHighestGrandTotal}, ${statsByGroup ? JSON.stringify(statsByGroup) : null}::jsonb)
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

  /**
   * Session marksheet pages (previous + year-end exam combined) for a year.
   * Students without any entered marks, or in classes without a year-end exam, are skipped.
   */
  async loadSessionMarksheetPages(
    schoolId: number,
    year: number,
    opts: { classLevel?: number; enrollmentIds?: number[] } = {},
  ): Promise<{ version: string; pages: SessionMarksheetPage[] }> {
    const { version, results } = await loadSessionResults(this.prisma, schoolId, year, opts);
    const withMarks = results.filter((r) =>
      r.subjects.some((s) => s.yearEnd.marks != null || s.previous?.marks != null),
    );
    const examIds = [
      ...new Set(withMarks.flatMap((r) => [r.yearEndExamId, r.previousExamId ?? r.yearEndExamId])),
    ];
    const exams = await this.prisma.exams.findMany({
      where: { school_id: schoolId, id: { in: examIds } },
      select: { id: true, exam_name: true, result_date: true, return_date: true },
    });
    const byId = new Map(exams.map((e) => [e.id, e]));
    const pages = withMarks
      .map((result) => {
        const yearEnd = byId.get(result.yearEndExamId);
        return {
          result,
          previousExamName:
            result.previousExamId != null
              ? (byId.get(result.previousExamId)?.exam_name ?? null)
              : null,
          yearEndExamName: yearEnd?.exam_name ?? 'Annual Examination',
          resultDate: yearEnd?.result_date ?? null,
          returnDate: yearEnd?.return_date ?? null,
        };
      })
      .sort(
        (a, b) =>
          a.result.classLevel - b.result.classLevel ||
          a.result.section.localeCompare(b.result.section) ||
          a.result.roll - b.result.roll,
      );
    return { version, pages };
  }

  /** Class roster used when filling empty subjects onto a marksheet. */
  async loadMarksheetSubjects(schoolId: number, classNum: number, year: number) {
    return this.prisma.subjects.findMany({
      where: { school_id: schoolId, class: classNum, year, subject_type: { not: 'main' } },
      select: MARKSHEET_SUBJECT_SELECT,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
  }

  /** 4th-subject GPA bonus only applies once every enrollment of the class has picked one. */
  async shouldApplyFourthSubjectBonus(
    schoolId: number,
    className: number,
    year: number,
  ): Promise<boolean> {
    const enrollments = await this.prisma.student_enrollments.findMany({
      where: { school_id: schoolId, class: className, year },
      select: { fourth_subject_id: true },
    });

    if (enrollments.length === 0) return false;
    return enrollments.every((e) => e.fourth_subject_id !== null);
  }

  /**
   * One student's per-exam marksheet. A year-end exam renders the session design
   * (previous + year-end). Returns the signatories actually used so the worker can snapshot them.
   */
  async generateMarksheetPDF(
    schoolId: number,
    studentId: number,
    year: number,
    exam: string,
    user: AccessUser,
    frozenSignatories?: FrozenSignatories,
  ) {
    const result = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        enrollment: { student_id: studentId, year },
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
        exam: {
          select: { exam_name: true, result_date: true, return_date: true, is_year_end: true },
        },
      },
    });
    if (result.length === 0 || !result.some((m) => m.marks !== null)) {
      throw new NotFoundException('No marks found for this student');
    }

    const enrollment = result[0].enrollment;
    const resultDate = result[0].exam?.result_date ?? null;
    const returnDate = result[0].exam?.return_date ?? null;
    if (!canAccessStudent(user, studentId, enrollment.class, enrollment.section, year)) {
      throw new ForbiddenException('You are not authorized to download this marksheet');
    }

    const studentName = enrollment.student.name;
    const studentClass = enrollment.class;
    const studentRoll = enrollment.roll;
    const studentSection = enrollment.section;

    // Class-highest stats come from the exam_class_stats cache (refreshed on
    // every addMarks) instead of rescanning the whole class here.
    const examId = result[0].exam_id;
    const [statsRow, schoolMeta, classSubjects] = await Promise.all([
      this.prisma.exam_class_stats.findFirst({
        where: { school_id: schoolId, exam_id: examId, class: studentClass, year },
      }),
      this.getSchoolMarksheetMeta(schoolId),
      this.loadMarksheetSubjects(schoolId, studentClass, year),
    ]);
    const schoolPhone = schoolMeta.phone;
    const logoBuffer = schoolMeta.logoKey ? await getFileBuffer(schoolMeta.logoKey) : null;

    const filledResult = fillMissingSubjectMarks(result, classSubjects, enrollment.group, {
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
        const t = await this.prisma.teachers.findUnique({
          where: { id: frozenSignatories.teacherId, school_id: schoolId },
          select: { id: true, name: true, signature: true, phone: true },
        });
        teacherRec = {
          id: frozenSignatories.teacherId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          phone: t?.phone ?? null,
        };
      }
    } else {
      const level = await this.prisma.levels.findFirst({
        where: { school_id: schoolId, class_name: studentClass, section: studentSection, year },
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
        const t = await this.prisma.teachers.findUnique({
          where: { id: frozenSignatories.headId, school_id: schoolId },
          select: { name: true, signature: true },
        });
        headRec = {
          id: frozenSignatories.headId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          role: frozenSignatories.headRole ?? 'Headmaster',
        };
      }
    } else {
      const headMsg = await this.getHeadMsgForMarks(schoolId);
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
    const signatures: MarksheetSignatures = {
      teacher: teacherSignature,
      teacherName,
      teacherPhone,
      head: headSignature,
      headName,
      headRole,
      schoolPhone,
    };
    const used = {
      studentName,
      usedHeadId: headRec?.id ?? null,
      usedHeadRole: headRec?.role ?? null,
      usedTeacherId: teacherRec?.id ?? null,
      usedHeadName: headName,
      usedHeadSignature: headRec?.signature ?? null,
      usedTeacherName: teacherName,
      usedTeacherSignature: teacherRec?.signature ?? null,
      usedTeacherPhone: teacherPhone,
    };

    // Year-end exam: no separate sheet — it is the session marksheet (previous + year-end).
    if (result[0].exam?.is_year_end) {
      const { version, pages } = await this.loadSessionMarksheetPages(schoolId, year, {
        classLevel: studentClass,
        enrollmentIds: [enrollment.id],
      });
      if (!pages.length) throw new NotFoundException('No marks found for this student');
      const buffer = await renderSessionMarksheetsPDF(
        year,
        version,
        pages,
        async () => signatures,
        schoolMeta,
        logoBuffer,
      );
      return { buffer: await finalizeMarksheetBuffer(buffer), ...used };
    }

    const [resolvedStats, applyBonus] = await Promise.all([
      this.resolveStudentClassStats(
        schoolId,
        statsRow,
        examId,
        studentClass,
        year,
        enrollment.group,
      ),
      studentClass && year
        ? this.shouldApplyFourthSubjectBonus(schoolId, studentClass, year)
        : Promise.resolve(false),
    ]);
    const highestMarksMap = resolvedStats.highestBySubject as Record<string, number>;

    const studentDetails = {
      name: studentName,
      class: studentClass,
      section: studentSection,
      roll: studentRoll,
      year,
      exam,
      classHighestTotal: resolvedStats.classHighestTotal,
      classHighestGrandTotal: resolvedStats.classHighestGrandTotal,
      fourth_subject_id: enrollment.fourth_subject_id,
      applyBonus,
      result_date: resultDate,
      return_date: returnDate,
    };

    const finalTableData = aggregatePaperMarks(
      filledResult.map((m) => ({
        ...m,
        highest_mark: highestMarksMap[m.subject_id] || 0,
      })),
    );

    const buffer = await renderStudentReportPDF(
      studentDetails,
      finalTableData,
      signatures,
      schoolMeta,
      logoBuffer,
    );
    return { buffer: await finalizeMarksheetBuffer(buffer), ...used };
  }

  /** Session marksheet(s): one page per student, previous + year-end exams combined. */
  async generateAllMarksheetsPDF(schoolId: number, year: number, studentId?: number) {
    let scope: { classLevel?: number; enrollmentIds?: number[] } = {};
    if (studentId) {
      const en = await this.prisma.student_enrollments.findFirst({
        where: { school_id: schoolId, student_id: studentId, year },
        select: { id: true, class: true },
      });
      if (!en) throw new NotFoundException('No marks found');
      scope = { classLevel: en.class, enrollmentIds: [en.id] };
    }
    const { version, pages } = await this.loadSessionMarksheetPages(schoolId, year, scope);
    if (pages.length === 0) throw new NotFoundException('No marks found');

    const [headMsg, schoolMeta] = await Promise.all([
      this.getHeadMsgForMarks(schoolId),
      this.getSchoolMarksheetMeta(schoolId),
    ]);
    const [logoBuffer, headSignature] = await Promise.all([
      schoolMeta.logoKey ? getFileBuffer(schoolMeta.logoKey) : null,
      headMsg?.teacher?.signature ? getFileBuffer(headMsg.teacher.signature) : null,
    ]);
    const teacherSigs = new Map<string, Promise<MarksheetSignatures>>();
    const signaturesFor = (page: SessionMarksheetPage) => {
      const { classLevel, section } = page.result;
      const key = `${classLevel}_${section}`;
      if (!teacherSigs.has(key)) {
        teacherSigs.set(
          key,
          (async () => {
            const lv = await this.prisma.levels.findFirst({
              where: { school_id: schoolId, class_name: classLevel, section, year },
              include: { teacher: true },
            });
            return {
              teacher: lv?.teacher?.signature ? await getFileBuffer(lv.teacher.signature) : null,
              teacherName: lv?.teacher?.name ?? null,
              teacherPhone: lv?.teacher?.phone ?? null,
              head: headSignature,
              headName: headMsg?.teacher?.name ?? null,
              headRole: headMsg?.head_role ?? 'Headmaster',
              schoolPhone: schoolMeta.phone,
            };
          })(),
        );
      }
      return teacherSigs.get(key)!;
    };

    const buffer = await renderSessionMarksheetsPDF(
      year,
      version,
      pages,
      signaturesFor,
      schoolMeta,
      logoBuffer,
    );
    return finalizeMarksheetBuffer(buffer);
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
  private async computeStats(
    client: Prisma.TransactionClient,
    schoolId: number,
    examId: number,
    klass: number,
    year: number,
    group?: string | null,
  ): Promise<ClassStatsSnapshot> {
    const enrollmentWhere: Prisma.student_enrollmentsWhereInput = { class: klass, year };
    if (group) enrollmentWhere.group = group;
    const where = { school_id: schoolId, exam_id: examId, enrollment: enrollmentWhere };

    const [bySubject, byEnrollmentExam, byEnrollmentAll] = await Promise.all([
      client.marks.groupBy({ by: ['subject_id'], where, _max: { marks: true } }),
      client.marks.groupBy({
        by: ['enrollment_id'],
        where: { ...where, subject: { assessment_type: 'exam' } },
        _sum: { marks: true },
      }),
      client.marks.groupBy({ by: ['enrollment_id'], where, _sum: { marks: true } }),
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

  private async computeGroupedClassStatsAll(
    client: Prisma.TransactionClient,
    schoolId: number,
    examId: number,
    klass: number,
    year: number,
  ): Promise<{ classWide: ClassStatsSnapshot; byGroup: StatsByGroup }> {
    const byGroup: StatsByGroup = {};
    await Promise.all(
      VALID_GROUPS.map(async (g) => {
        byGroup[g] = await this.computeStats(client, schoolId, examId, klass, year, g);
      }),
    );
    const classWide = await this.computeStats(client, schoolId, examId, klass, year);
    return { classWide, byGroup };
  }

  private async resolveStudentClassStats(
    schoolId: number,
    statsRow: StatsRow,
    examId: number,
    klass: number,
    year: number,
    group: string | null | undefined,
  ): Promise<ClassStatsSnapshot> {
    const fromCache = statsFromRow(statsRow, klass, group);
    if (fromCache) return fromCache;
    const groupName = normalizeStudentGroup(group);
    if (isGroupedClass(klass) && groupName) {
      return this.computeStats(this.prisma, schoolId, examId, klass, year, groupName);
    }
    return this.computeStats(this.prisma, schoolId, examId, klass, year);
  }

  /** Header/watermark fields drawn on every marksheet page. */
  private async getSchoolMarksheetMeta(schoolId: number): Promise<SchoolMarksheetMeta> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        upazila: true,
        district: true,
        ownership: true,
        eiin: true,
        customDomain: true,
        phone: true,
        logo: true,
      },
    });
    if (!school) {
      return {
        ownership: null,
        name: null,
        location: null,
        eiin: null,
        website: null,
        phone: null,
        logoKey: null,
        logoEtag: null,
      };
    }
    const place = [school.upazila, school.district]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', ');
    const logoKey = school.logo || null;
    return {
      ownership: school.ownership ?? null,
      name: school.name?.trim() || null,
      // AGENTS.md: marksheet headers show upazila, district only — never school.address.
      location: place || null,
      eiin: school.eiin?.trim() || null,
      website: normalizeSchoolWebsite(school.customDomain),
      phone: school.phone?.trim() || null,
      logoKey,
      logoEtag: logoKey ? await headObjectEtag(logoKey) : null,
    };
  }

  private getHeadMsgForMarks(schoolId: number) {
    return this.prisma.head_msg.findFirst({
      where: { school_id: schoolId },
      orderBy: { updated_at: 'desc' },
      include: { teacher: true },
    });
  }
}
