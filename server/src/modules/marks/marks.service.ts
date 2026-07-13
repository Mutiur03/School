import { prisma } from "@/config/prisma.js";
import { Prisma } from "@prisma/client";
import { getRlsContext, patchRlsContext } from "@/config/rlsContextStore.js";
import { getFileBuffer } from "@/config/r2.js";
import PDFDocument from "pdfkit";
import { pdf } from "pdf-to-img";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const PDF_STYLES = {
  startX: 50,
  contentWidth: 495,
  rowHeight: 20,
  headerFontSize: 10,
  rowFontSize: 9,
  fontBold: "Times-Bold",
  fontRegular: "Times-Roman",
  fontItalic: "Times-Italic",
};

const A4_PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARKSHEET_IMAGE_SCALE = 2;
// true  -> rasterize PDF to images then re-embed (tamper-resistant, slow).
// false -> return direct vector PDF (fast, selectable text).
const RASTERIZE_MARKSHEET = true;
const MARKSHEET_FONT_PATHS = {
  regular: [
    process.env.MARKSHEET_FONT_REGULAR,
    "C:\\Windows\\Fonts\\times.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
  ].filter(Boolean) as string[],
  bold: [
    process.env.MARKSHEET_FONT_BOLD,
    "C:\\Windows\\Fonts\\timesbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
  ].filter(Boolean) as string[],
};

// Gap between table end and signature block (PDF points)
const SIGNATURE_GAP_AFTER_TABLE = 40;
const SIGNATURE_BLOCK_HEIGHT = 76;
const SIGNATURE_IMAGE_OFFSET = 28; // image bottom sits near dotted line
const PAGE_CONTENT_BOTTOM = 812;

