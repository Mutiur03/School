import ExcelJS from "exceljs";
import { prisma } from "@/config/prisma.js";
import { getRlsContext } from "@/config/rlsContextStore.js";
import { ApiError } from "@/utils/ApiError.js";
import { MarksService } from "./marks.service.js";

type SubjectCol =
  | {
      kind: "paper";
      subjectId: number;
      name: string;
      priority: number;
    }
  | {
      kind: "single";
      subjectId: number;
      name: string;
      priority: number;
    };

type StudentSummaryRow = {
  roll: number | null;
  name: string;
  section: string | null;
  cells: Record<
    number,
    | {
        kind: "paper";
        first: number;
        second: number;
        total: number;
        lg: string;
        gp: number;
      }
    | {
        kind: "single";
        mark: number;
        lg: string;
        gp: number;
      }
  >;
  totalMarks: number;
  gpa: number;
  failed: number;
};

const CLASS_NAMES: Record<string, string> = {
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
};

function classText(classNum: number | string): string {
  return CLASS_NAMES[String(classNum)] || String(classNum);
}

function gradeForRow(
  row: any,
  classNum: number,
  fourthSubjectId: number | null,
) {
  const obtained = Number(row.marks);
  const fullMark = Number(row.full_mark || 100);
  const safeObtained = Number.isFinite(obtained) ? obtained : 0;
  const safeFull = Number.isFinite(fullMark) && fullMark > 0 ? fullMark : 100;
  const percentage = (safeObtained / safeFull) * 100;
  const isOptional = row.subject_id === fourthSubjectId;

  return MarksService.getGradeByPercentage(percentage, {
    total: Number.isFinite(obtained) ? row.marks : 0,
    total_pass: row.pass_mark,
    cq: row.cq_marks,
    cq_pass: row.cq_pass_mark,
    mcq: row.mcq_marks,
    mcq_pass: row.mcq_pass_mark,
    pr: row.practical_marks,
    pr_pass: row.practical_pass_mark,
    className: classNum,
    isOptional,
    marking_scheme: row.marking_scheme,
  });
}

function countFailed(
  rows: any[],
  classNum: number,
  fourthSubjectId: number | null,
  applyBonus: boolean,
): number {
  let failed = 0;
  for (const row of rows) {
    if (row.assessment_type !== "exam") continue;
    const obtained = Number(row.marks);
    if (!Number.isFinite(obtained)) {
      // Missing marks count as fail for non-optional subjects.
      const isOptional = row.subject_id === fourthSubjectId;
      if (!(isOptional && applyBonus)) failed++;
      continue;
    }
    const isOptional = row.subject_id === fourthSubjectId;
    const grade = gradeForRow(row, classNum, fourthSubjectId);
    if (isOptional && applyBonus) continue;
    if (grade.lg === "F") failed++;
  }
  return failed;
}

export class ClassSummaryService {
  static resolveSectionScope(
    user: any,
    cls: number,
    year: number,
    sectionQuery?: string,
  ): string | null {
    if (user?.role === "teacher") {
      const assignedSections = (user.levels ?? [])
        .filter((l: any) => l.class_name === cls && l.year === year)
        .map((l: any) => l.section)
        .filter(Boolean) as string[];

      if (assignedSections.length === 0) {
        throw new ApiError(403, "You are not assigned to this class.");
      }
      if (sectionQuery) {
        if (!assignedSections.includes(sectionQuery)) {
          throw new ApiError(403, "You are not assigned to this section.");
        }
        return sectionQuery;
      }
      return null; // all assigned sections
    }

    // admin (and others with route access): honor optional section filter
    return sectionQuery || null;
  }