const MONTH_SHORT = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatResultPublishDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const raw = String(dateStr).split("T")[0].trim();
  const parts = raw.split("-").map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [year, month, day] = parts;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, "0")} ${MONTH_SHORT[month - 1]} ${year}`;
    }
  }
  return raw || null;
}

export class MarksService {
  private static validateMarksData(data: any) {
    if (!Array.isArray(data.students)) {
      throw new Error("Students data must be an array");
    }
    data.students.forEach((student: any) => {
      if (!student.studentId || !Array.isArray(student.subjectMarks)) {
        throw new Error("Invalid student data structure");
      }
      student.subjectMarks.forEach((mark: any) => {
        if (!mark.subjectId) {
          throw new Error("Invalid marks data structure - missing subjectId");
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
    if (user.role === "admin") return true;
    if (user.role === "teacher") {
      return user.levels?.some(
        (level: any) =>
          level.class_name === className &&
          level.section === section &&
          level.year === year,
      );
    }
    if (user.role === "student") {
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
    const yearInt = typeof year === "string" ? parseInt(year) : year;
    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: studentId, year: yearInt },
      select: { class: true, section: true },
    });
    if (!enrollment) {
      throw new Error("Student not enrolled for this year");
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
      throw new Error("No marks found for this student");
    }
    if (
      !this.checkAccess(
        user,
        studentId,
        enrollment.class,
        enrollment.section,
        yearInt,
      )
    ) {
      throw new Error("You are not authorized to download this marksheet");
    }
  }

  /**
   * Class-highest stats for one (exam, class, year), computed with DB
   * aggregates instead of pulling every mark row into JS. Shared by the
   * write-time cache refresh and the read-time lazy fallback.
   * - highestBySubject: max mark per subject, across all assessment types.
   * - classHighestTotal: max over per-student totals, exam-type subjects only
   *   (feeds the "Total Marks" row).
   * - classHighestGrandTotal: max over per-student totals across ALL subjects
   *   incl. continuous (feeds the "Grand Total Marks" row).
   */
  static async computeStats(
    client: Prisma.TransactionClient | typeof prisma,
    examId: number,
    klass: number,
    year: number,
  ): Promise<{
    highestBySubject: Record<number, number>;
    classHighestTotal: number;
    classHighestGrandTotal: number;
  }> {
    const [bySubject, byEnrollmentExam, byEnrollmentAll] = await Promise.all([
      client.marks.groupBy({
        by: ["subject_id"],
        where: { exam_id: examId, enrollment: { class: klass, year } },
        _max: { marks: true },
      }),
      client.marks.groupBy({
        by: ["enrollment_id"],
        where: {
          exam_id: examId,
          enrollment: { class: klass, year },
          subject: { assessment_type: "exam" },
        },
        _sum: { marks: true },
      }),
      client.marks.groupBy({
        by: ["enrollment_id"],
        where: { exam_id: examId, enrollment: { class: klass, year } },
        _sum: { marks: true },
      }),
    ]);

    const highestBySubject: Record<number, number> = {};
    for (const g of bySubject) {
      highestBySubject[g.subject_id] = Number(g._max.marks ?? 0);
    }
    const examTotals = byEnrollmentExam.map((g) => Number(g._sum.marks ?? 0));
    const classHighestTotal =
      examTotals.length > 0 ? Math.max(...examTotals) : 0;
    const grandTotals = byEnrollmentAll.map((g) => Number(g._sum.marks ?? 0));
    const classHighestGrandTotal =
      grandTotals.length > 0 ? Math.max(...grandTotals) : 0;

    return { highestBySubject, classHighestTotal, classHighestGrandTotal };
  }

  private static classStatsEqual(
    a: {
      highestBySubject: unknown;
      classHighestTotal: number;
      classHighestGrandTotal: number;
    },
    b: {
      highestBySubject: unknown;
      classHighestTotal: number;
      classHighestGrandTotal: number;
    },
  ): boolean {
    return (
      a.classHighestTotal === b.classHighestTotal &&
      a.classHighestGrandTotal === b.classHighestGrandTotal &&
      JSON.stringify(a.highestBySubject) === JSON.stringify(b.highestBySubject)
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
      },
    });
    const { highestBySubject, classHighestTotal, classHighestGrandTotal } =
      await this.computeStats(tx, examId, klass, year);
    const nextStats = {
      highestBySubject,
      classHighestTotal,
      classHighestGrandTotal,
    };
    if (
      oldRow &&
      this.classStatsEqual(
        {
          highestBySubject: oldRow.highest_by_subject,
          classHighestTotal: oldRow.class_highest_total,
          classHighestGrandTotal: oldRow.class_highest_grand_total,
        },
        nextStats,
      )
    ) {
      return false;
    }
    await tx.$executeRaw`
      INSERT INTO exam_class_stats (exam_id, "class", year, highest_by_subject, class_highest_total, class_highest_grand_total)
      VALUES (${examId}, ${klass}, ${year}, ${JSON.stringify(highestBySubject)}::jsonb, ${classHighestTotal}, ${classHighestGrandTotal})
      ON CONFLICT (exam_id, "class", year, school_id)
      DO UPDATE SET
        highest_by_subject = EXCLUDED.highest_by_subject,
        class_highest_total = EXCLUDED.class_highest_total,
        class_highest_grand_total = EXCLUDED.class_highest_grand_total,
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
      new Set(
        students.flatMap((s: any) =>
          s.subjectMarks.map((m: any) => m.subjectId),
        ),
      ),
    );

    const [enrollments, subjects] = await Promise.all([
      prisma.student_enrollments.findMany({
        where: { student_id: { in: studentIds }, year: yearInt },
      }),
      prisma.subjects.findMany({ where: { id: { in: subjectIds } } }),
    ]);

    const enrollmentByStudent = new Map(
      enrollments.map((e) => [e.student_id, e]),
    );
    const enrollmentClassById = new Map(
      enrollments.map((e) => [e.id, e.class]),
    );
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
        !this.checkAccess(
          user,
          student.studentId,
          enrollment.class,
          enrollment.section,
          yearInt,
        )
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
          (subject as any).marking_scheme === "BREAKDOWN"
            ? (Number(cq_marks) || 0) +
              (Number(mcq_marks) || 0) +
              (Number(practical_marks) || 0)
            : providedTotal;

        if (
          (subject as any).marking_scheme === "BREAKDOWN" &&
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
    const studentIdByEnrollmentId = new Map(
      enrollments.map((e) => [e.id, e.student_id]),
    );

    // Only touch rows whose values actually changed so updated_at (and
    // marksheet input_hash) are not bumped for the whole class on one edit.
    let changedRows = rows;
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
      const existingByKey = new Map(
        existingMarks.map((m) => [`${m.enrollment_id}_${m.subject_id}`, m]),
      );
      changedRows = rows.filter((r) =>
        this.markRowChanged(
          existingByKey.get(`${r.enrollment_id}_${r.subject_id}`),
          r,
        ),
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
            SELECT set_config('app.is_super_admin', ${rlsContext.isSuperAdmin ? "1" : "0"}, true)
          `;
          await tx.$executeRaw`
            SELECT set_config('app.school_id', ${rlsContext.schoolId ? String(rlsContext.schoolId) : ""}, true)
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
            const statsChanged = await this.recomputeExamClassStats(
              tx,
              exam.id,
              cls,
              yearInt,
            );
            if (statsChanged) classesWithStatsChange.push(cls);
          }
        } finally {
          patchRlsContext({ inRlsTransaction: false });
        }
      });

      try {
        const { MarksheetService } = await import("./marksheet.service.js");
        // Unpublished exams: save marks only — PDFs regenerate on download, not here.
        if (exam.visible) {
          if (classesWithStatsChange.length > 0) {
            await MarksheetService.invalidateClasses(
              exam.id,
              classesWithStatsChange,
              yearInt,
            );
          } else if (changedStudentIds.length > 0) {
            await MarksheetService.invalidate(changedStudentIds, exam.id);
          }
        }
      } catch (invErr) {
        console.warn(
          "Marksheet invalidation failed after addMarks:",
          invErr instanceof Error ? invErr.message : invErr,
        );
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

    if (user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) =>
            l.class_name === Number(className) && l.year === parseInt(year),
        )
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error("You are not assigned to this class.");
      }

      if (section) {
        if (!assignedSections.includes(section)) {
          throw new Error("You are not assigned to this section.");
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
      orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
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

  static async getClassMarks(
    className: string,
    year: string,
    exam: string,
    user: any,
  ) {
    const where: any = {
      class: Number(className),
      year: parseInt(year),
    };

    if (user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) =>
            l.class_name === Number(className) && l.year === parseInt(year),
        )
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error("You are not assigned to this class.");
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
      orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
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
      marks: (enrollment.marks || [])
        .filter((mark: any) => mark.marks !== null)
        .map((mark: any) => ({
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
    // user: any,
  ) {
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: {
          student_id: parseInt(id),
          year: parseInt(year),
        },
        exam: {
          exam_name: exam,
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

  static async getIndividualSessionMarksPreview(
    studentId: string,
    year: string,
    user: any,
  ) {
    const sId = parseInt(studentId);
    const yearInt = parseInt(year);

    const enrollment = await prisma.student_enrollments.findFirst({
      where: { student_id: sId, year: yearInt },
    });

    if (!enrollment) {
      throw new Error("Student enrollment not found for specified year");
    }

    if (
      !this.checkAccess(
        user,
        sId,
        enrollment.class,
        enrollment.section,
        yearInt,
      )
    ) {
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

  static aggregatePaperMarks(marksList: any[]) {
    const aggregatedData: Record<number, any> = {};
    const finalData: any[] = [];

    marksList.forEach((mark) => {
      const sub = mark.subject;
      if (sub.subject_type === "paper" && sub.parent_id) {
        const pid = sub.parent_id;
        if (!aggregatedData[pid]) {
          aggregatedData[pid] = {
            subject: sub.parent?.name || "Main Subject",
            marks: 0,
            cq_marks: 0,
            mcq_marks: 0,
            practical_marks: 0,
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
            marking_scheme: "TOTAL",
            papers: [],
            isGroup: true,
            subject_id: pid,
          };
        }
        const g = aggregatedData[pid];
        g.marks += mark.marks || 0;
        g.cq_marks += mark.cq_marks || 0;
        g.mcq_marks += mark.mcq_marks || 0;
        g.practical_marks += mark.practical_marks || 0;
        g.full_mark += sub.full_mark || 0;
        g.cq_mark += sub.cq_mark || 0;
        g.mcq_mark += sub.mcq_mark || 0;
        g.practical_mark += sub.practical_mark || 0;
        g.cq_pass_mark += sub.cq_pass_mark || 0;
        g.mcq_pass_mark += sub.mcq_pass_mark || 0;
        g.practical_pass_mark += sub.practical_pass_mark || 0;
        g.pass_mark += sub.pass_mark || 0;
        g.priority = Math.min(g.priority, sub.priority);
        if ((sub as any).marking_scheme === "BREAKDOWN") {
          g.marking_scheme = "BREAKDOWN";
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
      if (a.assessment_type === "exam" && b.assessment_type !== "exam")
        return -1;
      if (a.assessment_type !== "exam" && b.assessment_type === "exam")
        return 1;
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
        exam: { select: { exam_name: true, result_date: true } },
      },
    });
    if (result.length === 0 || !result.some(m => m.marks !== null)) {
      throw new Error("No marks found for this student");
    }

    result.sort((a, b) => {
      if (
        a.subject.assessment_type === "exam" &&
        b.subject.assessment_type !== "exam"
      )
        return -1;
      if (
        a.subject.assessment_type !== "exam" &&
        b.subject.assessment_type === "exam"
      )
        return 1;
      return (a.subject.priority || 0) - (b.subject.priority || 0);
    });
    const enrollment = result[0].enrollment;
    const resultDate = result[0].exam?.result_date ?? null;
    if (
      !this.checkAccess(
        user,
        parseInt(id),
        enrollment.class,
        enrollment.section,
        parseInt(year),
      )
    ) {
      throw new Error("You are not authorized to download this marksheet");
    }

    const studentName = result[0].enrollment.student.name;
    const studentClass = result[0].enrollment.class;
    const studentRoll = result[0].enrollment.roll;
    const studentSection = result[0].enrollment.section;

    // Class-highest stats come from the exam_class_stats cache (refreshed on
    // every addMarks) instead of rescanning the whole class here.
    const examId = result[0].exam_id;
    const yearInt = parseInt(year);
    const [statsRow, website] = await Promise.all([
      prisma.exam_class_stats.findFirst({
        where: { exam_id: examId, class: studentClass, year: yearInt },
      }),
      this.getSchoolWebsite(),
    ]);

    // Resolve the signatories. For a frozen exam the worker passes the
    // snapshotted ids so a later staff reassignment does not re-stamp the sheet;
    // the person's CURRENT name/signature is still read (so a late signature
    // upload by the same person still propagates). Open exams resolve the
    // current class-teacher / head assignment as before.
    let teacherRec:
      | { id: number | null; name: string | null; signature: string | null }
      | null = null;
    if (frozenSignatories) {
      // Frozen exam: the snapshotted teacher id is authoritative. A null id means
      // the section had no class teacher when the sheet was finalized — keep it
      // null rather than falling back to a teacher assigned after the freeze.
      if (frozenSignatories.teacherId != null) {
        const t = await prisma.teachers.findUnique({
          where: { id: frozenSignatories.teacherId },
          select: { id: true, name: true, signature: true },
        });
        teacherRec = {
          id: frozenSignatories.teacherId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
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
          }
        : null;
    }

    let headRec:
      | {
          id: number | null;
          name: string | null;
          signature: string | null;
          role: string;
        }
      | null = null;
    if (frozenSignatories) {
      // Frozen exam: keep the snapshotted head. A null id means no head signed
      // the finalized sheet — do not fall back to the current head assignment.
      if (frozenSignatories.headId != null) {
        const t = await prisma.teachers.findUnique({
          where: { id: frozenSignatories.headId },
          select: { name: true, signature: true },
        });
        headRec = {
          id: frozenSignatories.headId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          role: frozenSignatories.headRole ?? "Headmaster",
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
            role: headMsg.head_role ?? "Headmaster",
          }
        : null;
    }

    const [teacherSignature, headSignature] = await Promise.all([
      teacherRec?.signature ? getFileBuffer(teacherRec.signature) : null,
      headRec?.signature ? getFileBuffer(headRec.signature) : null,
    ]);
    const teacherName = teacherRec?.name ?? null;
    const headName = headRec?.name ?? null;
    const headRole = headRec?.role ?? "Headmaster";
    const usedTeacherId = teacherRec?.id ?? null;
    const usedHeadId = headRec?.id ?? null;
    const usedHeadRole = headRec?.role ?? null;

    // Lazy fallback if the cache row is missing (marks predate this feature).
    let highestMarksMap: Record<string, number>;
    let classHighestTotal: number;
    let classHighestGrandTotal: number;
    if (statsRow) {
      highestMarksMap =
        (statsRow.highest_by_subject as Record<string, number>) ?? {};
      classHighestTotal = statsRow.class_highest_total ?? 0;
      classHighestGrandTotal = statsRow.class_highest_grand_total ?? 0;
    } else {
      const stats = await this.computeStats(
        prisma,
        examId,
        studentClass,
        yearInt,
      );
      highestMarksMap = stats.highestBySubject as Record<string, number>;
      classHighestTotal = stats.classHighestTotal;
      classHighestGrandTotal = stats.classHighestGrandTotal;
    }

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
    };

    const finalTableData = this.aggregatePaperMarks(result.map(m => ({
      ...m,
      highest_mark: highestMarksMap[m.subject_id] || 0
    })));

    const buffer = await this.renderStudentReportPDF(
      studentDetails,
      finalTableData,
      { teacher: teacherSignature, teacherName, head: headSignature, headName, headRole },
      website,
    );
    return {
      buffer: await this.finalizeMarksheetBuffer(buffer),
      studentName,
      usedHeadId,
      usedHeadRole,
      usedTeacherId,
    };
  }

  static async generateBulkExamMarksheetsPDF(
    year: string,
    className: string,
    examName: string,
    section?: string,
    user?: any,
    sections?: string[],
    frozenSignatories?: {
      headId: number | null;
      headRole: string | null;
      teachersBySection: Record<string, number>;
    },
  ) {
    const yearInt = parseInt(year);
    const classNum = parseInt(className);
    // Records the class-teacher id actually used per section so the worker can
    // persist the bundle's signatory snapshot.
    const usedTeachersBySection: Record<string, number> = {};

    const where: any = {
      class: classNum,
      year: yearInt,
    };

    if (sections && sections.length > 0) {
      where.section = { in: sections };
    } else if (user && user.role === "teacher") {
      const assignedSections = user.levels
        ?.filter(
          (l: any) => l.class_name === classNum && l.year === yearInt
        )
        .map((l: any) => l.section);

      if (!assignedSections || assignedSections.length === 0) {
        throw new Error("You are not assigned to this class.");
      }

      if (section) {
        if (!assignedSections.includes(section)) {
          throw new Error("You are not assigned to this section.");
        }
        where.section = section;
      } else {
        where.section = { in: assignedSections };
      }
    } else if (section) {
      where.section = section;
    }

    const [enrollments, allExamMarks, headMsg, website] = await Promise.all([
      prisma.student_enrollments.findMany({
        where,
        include: { student: { select: { id: true, name: true } } },
        orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
      }),
      prisma.marks.findMany({
        where: {
          enrollment: { class: classNum, year: yearInt },
          exam: { exam_name: examName },
        },
        include: {
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
          exam: { select: { exam_name: true, result_date: true } },
        },
        orderBy: {
          subject: {
            priority: "asc"
          }
        }
      }),
      this.getHeadMsgForMarks(),
      this.getSchoolWebsite(),
    ]);

    if (enrollments.length === 0) throw new Error("No students found");

    // Not read from the exam_class_stats cache on purpose: this bulk path must
    // load every student's marks to render them (marksByEnrollment) anyway, so
    // highest-per-subject / class-highest-total are a free byproduct of the
    // scan it already does. Caching would add a query without saving one.
    const highestMarksMap: Record<number, number> = {};
    const totalByEnrollment: Record<number, number> = {};
    const marksByEnrollment: Record<number, any[]> = {};

    const grandTotalByEnrollment: Record<number, number> = {};
    allExamMarks.forEach((m) => {
      const marksVal = Number(m.marks || 0);
      if (!highestMarksMap[m.subject_id] || marksVal > highestMarksMap[m.subject_id]) {
        highestMarksMap[m.subject_id] = marksVal;
      }
      if (m.subject.assessment_type === "exam") {
        totalByEnrollment[m.enrollment_id] = (totalByEnrollment[m.enrollment_id] || 0) + marksVal;
      }
      grandTotalByEnrollment[m.enrollment_id] = (grandTotalByEnrollment[m.enrollment_id] || 0) + marksVal;
      if (!marksByEnrollment[m.enrollment_id]) marksByEnrollment[m.enrollment_id] = [];
      marksByEnrollment[m.enrollment_id].push(m);
    });

    const classHighestTotal = Object.values(totalByEnrollment).length > 0 ? Math.max(...Object.values(totalByEnrollment)) : 0;
    const classHighestGrandTotal = Object.values(grandTotalByEnrollment).length > 0 ? Math.max(...Object.values(grandTotalByEnrollment)) : 0;
    const resultDate = allExamMarks[0]?.exam?.result_date ?? null;

    // Head signatory: snapshotted id (frozen) resolves that person's current
    // name/signature; otherwise the current head assignment.
    let headRec:
      | { id: number | null; name: string | null; signature: string | null; role: string }
      | null;
    if (frozenSignatories) {
      // Frozen exam: keep the snapshotted head; a null id means no head signed
      // the finalized bundle — do not fall back to the current head.
      if (frozenSignatories.headId != null) {
        const t = await prisma.teachers.findUnique({
          where: { id: frozenSignatories.headId },
          select: { name: true, signature: true },
        });
        headRec = {
          id: frozenSignatories.headId,
          name: t?.name ?? null,
          signature: t?.signature ?? null,
          role: frozenSignatories.headRole ?? "Headmaster",
        };
      } else {
        headRec = null;
      }
    } else {
      headRec = headMsg
        ? {
            id: headMsg.head_id ?? null,
            name: headMsg.teacher?.name ?? null,
            signature: headMsg.teacher?.signature ?? null,
            role: headMsg.head_role ?? "Headmaster",
          }
        : null;
    }
    const headSignature = headRec?.signature ? await getFileBuffer(headRec.signature) : null;
    const headName = headRec?.name ?? null;
    const headRole = headRec?.role ?? "Headmaster";
    const usedHeadId = headRec?.id ?? null;
    const usedHeadRole = headRec?.role ?? null;
    const teacherSigs: Record<string, { signature: Buffer | null; name: string | null }> = {};

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    this.registerMarksheetFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const studentsWithMarks = enrollments.filter(e => {
      const marks = marksByEnrollment[e.id] || [];
      return marks.some(m => m.marks !== null);
    });
    if (studentsWithMarks.length === 0) throw new Error("No non-null marks found for any student in this class.");

    const buffer = await new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      for (let i = 0; i < studentsWithMarks.length; i++) {
        const enrollment = studentsWithMarks[i];
        if (i > 0) doc.addPage();

        const studentMarks = marksByEnrollment[enrollment.id];
        const studentDetails = {
          name: enrollment.student.name,
          class: enrollment.class,
          section: enrollment.section,
          roll: enrollment.roll,
          year: yearInt,
          exam: examName,
          classHighestTotal,
          classHighestGrandTotal,
          fourth_subject_id: enrollment.fourth_subject_id,
          result_date: resultDate,
        };

        const finalTableData = this.aggregatePaperMarks(studentMarks.map(m => ({
          ...m,
          highest_mark: highestMarksMap[m.subject_id] || 0
        })));

        const sigKey = `${enrollment.class}_${enrollment.section}_${yearInt}`;
        if (!(sigKey in teacherSigs)) {
          const overrideTeacherId =
            frozenSignatories?.teachersBySection?.[enrollment.section];
          let lvTeacher:
            | { id: number | null; name: string | null; signature: string | null }
            | null = null;
          if (frozenSignatories) {
            // Frozen bundle: only the snapshotted per-section teacher may sign.
            // A section absent from the snapshot had no teacher when finalized —
            // render it blank rather than pulling in a post-freeze assignment.
            if (overrideTeacherId != null) {
              const t = await prisma.teachers.findUnique({
                where: { id: overrideTeacherId },
                select: { name: true, signature: true },
              });
              lvTeacher = {
                id: overrideTeacherId,
                name: t?.name ?? null,
                signature: t?.signature ?? null,
              };
            } else {
              lvTeacher = null;
            }
          } else {
            const lv = await prisma.levels.findFirst({
              where: {
                class_name: enrollment.class,
                section: enrollment.section,
                year: yearInt,
              },
              include: { teacher: true },
            });
            lvTeacher = lv
              ? {
                  id: lv.teacher_id ?? null,
                  name: lv.teacher?.name ?? null,
                  signature: lv.teacher?.signature ?? null,
                }
              : null;
          }
          teacherSigs[sigKey] = {
            signature: lvTeacher?.signature
              ? await getFileBuffer(lvTeacher.signature)
              : null,
            name: lvTeacher?.name ?? null,
          };
          if (lvTeacher?.id != null) {
            usedTeachersBySection[enrollment.section] = lvTeacher.id;
          }
        }

        await this.renderStudentMarksheetPage(
          doc,
          studentDetails,
          finalTableData,
          {
            teacher: teacherSigs[sigKey].signature,
            teacherName: teacherSigs[sigKey].name,
            head: headSignature,
            headName,
            headRole,
          },
          website,
        );
      }
      doc.end();
    });
    return {
      buffer: await this.finalizeMarksheetBuffer(buffer),
      usedHeadId,
      usedHeadRole,
      usedTeachersBySection,
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
        exam: { select: { id: true, exam_name: true, result_date: true } },
      },
      orderBy: {
        subject: {
          priority: "asc"
        }
      }
    });

    if (marks.length === 0) throw new Error("No marks found");

    const classesAffected = Array.from(new Set(marks.map((m) => m.enrollment.class)));
    const examIds = Array.from(new Set(marks.map((m) => m.exam_id)));

    // Highest-per-subject and class-highest-total are read from the
    // exam_class_stats cache (per exam+class), combined across the affected
    // classes to match the previous behaviour, instead of a second full scan.
    const highestMarksMap: Record<string, Record<number, number>> = {};
    const classHighestTotalByExam: Record<string, number> = {};
    const classHighestGrandTotalByExam: Record<string, number> = {};

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
        if (
          !highestMarksMap[examLabel][subjId] ||
          v > highestMarksMap[examLabel][subjId]
        ) {
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

    const statsRows = await prisma.exam_class_stats.findMany({
      where: {
        exam_id: { in: examIds },
        class: { in: classesAffected },
        year: yearInt,
      },
      include: { exam: { select: { exam_name: true } } },
    });
    for (const row of statsRows) {
      mergeStats(
        row.exam.exam_name,
        (row.highest_by_subject as Record<string, number>) ?? {},
        row.class_highest_total ?? 0,
        row.class_highest_grand_total ?? 0,
      );
    }

    // Lazy fallback: fill any (exam, class) combo present in the data but
    // missing from the cache (marks predate this feature).
    const combos = new Map<
      string,
      { examId: number; klass: number; examName: string }
    >();
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
      const s = await this.computeStats(prisma, c.examId, c.klass, yearInt);
      mergeStats(
        c.examName,
        s.highestBySubject as Record<string, number>,
        s.classHighestTotal,
        s.classHighestGrandTotal,
      );
    }

    const studentGrouped: Record<number, Record<string, any[]>> = {};
    const studentInfoMap: Record<number, any> = {};
    const resultDateByExam: Record<string, string | null> = {};

    marks.forEach((m) => {
      if (m.marks === null) return;
      const sid = m.enrollment.student_id;
      const en = m.exam.exam_name;
      if (!studentGrouped[sid]) studentGrouped[sid] = {};
      if (!studentGrouped[sid][en]) studentGrouped[sid][en] = [];
      studentGrouped[sid][en].push(m);

      if (!(en in resultDateByExam)) {
        resultDateByExam[en] = m.exam?.result_date ?? null;
      }

      if (!studentInfoMap[sid]) {
        studentInfoMap[sid] = {
          name: m.enrollment.student.name,
          class: m.enrollment.class,
          section: m.enrollment.section,
          roll: m.enrollment.roll,
          year: m.enrollment.year,
          fourth_subject_id: m.enrollment.fourth_subject_id,
        };
      }
    });

    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    this.registerMarksheetFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const buffer = await new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const [headMsg, website] = await Promise.all([
        this.getHeadMsgForMarks(),
        this.getSchoolWebsite(),
      ]);
      const headSignature = headMsg?.teacher?.signature
        ? await getFileBuffer(headMsg.teacher.signature)
        : null;
      const headName = headMsg?.teacher?.name ?? null;
      const headRole = headMsg?.head_role ?? "Headmaster";
      const teacherSigs: Record<string, { signature: Buffer | null; name: string | null }> = {};

      const studentIdsOrdered = Object.keys(studentGrouped)
        .map(Number)
        .sort((a, b) => {
          const sa = studentInfoMap[a];
          const sb = studentInfoMap[b];
          if (sa.roll !== sb.roll) return sa.roll - sb.roll;
          return sa.name.localeCompare(sb.name);
        });

      for (let i = 0; i < studentIdsOrdered.length; i++) {
        const sid = studentIdsOrdered[i];
        if (i > 0) doc.addPage();

        const info = studentInfoMap[sid];
        const exams = Object.keys(studentGrouped[sid]);

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
            signature: lv?.teacher?.signature
              ? await getFileBuffer(lv.teacher.signature)
              : null,
            name: lv?.teacher?.name ?? null,
          };
        }
        const teacherSignature = teacherSigs[sigKey].signature;
        const teacherName = teacherSigs[sigKey].name;

        // Draw page shell
        const allExamsTableData = exams.map((en) => ({
          exam: en,
          rows: this.aggregatePaperMarks(
            studentGrouped[sid][en].map((m: any) => ({
              ...m,
              highest_mark: highestMarksMap[en]?.[m.subject_id] || 0,
            })),
          ),
        }));
        const consolidatedQrText = this.buildMarksQrText(info, allExamsTableData);

        const drawPageHeader = async (examDisplayName: string) => {
          this.drawProperBackground(doc);
          await this.drawWatermark(doc);
          this.drawGradingSystemTable(doc, 425, 75);
          await this.drawProperHeader(
            doc,
            { ...info, exam: examDisplayName },
            website,
            consolidatedQrText,
          );
          this.drawProperStudentInfo(doc, info);
        };

        await drawPageHeader("Consolidated Report");
        doc.y = 230;

        for (let j = 0; j < exams.length; j++) {
          const examName = exams[j];
          const studentMarks = studentGrouped[sid][examName];

          const finalTableData = this.aggregatePaperMarks(studentMarks.map(m => ({
            ...m,
            highest_mark: highestMarksMap[examName]?.[m.subject_id] || 0
          })));

          // Check for space before rendering this exam's table
          const estimatedHeight = 50 + finalTableData.length * 20 + 40; // title + table + summary
          if (doc.y + estimatedHeight > 750) {
            doc.addPage();
            await drawPageHeader("Consolidated Report (Contd.)");
            doc.y = 230;
          }

          const sX = PDF_STYLES.startX;
          const cW = PDF_STYLES.contentWidth;
          doc.x = sX;
          doc.moveDown(0.5);
          doc.fillColor("#000000").font("Times-Bold").fontSize(12).text(`EXAM: ${examName.toUpperCase()}`, { align: "center", width: cW, underline: true });
          doc.moveDown(0.3);

          const headers = this.useBreakdownLayout(info.class, finalTableData)
            ? ["Name of Subjects", "CQ", "MCQ", "PRAC", "Total", "Letter Grade", "Grade Point", "Highest Marks"]
            : ["Name of Subjects", "Obtained Marks", "Total", "Letter Grade", "Grade Point", "Highest Marks"];

          const { y: tableY, colWidths } = this.drawProperTable(
            doc,
            doc.y,
            headers,
            finalTableData,
            info.class,
            classHighestTotalByExam[examName] || 0,
          );
          const summaryY = await this.drawSummary(
            doc,
            tableY,
            finalTableData,
            info.class,
            classHighestTotalByExam[examName] || 0,
            info.fourth_subject_id,
            info.year,
            colWidths,
            resultDateByExam[examName] ?? null,
            classHighestGrandTotalByExam[examName] || 0,
          );
          doc.y = summaryY;
        }

        this.drawSignatures(
          doc,
          {
            teacher: teacherSignature,
            teacherName,
            head: headSignature,
            headName,
            headRole,
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
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
    },
    website?: string | null,
  ) {
    this.drawProperBackground(doc);
    await this.drawWatermark(doc);
    this.drawGradingSystemTable(doc, 425, 75);
    await this.drawProperHeader(
      doc,
      student,
      website,
      this.buildMarksQrText(student, [{ exam: student.exam, rows: tableData }]),
    );
    this.drawProperStudentInfo(doc, student);

    const y = doc.y + 5;
    const headers =
      this.useBreakdownLayout(student.class, tableData)
        ? [
            "Name of Subjects",
            "CQ",
            "MCQ",
            "PRAC",
            "Total",
            "Letter Grade",
            "Grade Point",
            "Highest Marks",
          ]
        : [
            "Name of Subjects",
            "Obtained Marks",
            "Total",
            "Letter Grade",
            "Grade Point",
            "Highest Marks",
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
    );

    this.drawSignatures(doc, signatures, tableEndY);
  }

  private static async renderStudentReportPDF(
    student: any,
    tableData: any[],
    signatures?: {
      teacher?: Buffer | null;
      teacherName?: string | null;
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
    },
    website?: string | null,
  ): Promise<Buffer> {
    const doc = new (PDFDocument as any)({ size: "A4", margin: 40 });
    this.registerMarksheetFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      await this.renderStudentMarksheetPage(
        doc,
        student,
        tableData,
        signatures,
        website,
      );
      doc.end();
    });
  }

  private static registerMarksheetFonts(doc: any) {
    const regularFont = MARKSHEET_FONT_PATHS.regular.find((fontPath) =>
      fs.existsSync(fontPath),
    );
    const boldFont = MARKSHEET_FONT_PATHS.bold.find((fontPath) =>
      fs.existsSync(fontPath),
    );

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
    const sourcePdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
    const sourceDocument = await pdf(sourcePdfDataUrl, {
      scale: MARKSHEET_IMAGE_SCALE,
    });
    const doc = new (PDFDocument as any)({
      autoFirstPage: false,
      margin: 0,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>(async (resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

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
  private static useBreakdownLayout(
    className: number | undefined,
    data: any[],
  ): boolean {
    if (className !== 9 && className !== 10) return false;
    return data.some((row: any) => row.marking_scheme === "BREAKDOWN");
  }

  static async shouldApplyFourthSubjectBonus(
    className: number,
    year: number,
  ): Promise<boolean> {
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
      if (row.assessment_type === "exam") {
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
          if (grade.lg === "F") isFailed = true;
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
  ) {
    // Grand Total row shows the class-highest grand total (all subjects); fall
    // back to the exam-only highest if the grand value wasn't supplied.
    const grandHighest =
      classHighestGrandTotal !== undefined && classHighestGrandTotal !== null
        ? classHighestGrandTotal
        : classHighestTotal;
    const { startX, contentWidth, rowHeight } = PDF_STYLES;

    const applyBonus =
      className && year
        ? await this.shouldApplyFourthSubjectBonus(className, year)
        : false;

    const { gpa } = this.calculateGPA(
      tableData,
      fourth_subject_id ?? null,
      applyBonus,
      className,
    );
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
        ? ["Name of Subjects", "CQ", "MCQ", "PRAC", "Total", "Letter Grade", "Grade Point", "Highest Marks"]
        : ["Name of Subjects", "Obtained Marks", "Total", "Letter Grade", "Grade Point", "Highest Marks"];
      const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
      const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
      actualColWidths = [contentWidth - usedWidth, ...otherColWidths];
    }

    const totalTableWidth = actualColWidths.reduce((a, b) => a + b, 0);

    // --- Render Column-Aligned Single Summary Row ---
    const rowY = y; // Remove the gap
    doc.lineWidth(0.5).rect(startX, rowY, totalTableWidth, rowHeight).stroke("#000000");

    if (isBreakdown) {
      // Breakdown (8 cols): Subj(0), CQ(1), MCQ(2), PRAC(3), Total(4), LG(5), GP(6), High(7)
      // Merge 0-3 for Grand Total Label, Val in 4
      const w03 = actualColWidths[0] + actualColWidths[1] + actualColWidths[2] + actualColWidths[3];
      this.drawDynamicText(doc, "Grand Total Marks", startX + 5, rowY, w03 - 10, rowHeight, { align: "right", bold: true });
      doc.moveTo(startX + w03, rowY).lineTo(startX + w03, rowY + rowHeight).stroke();

      const x4 = startX + w03;
      this.drawDynamicText(doc, String(grandTotalMarks), x4, rowY, actualColWidths[4], rowHeight, { align: "center", bold: true });
      doc.moveTo(x4 + actualColWidths[4], rowY).lineTo(x4 + actualColWidths[4], rowY + rowHeight).stroke();

      const x5 = x4 + actualColWidths[4];
      this.drawDynamicText(doc, "GPA", x5 + 5, rowY, actualColWidths[5] - 10, rowHeight, { align: "center", bold: true });
      doc.moveTo(x5 + actualColWidths[5], rowY).lineTo(x5 + actualColWidths[5], rowY + rowHeight).stroke();

      const x6 = x5 + actualColWidths[5];
      this.drawDynamicText(doc, gpa.toFixed(2), x6, rowY, actualColWidths[6], rowHeight, { align: "center", bold: true });
      doc.moveTo(x6 + actualColWidths[6], rowY).lineTo(x6 + actualColWidths[6], rowY + rowHeight).stroke();

      const x7 = x6 + actualColWidths[6];
      this.drawDynamicText(doc, `${grandHighest || "-"}`, x7 + 2, rowY, actualColWidths[7] - 4, rowHeight, { align: "center", bold: true });
    } else {
      // Standard (6 cols): Subj(0), Obt(1), Total(2), LG(3), GP(4), High(5)
      // Merge 0-1 for Grand Total Label, Val in 2
      const w01 = actualColWidths[0] + actualColWidths[1];
      this.drawDynamicText(doc, "Grand Total Marks", startX + 5, rowY, w01 - 10, rowHeight, { align: "right", bold: true });
      doc.moveTo(startX + w01, rowY).lineTo(startX + w01, rowY + rowHeight).stroke();

      const x2 = startX + w01;
      this.drawDynamicText(doc, String(grandTotalMarks), x2, rowY, actualColWidths[2], rowHeight, { align: "center", bold: true });
      doc.moveTo(x2 + actualColWidths[2], rowY).lineTo(x2 + actualColWidths[2], rowY + rowHeight).stroke();

      const x3 = x2 + actualColWidths[2]; // Column 3 (LG)
      this.drawDynamicText(doc, "GPA", x3, rowY, actualColWidths[3], rowHeight, { align: "center", bold: true });
      doc.moveTo(x3 + actualColWidths[3], rowY).lineTo(x3 + actualColWidths[3], rowY + rowHeight).stroke();

      const x4 = x3 + actualColWidths[3]; // Column 4 (GP)
      this.drawDynamicText(doc, gpa.toFixed(2), x4, rowY, actualColWidths[4], rowHeight, { align: "center", bold: true });
      doc.moveTo(x4 + actualColWidths[4], rowY).lineTo(x4 + actualColWidths[4], rowY + rowHeight).stroke();

      const x5 = x4 + actualColWidths[4]; // Column 5 (Highest)
      this.drawDynamicText(doc, `${grandHighest || "-"}`, x5, rowY, actualColWidths[5], rowHeight, { align: "center", bold: true });
    }

    let endY = rowY + rowHeight;
    const formattedResultDate = formatResultPublishDate(resultDate);
    if (formattedResultDate) {
      const dateY = endY + 4;
      doc
        .font(PDF_STYLES.fontRegular)
        .fontSize(PDF_STYLES.rowFontSize)
        .fillColor("#000000");
      doc.text(`Date of result published: ${formattedResultDate}`, startX, dateY, {
        width: contentWidth,
        align: "left",
      });
      endY = dateY + PDF_STYLES.rowHeight;
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
    const font = options.font ?? "Times-Roman";

    let fontSize = maxFontSize;
    doc.font(font).fillColor("#000000");

    while (
      fontSize > minFontSize &&
      doc.fontSize(fontSize).widthOfString(text) > maxWidth
    ) {
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
      head?: Buffer | null;
      headName?: string | null;
      headRole?: string | null;
    },
    tableEndY?: number,
  ) {
    doc.fontSize(10).font("Times-Bold").fillColor("#000000");

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
          teacherStartX + (teacherLineWidth - 60) / 2,
          lineY - SIGNATURE_IMAGE_OFFSET,
          { width: 60 },
        );
      } catch (err) {
        console.error("Teacher signature image error:", err);
      }
    }

    // Render Headmaster signature if provided
    if (signatures?.head) {
      try {
        doc.image(
          signatures.head,
          headStartX + (headLineWidth - 60) / 2,
          lineY - SIGNATURE_IMAGE_OFFSET,
          { width: 60 },
        );
      } catch (err) {
        console.error("Head signature image error:", err);
      }
    }

    const drawNameAndRole = (
      x: number,
      name: string | null | undefined,
      role: string,
      width: number,
    ) => {
      doc.fillColor("#000000").fontSize(10);

      if (name) {
        this.drawFittedCenteredText(doc, name, x, textY, width, {
          fontSize: 10,
          font: "Times-Roman",
        });
        this.drawFittedCenteredText(doc, role, x, textY + 12, width, {
          fontSize: 10,
          minFontSize: 8,
          font: "Times-Bold",
        });
        return;
      }

      this.drawFittedCenteredText(doc, role, x, textY, width, {
        fontSize: 10,
        font: "Times-Bold",
      });
    };

    doc
      .moveTo(guardianStartX, lineY)
      .lineTo(guardianStartX + guardianLineWidth, lineY)
      .stroke();
    this.drawFittedCenteredText(doc, "Guardian", guardianStartX, textY, guardianLineWidth, {
      fontSize: 10,
      font: "Times-Bold",
    });

    doc
      .moveTo(teacherStartX, lineY)
      .lineTo(teacherStartX + teacherLineWidth, lineY)
      .stroke();
    drawNameAndRole(
      teacherStartX,
      signatures?.teacherName,
      "Class Teacher",
      teacherLineWidth,
    );

    doc
      .moveTo(headStartX, lineY)
      .lineTo(headStartX + headLineWidth, lineY)
      .stroke();
    drawNameAndRole(
      headStartX,
      signatures?.headName,
      signatures?.headRole ?? "Headmaster",
      headLineWidth,
    );

    doc.undash();
  }

  private static drawProperBackground(doc: any) {
    doc.rect(20, 20, 555, 802).lineWidth(2).stroke("#000000");
    doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke("#666666");
  }

  private static normalizeSchoolWebsite(
    customDomain?: string | null,
    website?: string | null,
  ): string | null {
    const raw = (customDomain?.trim() || website?.trim() || "");
    if (!raw) return null;

    try {
      if (/^https?:\/\//i.test(raw)) {
        return new URL(raw).hostname || null;
      }
      return raw.replace(/\/+$/, "").replace(/:\d+$/, "").toLowerCase();
    } catch {
      const cleaned = raw
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        ?.replace(/:\d+$/, "");
      return cleaned || null;
    }
  }

  private static async getSchoolWebsite(): Promise<string | null> {
    const schoolId = getRlsContext()?.schoolId;
    if (!schoolId) return null;
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { customDomain: true, website: true },
    });
    return this.normalizeSchoolWebsite(
      school?.customDomain,
      school?.website,
    );
  }

  private static async getHeadMsgForMarks() {
    const schoolId = getRlsContext()?.schoolId;
    return prisma.head_msg.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: "desc" },
      include: { teacher: true },
    });
  }

  private static buildMarksQrText(
    student: any,
    exams: { exam?: string | null; rows: any[] }[],
  ): string {
    const lines = [
      `Name: ${student.name ?? ""}`,
      `Class: ${student.class ?? ""}`,
      `Section: ${student.section ?? ""}`,
      `Roll: ${student.roll ?? ""}`,
      `Year: ${student.year ?? ""}`,
    ];

    for (const examBlock of exams) {
      if (examBlock.exam) {
        lines.push(`Exam: ${examBlock.exam}`);
      }
      for (const row of examBlock.rows || []) {
        const subject = row.subject ?? "Subject";
        const marks = row.marks ?? "-";
        lines.push(`${subject}: ${marks}`);
      }
    }

    return lines.join("\n");
  }

  private static async drawProperHeader(
    doc: any,
    exam?: any,
    website?: string | null,
    qrText?: string | null,
  ) {
    // Mirror grading chart (x=425, y=75, w=120): QR on left, same top
    // Align QR left edge with marks table (PDF_STYLES.startX = 50)
    const qrSize = 85;
    const qrX = PDF_STYLES.startX;
    const qrY = 75;
    const textLeft = qrX + qrSize + 10;
    const textRight = 415;
    const textWidth = textRight - textLeft;
    const pageHeaderX = 50;
    const pageHeaderWidth = 495;

    // Top line spans full page — above side widgets
    doc
      .font("Times-Bold")
      .fontSize(10)
      .text("Government of the People's Republic of Bangladesh", pageHeaderX, 40, {
        align: "center",
        width: pageHeaderWidth,
      });

    const schoolName = "PANCHBIBI LAL BIHARI PILOT GOVT. HIGH SCHOOL";
    const maxWidth = pageHeaderWidth - 4;
    let fontSize = 15;
    doc.font("Times-Bold");
    while (
      doc.fontSize(fontSize).widthOfString(schoolName) > maxWidth &&
      fontSize > 8
    ) {
      fontSize--;
    }
    doc
      .fontSize(fontSize)
      .text(schoolName, pageHeaderX, 55, { align: "center", width: pageHeaderWidth });

    if (qrText) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrText, {
          margin: 1,
          width: 260,
          errorCorrectionLevel: "M",
        });
        doc.image(qrDataUrl, qrX, qrY, { width: qrSize });
      } catch (err) {
        console.error("Marksheet QR code error:", err);
      }
    }

    doc
      .font("Times-Bold")
      .fontSize(11)
      .text("Panchbibi, Joypurhat.", textLeft, 75, {
        align: "center",
        width: textWidth,
      });
    doc.font("Times-Bold").fontSize(10);
    const infoText = "EIIN: 121983, School Code: 5100";
    const websiteStr = typeof website === "string" ? website.trim() : "";
    const headerOffset = websiteStr ? 14 : 0;

    if (websiteStr) {
      const host = websiteStr.replace(/^https?:\/\//, "");
      const websiteUrl = /^https?:\/\//i.test(websiteStr)
        ? websiteStr.replace(/\/+$/, "")
        : `https://${host}`;
      doc.text(websiteUrl, textLeft, 90, {
        align: "center",
        width: textWidth,
      });
    }

    doc.text(infoText, textLeft, 90 + headerOffset, {
      align: "center",
      width: textWidth,
    });

    if (exam && (exam.exam || exam.year)) {
      const examName = exam.exam || "";
      const session = exam.year ? String(exam.year) : "";
      const headerText =
        examName && session ? `${examName} ${session}` : examName || session;

      doc
        .fillColor("#000000")
        .font("Times-Bold")
        .fontSize(14)
        .text(headerText, textLeft, 105 + headerOffset, {
          align: "center",
          width: textWidth,
        });
    }

    const titleW = 200;
    const titleX = textLeft + (textWidth - titleW) / 2;
    doc
      .rect(titleX, 128 + headerOffset, titleW, 25)
      .fill("#f3f4f6")
      .stroke("#000000");
    doc
      .fillColor("#000000")
      .font("Times-Bold")
      .fontSize(14)
      .text("ACADEMIC TRANSCRIPT", titleX, 135 + headerOffset, {
        align: "center",
        width: titleW,
      });
  }

  private static async drawWatermark(doc: any) {
    const logoPath = path.join("public", "icon.jpg");
    if (fs.existsSync(logoPath)) {
      try {
        const grayscaleBuffer = await sharp(logoPath).grayscale().toBuffer();
        doc.save();
        doc.opacity(0.1);
        doc.image(grayscaleBuffer, 150, 290, { width: 300 });
        doc.restore();
      } catch (e) {
        doc.save();
        doc.opacity(0.1);
        doc.image(logoPath, 150, 290, { width: 300 });
        doc.restore();
      }
    }
  }

  private static getClassText(classNum: number | string): string {
    const classMap: Record<string, string> = {
      "6": "Six",
      "7": "Seven",
      "8": "Eight",
      "9": "Nine",
      "10": "Ten",
    };
    return classMap[String(classNum)] || String(classNum);
  }

  private static drawProperStudentInfo(doc: any, student: any) {
    const startY = 185;
    const lineHeight = 18;
    doc.fillColor("#000000");

    // Row 1: Student's Name
    this.drawDynamicText(doc, "Student's Name:", 50, startY, 100, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, student.name, 150, startY, 350, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Row 2: Class, Section, Roll No
    const row2Y = startY + lineHeight;
    
    // Class
    this.drawDynamicText(doc, "Class:", 50, row2Y, 50, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, this.getClassText(student.class), 100, row2Y, 90, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Section
    this.drawDynamicText(doc, "Section:", 230, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, student.section || "-", 290, row2Y, 50, lineHeight, { fontSize: 11, font: "Times-Roman" });

    // Roll No
    this.drawDynamicText(doc, "Roll No:", 350, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
    this.drawDynamicText(doc, String(student.roll || "-"), 410, row2Y, 50, lineHeight, { fontSize: 11, font: "Times-Roman" });
  }

  private static getGradeByPercentage(
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
        breakdown.marking_scheme === "BREAKDOWN" &&
        ((breakdown.cq_pass &&
          (breakdown.cq || 0) < (breakdown.cq_pass || 0)) ||
          (breakdown.mcq_pass &&
            (breakdown.mcq || 0) < (breakdown.mcq_pass || 0)) ||
          (breakdown.pr_pass &&
            (breakdown.pr || 0) < (breakdown.pr_pass || 0)))
      ) {
        return { lg: "F", gp: 0.0 };
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
      return { lg: "F", gp: 0.0 };
    }

    if (percentage < 33) {
      return { lg: "F", gp: 0.0 };
    }

    if (percentage >= 80) return { lg: "A+", gp: 5.0 };
    if (percentage >= 70) return { lg: "A", gp: 4.0 };
    if (percentage >= 60) return { lg: "A-", gp: 3.5 };
    if (percentage >= 50) return { lg: "B", gp: 3.0 };
    if (percentage >= 40) return { lg: "C", gp: 2.0 };
    if (percentage >= 33) return { lg: "D", gp: 1.0 };
    return { lg: "F", gp: 0.0 };
  }

  private static formatSubjectWithFullMark(
    subject: string,
    fullMark?: number | null,
  ): string {
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
    const {
      startX,
      contentWidth,
      rowHeight,
      headerFontSize,
      rowFontSize,
      fontBold,
      fontRegular,
    } = PDF_STYLES;
    const isBreakdown = this.useBreakdownLayout(className, data);

    doc.font(fontBold).fontSize(headerFontSize);
    const otherColWidths = headers.slice(1).map((h) => Math.max(40, doc.widthOfString(h) + 15));
    const usedWidth = otherColWidths.reduce((a, b) => a + b, 0);
    const subjectWidth = Math.max(100, contentWidth - usedWidth);
    const colWidths = [subjectWidth, ...otherColWidths];

    doc
      .fillAndStroke("#f3f4f6", "#000000")
      .lineWidth(0.5)
      .rect(startX, y, contentWidth, rowHeight)
      .fillAndStroke();
    doc.fillColor("#000000").font(fontBold).fontSize(headerFontSize);


    let currentX = startX;
    headers.forEach((h, i) => {
      this.drawDynamicText(doc, h, currentX + 5, y, colWidths[i] - 10, rowHeight, {
        fontSize: headerFontSize,
        align: i === 0 ? "left" : "center",
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
      const examRows = data.filter((row: any) => row.assessment_type === "exam");
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

      doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke("#000000");

      if (isBreakdown) {
        const w03 = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
        this.drawDynamicText(doc, "Total Marks", startX + 5, y, w03 - 10, rowHeight, {
          align: "right",
          bold: true,
          fontSize: rowFontSize,
        });
        doc.moveTo(startX + w03, y).lineTo(startX + w03, y + rowHeight).stroke();

        const x4 = startX + w03;
        this.drawDynamicText(doc, String(examTotalMarks), x4, y, colWidths[4], rowHeight, {
          align: "center",
          bold: true,
          fontSize: rowFontSize,
        });
        doc.moveTo(x4 + colWidths[4], y).lineTo(x4 + colWidths[4], y + rowHeight).stroke();

        const x5 = x4 + colWidths[4];
        doc.moveTo(x5 + colWidths[5], y).lineTo(x5 + colWidths[5], y + rowHeight).stroke();

        const x6 = x5 + colWidths[5];
        doc.moveTo(x6 + colWidths[6], y).lineTo(x6 + colWidths[6], y + rowHeight).stroke();

        const x7 = x6 + colWidths[6];
        this.drawDynamicText(
          doc,
          `${classHighestTotal ?? "-"}`,
          x7 + 2,
          y,
          colWidths[7] - 4,
          rowHeight,
          { align: "center", bold: true, fontSize: rowFontSize },
        );
      } else {
        const w01 = colWidths[0] + colWidths[1];
        this.drawDynamicText(doc, "Total Marks", startX + 5, y, w01 - 10, rowHeight, {
          align: "right",
          bold: true,
          fontSize: rowFontSize,
        });
        doc.moveTo(startX + w01, y).lineTo(startX + w01, y + rowHeight).stroke();

        const x2 = startX + w01;
        this.drawDynamicText(doc, String(examTotalMarks), x2, y, colWidths[2], rowHeight, {
          align: "center",
          bold: true,
          fontSize: rowFontSize,
        });
        doc.moveTo(x2 + colWidths[2], y).lineTo(x2 + colWidths[2], y + rowHeight).stroke();

        const x3 = x2 + colWidths[2];
        doc.moveTo(x3 + colWidths[3], y).lineTo(x3 + colWidths[3], y + rowHeight).stroke();

        const x4 = x3 + colWidths[3];
        doc.moveTo(x4 + colWidths[4], y).lineTo(x4 + colWidths[4], y + rowHeight).stroke();

        const x5 = x4 + colWidths[4];
        this.drawDynamicText(
          doc,
          `${classHighestTotal ?? "-"}`,
          x5,
          y,
          colWidths[5],
          rowHeight,
          { align: "center", bold: true, fontSize: rowFontSize },
        );
      }

      y += rowHeight;
      doc.font(fontRegular).fontSize(rowFontSize);
    };

    let lastType = "exam";
    let examTotalDrawn = false;
    data.forEach((row: any) => {
      if (row.assessment_type !== lastType) {
        if (lastType === "exam" && row.assessment_type === "continuous" && !examTotalDrawn) {
          drawExamSubjectsTotalRow();
          examTotalDrawn = true;
        }
        lastType = row.assessment_type;

        doc
          .font(fontBold)
          .fontSize(headerFontSize - 1)
          .fillColor("#4b5563");
        this.drawDynamicText(doc, "CONTINUOUS ASSESSMENT", startX, y, contentWidth, rowHeight, {
          align: "center",
          bold: true,
          fontSize: headerFontSize - 1,
        });
        doc.fillColor("#000000").font(fontRegular).fontSize(rowFontSize);
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
              ? startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3]
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
              : startX +
                colWidths[0] +
                colWidths[1] +
                colWidths[2] +
                colWidths[3] +
                colWidths[4];

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
            this.drawDynamicText(doc, paper.cq_marks ?? "-", startX + colWidths[0] + 5, py, colWidths[1] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            this.drawDynamicText(doc, paper.mcq_marks ?? "-", startX + colWidths[0] + colWidths[1] + 5, py, colWidths[2] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            this.drawDynamicText(doc, paper.practical_marks ?? "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, py, colWidths[3] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
            // Render Highest Mark for paper in breakdown
            this.drawDynamicText(doc, paper.highest_mark ? String(paper.highest_mark) : "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + 5, py, colWidths[7] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
          } else {
            this.drawDynamicText(doc, paper.marks ?? "-", startX + colWidths[0] + 5, py, colWidths[1] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });

            // DO NOT draw full_mark in Column 2 for junior groups to avoid overlap with spanned obtained total
            // (Full marks are already included in parenthesized subject name)

            // Render Highest Mark for paper in standard (Column 5)
            this.drawDynamicText(doc, paper.highest_mark ? String(paper.highest_mark) : "-", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, py, colWidths[5] - 10, rowHeight, {
              fontSize: rowFontSize,
              align: "center",
            });
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

        const mx =
          startX + colWidths.slice(0, middleStart).reduce((a, b) => a + b, 0);
        const fullMark = Number(row.full_mark);
        const grade = this.getGradeByPercentage((row.marks / fullMark) * 100, {
          total: row.marks,
          total_pass: row.pass_mark,
          cq: row.cq_marks,
          cq_pass: row.cq_pass_mark,
          mcq: row.mcq_marks,
          mcq_pass: row.mcq_pass_mark,
          pr: row.practical_marks,
          pr_pass: row.practical_pass_mark,
          marking_scheme: row.marking_scheme,
        });

        this.drawDynamicText(doc, row.marks ?? "-", mx + 5, y, colWidths[middleStart] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
        });
        this.drawDynamicText(doc, grade.lg, mx + colWidths[middleStart] + 5, y, colWidths[middleStart + 1] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
        });
        this.drawDynamicText(doc, grade.gp.toFixed(2), mx + colWidths[middleStart] + colWidths[middleStart + 1] + 5, y, colWidths[middleStart + 2] - 10, totalHeight, {
          fontSize: rowFontSize,
          align: "center",
        });

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
        const grade = this.getGradeByPercentage((row.marks / fullMark) * 100, {
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
        });

        let cols: string[] = [];
        if (isBreakdown) {
          cols = [
            this.formatSubjectWithFullMark(row.subject, row.full_mark),
            String(row.cq_marks ?? "-"),
            String(row.mcq_marks ?? "-"),
            String(row.practical_marks ?? "-"),
            String(row.marks ?? "-"),
            grade.lg,
            grade.gp.toFixed(2),
            row.highest_mark ? String(row.highest_mark) : "-",
          ];
        } else {
          cols = [
            this.formatSubjectWithFullMark(row.subject, row.full_mark),
            String(row.marks ?? "-"),
            String(row.marks ?? "-"),
            grade.lg,
            grade.gp.toFixed(2),
            row.highest_mark ? String(row.highest_mark) : "-",
          ];
        }

        currentX = startX;
        cols.forEach((c, i) => {
          this.drawDynamicText(doc, c, currentX + 5, y, colWidths[i] - 10, rowHeight, {
            fontSize: rowFontSize,
            align: i === 0 ? "left" : "center",
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
    const align = options.align || "left";
    const font = options.bold ? "Times-Bold" : (options.font || "Times-Roman");
    doc.font(font).fontSize(fontSize);

    const stringText = String(text ?? "-");
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
      { range: "80% - 100%", lg: "A+", gp: "5.00" },
      { range: "70% - 79%", lg: "A", gp: "4.00" },
      { range: "60% - 69%", lg: "A-", gp: "3.50" },
      { range: "50% - 59%", lg: "B", gp: "3.00" },
      { range: "40% - 49%", lg: "C", gp: "2.00" },
      { range: "33% - 39%", lg: "D", gp: "1.00" },
      { range: "0% - 32%", lg: "F", gp: "0.00" },
    ];

    const rowWidth = 120;
    const rowHeight = 11;
    const colWidths = [50, 35, 35];

    doc
      .lineWidth(0.5)
      .rect(x, y, rowWidth, rowHeight)
      .fillAndStroke("#d1d1d1", "#000000");
    doc
      .fillColor("#000000")
      .font("Times-Bold")
      .fontSize(7)
      .text("GRADING SYSTEM CHART", x, y + 2, {
        align: "center",
        width: rowWidth,
      });

    y += rowHeight;

    doc
      .lineWidth(0.5)
      .rect(x, y, rowWidth, rowHeight)
      .fillAndStroke("#e5e5e5", "#000000");
    doc.fillColor("#000000").font("Times-Bold").fontSize(7);

    let curX = x;
    const headers = ["Marks Range", "LG", "GP"];
    headers.forEach((h, i) => {
      doc.text(h, curX + 2, y + 2, {
        width: colWidths[i] - 4,
        align: "center",
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
    doc.font("Times-Roman").fontSize(7);

    grades.forEach((g) => {
      doc.lineWidth(0.5).rect(x, y, rowWidth, rowHeight).stroke();
      let curX = x;
      const values = [g.range, g.lg, g.gp];
      values.forEach((v, i) => {
        doc.text(String(v), curX + 2, y + 2, {
          width: colWidths[i] - 4,
          align: "center",
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
      throw new Error("Student enrollment not found for specified year");
    }

    if (
      !this.checkAccess(user, sId, enrollment.class, enrollment.section, yInt)
    ) {
      throw new Error(
        "You are not authorized to update this student's 4th subject",
      );
    }

    const updated = await prisma.student_enrollments.update({
      where: { id: enrollment.id },
      data: { fourth_subject_id: subjectId },
    });

    // 4th subject changes the rendered sheet — invalidate only for published exams.
    try {
      const affectedExams = await prisma.marks.findMany({
        where: {
          enrollment_id: enrollment.id,
          exam: { exam_year: yInt, visible: true },
        },
        distinct: ["exam_id"],
        select: { exam_id: true },
      });
      if (affectedExams.length > 0) {
        const { MarksheetService } = await import("./marksheet.service.js");
        for (const { exam_id } of affectedExams) {
          await MarksheetService.invalidate([sId], exam_id);
        }
      }
    } catch (invErr) {
      console.warn(
        "Marksheet invalidation failed after updateFourthSubject:",
        invErr instanceof Error ? invErr.message : invErr,
      );
    }

    return updated;
  }
}