  static async generateClassSummaryExcel(
    className: string,
    year: string,
    exam: string,
    user: any,
    sectionQuery?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const cls = Number(className);
    const yearInt = parseInt(year, 10);
    if (!Number.isFinite(cls) || !Number.isFinite(yearInt)) {
      throw new ApiError(400, "Invalid class or year");
    }

    const sectionFilter = this.resolveSectionScope(
      user,
      cls,
      yearInt,
      sectionQuery,
    );

    const where: any = {
      class: cls,
      year: yearInt,
    };

    if (sectionFilter) {
      where.section = sectionFilter;
    } else if (user?.role === "teacher") {
      const assignedSections = (user.levels ?? [])
        .filter((l: any) => l.class_name === cls && l.year === yearInt)
        .map((l: any) => l.section)
        .filter(Boolean);
      where.section = { in: assignedSections };
    }

    const schoolId = getRlsContext()?.schoolId;
    const [school, enrollments, classSubjects, applyBonus] = await Promise.all([
      schoolId
        ? prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
          })
        : Promise.resolve(null),
      prisma.student_enrollments.findMany({
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
                },
              },
              exam: { select: { id: true, exam_name: true } },
            },
          },
        },
        orderBy: [{ roll: "asc" }, { student: { name: "asc" } }],
      }),
      MarksService.loadMarksheetSubjects(cls, yearInt),
      MarksService.shouldApplyFourthSubjectBonus(cls, yearInt),
    ]);

    const withMarks = enrollments.filter((e) =>
      (e.marks || []).some((m) => m.marks !== null && m.marks !== undefined),
    );

    if (withMarks.length === 0) {
      throw new ApiError(404, "No marks found for this class and exam");
    }

    const examId = withMarks[0].marks[0]?.exam_id ?? withMarks[0].marks[0]?.exam?.id;

    const studentRows: StudentSummaryRow[] = [];
    const colMap = new Map<number, SubjectCol>();

    for (const enrollment of withMarks) {
      const filled = MarksService.fillMissingSubjectMarks(
        enrollment.marks || [],
        classSubjects,
        enrollment.group,
        {
          enrollment_id: enrollment.id,
          exam_id: examId,
          enrollment,
          exam: enrollment.marks[0]?.exam,
        },
      );

      const aggregated = MarksService.aggregatePaperMarks(
        filled.map((m: any) => ({
          ...m,
          subject: m.subject,
          subject_id: m.subject_id,
          marks: m.marks,
          cq_marks: m.cq_marks,
          mcq_marks: m.mcq_marks,
          practical_marks: m.practical_marks,
        })),
      );

      // Summary sheet treats missing marks as 0 / F (like the sample Excel).
      for (const row of aggregated) {
        if (row.marks == null) row.marks = 0;
        if (row.isGroup && Array.isArray(row.papers)) {
          for (const p of row.papers) {
            if (p.marks == null) p.marks = 0;
          }
        }
      }

      const examRows = aggregated.filter((r: any) => r.assessment_type === "exam");
      const fourthId = enrollment.fourth_subject_id ?? null;
      const { gpa, totalMarks } = MarksService.calculateGPA(
        examRows,
        fourthId,
        applyBonus,
        cls,
      );
      const failed = countFailed(examRows, cls, fourthId, applyBonus);

      const cells: StudentSummaryRow["cells"] = {};
      for (const row of examRows) {
        const subjectId = row.subject_id as number;
        if (!colMap.has(subjectId)) {
          if (row.isGroup) {
            colMap.set(subjectId, {
              kind: "paper",
              subjectId,
              name: row.subject,
              priority: row.priority ?? 0,
            });
          } else {
            colMap.set(subjectId, {
              kind: "single",
              subjectId,
              name: row.subject,
              priority: row.priority ?? 0,
            });
          }
        }

        const grade = gradeForRow(row, cls, fourthId);
        if (row.isGroup) {
          const papers = [...(row.papers || [])].sort(
            (a: any, b: any) => (a.priority || 0) - (b.priority || 0),
          );
          const first = Number(papers[0]?.marks);
          const second = Number(papers[1]?.marks);
          const total = Number(row.marks);
          cells[subjectId] = {
            kind: "paper",
            first: Number.isFinite(first) ? first : 0,
            second: Number.isFinite(second) ? second : 0,
            total: Number.isFinite(total) ? total : 0,
            lg: grade.lg,
            gp: grade.gp,
          };
        } else {
          const mark = Number(row.marks);
          cells[subjectId] = {
            kind: "single",
            mark: Number.isFinite(mark) ? mark : 0,
            lg: grade.lg,
            gp: grade.gp,
          };
        }
      }

      studentRows.push({
        roll: enrollment.roll,
        name: enrollment.student.name,
        section: enrollment.section,
        cells,
        totalMarks,
        gpa: Math.round(gpa * 100) / 100,
        failed,
      });
    }

    const columns = [...colMap.values()].sort(
      (a, b) => a.priority - b.priority || a.subjectId - b.subjectId,
    );

    const buffer = await this.buildWorkbook({
      schoolName: school?.name ?? "School",
      exam,
      year: yearInt,
      classNum: cls,
      sectionLabel: sectionFilter ?? "All Sections",
      columns,
      rows: studentRows,
    });

    const sectionPart = sectionFilter ? String(sectionFilter) : "All";
    const safeExam = exam.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    const filename = `${cls}${sectionPart}_Summary_${safeExam}_${yearInt}.xlsx`;

    return { buffer, filename };
  }

  private static async buildWorkbook(opts: {
    schoolName: string;
    exam: string;
    year: number;
    classNum: number;
    sectionLabel: string;
    columns: SubjectCol[];
    rows: StudentSummaryRow[];
  }): Promise<Buffer> {
    const { schoolName, exam, year, classNum, sectionLabel, columns, rows } =
      opts;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Summary", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    // Column layout: A=Roll, B=Name, then subject blocks, then Total/GPA/Failed
    type Span = { start: number; end: number; col: SubjectCol };
    const spans: Span[] = [];
    let cursor = 3; // 1-based Excel col; start after Roll+Name
    for (const col of columns) {
      const width = col.kind === "paper" ? 5 : 3;
      spans.push({ start: cursor, end: cursor + width - 1, col });
      cursor += width;
    }
    const totalMarksCol = cursor;
    const gpaCol = cursor + 1;
    const failedCol = cursor + 2;
    const lastCol = failedCol;

    sheet.mergeCells(1, 1, 1, lastCol);
    sheet.mergeCells(2, 1, 2, lastCol);
    sheet.mergeCells(3, 1, 3, lastCol);

    const title1 = sheet.getCell(1, 1);
    title1.value = schoolName;
    title1.font = { bold: true, size: 14 };
    title1.alignment = { horizontal: "center", vertical: "middle" };

    const title2 = sheet.getCell(2, 1);
    title2.value = `${exam} ${year}`;
    title2.font = { bold: true, size: 12 };
    title2.alignment = { horizontal: "center", vertical: "middle" };

    const title3 = sheet.getCell(3, 1);
    title3.value = `Class: ${classText(classNum)}, Section: ${sectionLabel}`;
    title3.font = { bold: true, size: 11 };
    title3.alignment = { horizontal: "center", vertical: "middle" };

    // Roll / Names span rows 4-6
    sheet.mergeCells(4, 1, 6, 1);
    sheet.mergeCells(4, 2, 6, 2);
    sheet.getCell(4, 1).value = "Roll No";
    sheet.getCell(4, 2).value = "Names";

    for (const span of spans) {
      if (span.col.kind === "paper") {
        // Subject name over first row of header; 1st/2nd/Total on row 5; Mark/LG/GP on row 6
        sheet.mergeCells(4, span.start, 4, span.end);
        sheet.getCell(4, span.start).value = span.col.name;

        sheet.getCell(5, span.start).value = "1st";
        sheet.getCell(5, span.start + 1).value = "2nd";
        sheet.mergeCells(5, span.start + 2, 5, span.end);
        sheet.getCell(5, span.start + 2).value = "Total";

        sheet.getCell(6, span.start).value = "Mark";
        sheet.getCell(6, span.start + 1).value = "Mark";
        sheet.getCell(6, span.start + 2).value = "Mark";
        sheet.getCell(6, span.start + 3).value = "LG";
        sheet.getCell(6, span.start + 4).value = "GP";
      } else {
        sheet.mergeCells(4, span.start, 5, span.end);
        sheet.getCell(4, span.start).value = span.col.name;
        sheet.getCell(6, span.start).value = "Mark";
        sheet.getCell(6, span.start + 1).value = "LG";
        sheet.getCell(6, span.start + 2).value = "GP";
      }
    }

    sheet.mergeCells(4, totalMarksCol, 6, totalMarksCol);
    sheet.getCell(4, totalMarksCol).value = "Total Marks";
    sheet.mergeCells(4, gpaCol, 6, gpaCol);
    sheet.getCell(4, gpaCol).value = "GPA";
    sheet.mergeCells(4, failedCol, 6, failedCol);
    sheet.getCell(4, failedCol).value = "Total\nFailed";

    const headerFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    for (let r = 4; r <= 6; r++) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = { bold: true, size: 9 };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = headerFill;
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 22;
    for (let c = 3; c <= lastCol; c++) {
      sheet.getColumn(c).width = 6;
    }

    let dataRow = 7;
    for (const row of rows) {
      const excelRow = sheet.getRow(dataRow);
      excelRow.getCell(1).value = row.roll ?? "";
      excelRow.getCell(2).value = row.name;

      for (const span of spans) {
        const cell = row.cells[span.col.subjectId];
        if (!cell) {
          if (span.col.kind === "paper") {
            excelRow.getCell(span.start).value = 0;
            excelRow.getCell(span.start + 1).value = 0;
            excelRow.getCell(span.start + 2).value = 0;
            excelRow.getCell(span.start + 3).value = "F";
            excelRow.getCell(span.start + 4).value = 0;
          } else {
            excelRow.getCell(span.start).value = 0;
            excelRow.getCell(span.start + 1).value = "F";
            excelRow.getCell(span.start + 2).value = 0;
          }
          continue;
        }
        if (cell.kind === "paper") {
          excelRow.getCell(span.start).value = cell.first;
          excelRow.getCell(span.start + 1).value = cell.second;
          excelRow.getCell(span.start + 2).value = cell.total;
          excelRow.getCell(span.start + 3).value = cell.lg;
          excelRow.getCell(span.start + 4).value = cell.gp;
        } else {
          excelRow.getCell(span.start).value = cell.mark;
          excelRow.getCell(span.start + 1).value = cell.lg;
          excelRow.getCell(span.start + 2).value = cell.gp;
        }
      }

      excelRow.getCell(totalMarksCol).value = row.totalMarks;
      excelRow.getCell(gpaCol).value = row.gpa;
      excelRow.getCell(failedCol).value = row.failed;

      for (let c = 1; c <= lastCol; c++) {
        const cell = excelRow.getCell(c);
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: "middle",
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.font = { size: 9 };
      }
      dataRow++;
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
