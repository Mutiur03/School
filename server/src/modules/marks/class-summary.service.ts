import PDFDocument from "pdfkit";
import fs from "fs";
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

type ColSpan = {
  col: SubjectCol;
  widths: number[];
};

const CLASS_NAMES: Record<string, string> = {
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
};

/** US Legal portrait in PDF points; landscape is applied via layout. */
const LEGAL_SIZE = "LEGAL";
const PAGE_MARGIN = 14;
/** Match Excel column character widths, with a wider Names column. */
const COL_UNITS = { roll: 8, name: 28, cell: 6 } as const;
const TITLE_H = 16;
const SUBTITLE_H = 14;
const CLASSLINE_H = 13;
const HEADER_ROW_H = 14;
const DATA_ROW_H = 13;
const FOOTER_RESERVE = 10;
const HEADER_FILL = "#F3F4F6";
const BORDER = "#000000";
const TEXT = "#000000";
/** Below this cell width (pt), shrink fonts/rows so content still fits. */
const COMFORTABLE_CELL_W = 18;
const MIN_FONT = 4.5;
const MIN_DATA_ROW_H = 9;
const MIN_HEADER_ROW_H = 9;

const FONT_REGULAR = "Times-Roman";
const FONT_BOLD = "Times-Bold";
const TIMES_FONT_PATHS = {
  regular: [
    process.env.MARKSHEET_FONT_REGULAR,
    "C:\\Windows\\Fonts\\times.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  ].filter(Boolean) as string[],
  bold: [
    process.env.MARKSHEET_FONT_BOLD,
    "C:\\Windows\\Fonts\\timesbd.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
  ].filter(Boolean) as string[],
};

/** Prefer real Times New Roman from disk; otherwise PDF built-in Times. */
function registerSummaryFonts(doc: any) {
  const regular = TIMES_FONT_PATHS.regular.find((p) => fs.existsSync(p));
  const bold = TIMES_FONT_PATHS.bold.find((p) => fs.existsSync(p));
  if (regular) doc.registerFont(FONT_REGULAR, regular);
  if (bold) doc.registerFont(FONT_BOLD, bold);
}

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

function sectionSortKey(section: string | null): string {
  return (section || "").trim().toUpperCase() || "~";
}

function groupRowsBySection(
  rows: StudentSummaryRow[],
): { section: string; rows: StudentSummaryRow[] }[] {
  const map = new Map<string, StudentSummaryRow[]>();
  for (const row of rows) {
    const key = (row.section || "").trim() || "—";
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return [...map.entries()]
    .sort(([a], [b]) => sectionSortKey(a).localeCompare(sectionSortKey(b)))
    .map(([section, sectionRows]) => ({
      section,
      rows: sectionRows.sort(
        (x, y) =>
          (x.roll ?? Number.MAX_SAFE_INTEGER) -
            (y.roll ?? Number.MAX_SAFE_INTEGER) ||
          x.name.localeCompare(y.name),
      ),
    }));
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
      return null;
    }

    return sectionQuery || null;
  }

  static async generateClassSummaryPDF(
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
        orderBy: [
          { section: "asc" },
          { roll: "asc" },
          { student: { name: "asc" } },
        ],
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

    const examId =
      withMarks[0].marks[0]?.exam_id ?? withMarks[0].marks[0]?.exam?.id;

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

      for (const row of aggregated) {
        if (row.marks == null) row.marks = 0;
        if (row.isGroup && Array.isArray(row.papers)) {
          for (const p of row.papers) {
            if (p.marks == null) p.marks = 0;
          }
        }
      }

      const examRows = aggregated.filter(
        (r: any) => r.assessment_type === "exam",
      );
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

    const buffer = await this.buildPdf({
      schoolName: school?.name ?? "School",
      exam,
      year: yearInt,
      classNum: cls,
      columns,
      rows: studentRows,
    });

    const sectionPart = sectionFilter ? String(sectionFilter) : "All";
    const safeExam = exam.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    const filename = `${cls}${sectionPart}_Summary_${safeExam}_${yearInt}.pdf`;

    return { buffer, filename };
  }

  private static async buildPdf(opts: {
    schoolName: string;
    exam: string;
    year: number;
    classNum: number;
    columns: SubjectCol[];
    rows: StudentSummaryRow[];
  }): Promise<Buffer> {
    const { schoolName, exam, year, classNum, columns, rows } = opts;
    // Legal landscape: 14" × 8.5" → 1008 × 612 pt
    const pageW = 1008;
    const pageH = 612;
    const contentW = pageW - PAGE_MARGIN * 2;
    const contentX = PAGE_MARGIN;

    // Same column proportions as the Excel sheet (8 / 22 / 6…).
    const subjectUnits = columns.reduce(
      (s, c) => s + (c.kind === "paper" ? 5 : 3),
      0,
    );
    const totalCharUnits =
      COL_UNITS.roll + COL_UNITS.name + COL_UNITS.cell * (subjectUnits + 3);
    const u = contentW / totalCharUnits;
    const rollW = COL_UNITS.roll * u;
    const nameW = COL_UNITS.name * u;
    const cellW = COL_UNITS.cell * u;

    // When many subjects squeeze columns, compact fonts + row heights to fit.
    const densityScale = Math.min(1, Math.max(0.55, cellW / COMFORTABLE_CELL_W));
    const dataFont = Math.max(MIN_FONT, 9 * densityScale);
    const headerFont = Math.max(MIN_FONT, 8 * densityScale);
    const headerLabelFont = Math.max(MIN_FONT, 9 * densityScale);
    const dataRowH = Math.max(MIN_DATA_ROW_H, DATA_ROW_H * densityScale);
    const headerRowH = Math.max(MIN_HEADER_ROW_H, HEADER_ROW_H * densityScale);

    const spans: ColSpan[] = [];
    for (const col of columns) {
      const n = col.kind === "paper" ? 5 : 3;
      spans.push({ col, widths: Array.from({ length: n }, () => cellW) });
    }
    const totalMarksW = cellW;
    const gpaW = cellW;
    const failedW = cellW;

    const subjectsW = spans.reduce(
      (s, sp) => s + sp.widths.reduce((a, b) => a + b, 0),
      0,
    );
    const totalsX = contentX + rollW + nameW + subjectsW;

    const sections = groupRowsBySection(rows);
    const doc = new (PDFDocument as any)({
      size: LEGAL_SIZE,
      layout: "landscape",
      margin: PAGE_MARGIN,
      autoFirstPage: false,
      info: {
        Title: `${schoolName} — ${exam} ${year} Class Summary`,
        Author: schoolName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    registerSummaryFonts(doc);

    const fillRect = (x: number, y: number, w: number, h: number, color: string) => {
      doc.save();
      doc.rect(x, y, w, h).fill(color);
      doc.restore();
    };

    const strokeRect = (x: number, y: number, w: number, h: number) => {
      doc.lineWidth(0.5).strokeColor(BORDER).rect(x, y, w, h).stroke();
    };

    const fitFontSize = (
      text: string,
      maxW: number,
      preferred: number,
      bold: boolean,
    ): number => {
      doc.font(bold ? FONT_BOLD : FONT_REGULAR);
      let size = preferred;
      while (size > MIN_FONT) {
        doc.fontSize(size);
        if (doc.widthOfString(text) <= maxW) return size;
        size -= 0.5;
      }
      return MIN_FONT;
    };

    const truncateToWidth = (text: string, maxW: number): string => {
      if (doc.widthOfString(text) <= maxW) return text;
      const ellipsis = "…";
      let lo = 0;
      let hi = text.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const candidate = text.slice(0, mid) + ellipsis;
        if (doc.widthOfString(candidate) <= maxW) lo = mid;
        else hi = mid - 1;
      }
      return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
    };

    const writeInBox = (
      text: string,
      x: number,
      y: number,
      w: number,
      h: number,
      opts: {
        bold?: boolean;
        size?: number;
        align?: "left" | "center";
        wrap?: boolean;
        /** Shrink font to fit; truncate only if still too wide at min size. */
        compact?: boolean;
      } = {},
    ) => {
      const preferred = opts.size ?? dataFont;
      const align = opts.align ?? "center";
      const bold = !!opts.bold;
      const prevX = doc.x;
      const prevY = doc.y;
      const pad = 1.5;
      const innerW = Math.max(1, w - pad * 2);

      doc.font(bold ? FONT_BOLD : FONT_REGULAR).fillColor(TEXT);

      let size = preferred;
      let display = text;

      if (opts.wrap) {
        size = preferred;
        while (size > MIN_FONT) {
          doc.fontSize(size);
          const textH = doc.heightOfString(display, {
            width: innerW,
            align,
          });
          if (textH <= h - 2) break;
          size -= 0.5;
        }
      } else if (opts.compact !== false) {
        size = fitFontSize(display, innerW, preferred, bold);
        doc.fontSize(size);
        display = truncateToWidth(display, innerW);
      } else {
        doc.fontSize(size);
        display = truncateToWidth(display, innerW);
      }

      doc.fontSize(size);
      doc.save();
      doc.rect(x, y, w, h).clip();

      if (opts.wrap) {
        const textH = doc.heightOfString(display, {
          width: innerW,
          align,
        });
        const blockH = Math.min(textH, h);
        const top = y + (h - blockH) / 2;
        doc.text(display, x + pad, top, {
          width: innerW,
          height: h,
          align,
          lineBreak: true,
        });
      } else {
        // baseline:'middle' + center Y → true vertical center inside the cell
        doc.text(display, x + pad, y + h / 2, {
          width: innerW,
          align,
          lineBreak: false,
          baseline: "middle",
        });
      }

      doc.restore();
      doc.x = prevX;
      doc.y = prevY;
    };

    const drawCentered = (
      text: string,
      y: number,
      fontSize: number,
    ) => {
      doc.font(FONT_BOLD).fontSize(fontSize).fillColor(TEXT);
      doc.text(text, contentX, y, {
        width: contentW,
        align: "center",
        lineBreak: false,
      });
    };

    const spanX = (span: ColSpan): number => {
      let x = contentX + rollW + nameW;
      for (const s of spans) {
        if (s === span) return x;
        for (const w of s.widths) x += w;
      }
      return x;
    };

    /** Excel header rows 4–6: merged Roll/Names; subject blocks; Total Marks/GPA/Total Failed. */
    const drawTableHeader = (y: number) => {
      const h1 = headerRowH;
      const h2 = headerRowH;
      const h3 = headerRowH;
      const headerH = h1 + h2 + h3;

      fillRect(contentX, y, contentW, headerH, HEADER_FILL);

      strokeRect(contentX, y, rollW, headerH);
      writeInBox("Roll No", contentX, y, rollW, headerH, {
        bold: true,
        size: headerLabelFont,
      });
      strokeRect(contentX + rollW, y, nameW, headerH);
      writeInBox("Names", contentX + rollW, y, nameW, headerH, {
        bold: true,
        size: headerLabelFont,
      });

      for (const span of spans) {
        const x0 = spanX(span);
        const blockW = span.widths.reduce((a, b) => a + b, 0);

        if (span.col.kind === "paper") {
          strokeRect(x0, y, blockW, h1);
          writeInBox(span.col.name, x0, y, blockW, h1, {
            bold: true,
            size: headerFont,
          });

          strokeRect(x0, y + h1, span.widths[0], h2);
          writeInBox("1st", x0, y + h1, span.widths[0], h2, {
            bold: true,
            size: headerFont,
          });
          strokeRect(x0 + span.widths[0], y + h1, span.widths[1], h2);
          writeInBox("2nd", x0 + span.widths[0], y + h1, span.widths[1], h2, {
            bold: true,
            size: headerFont,
          });
          const totalBlockW =
            span.widths[2] + span.widths[3] + span.widths[4];
          strokeRect(
            x0 + span.widths[0] + span.widths[1],
            y + h1,
            totalBlockW,
            h2,
          );
          writeInBox(
            "Total",
            x0 + span.widths[0] + span.widths[1],
            y + h1,
            totalBlockW,
            h2,
            { bold: true, size: headerFont },
          );

          const sub = ["Mark", "Mark", "Mark", "LG", "GP"];
          let sx = x0;
          for (let i = 0; i < 5; i++) {
            strokeRect(sx, y + h1 + h2, span.widths[i], h3);
            writeInBox(sub[i], sx, y + h1 + h2, span.widths[i], h3, {
              bold: true,
              size: headerFont,
            });
            sx += span.widths[i];
          }
        } else {
          strokeRect(x0, y, blockW, h1 + h2);
          writeInBox(span.col.name, x0, y, blockW, h1 + h2, {
            bold: true,
            size: headerFont,
          });
          const sub = ["Mark", "LG", "GP"];
          let sx = x0;
          for (let i = 0; i < 3; i++) {
            strokeRect(sx, y + h1 + h2, span.widths[i], h3);
            writeInBox(sub[i], sx, y + h1 + h2, span.widths[i], h3, {
              bold: true,
              size: headerFont,
            });
            sx += span.widths[i];
          }
        }
      }

      strokeRect(totalsX, y, totalMarksW, headerH);
      writeInBox("Total Marks", totalsX, y, totalMarksW, headerH, {
        bold: true,
        size: headerFont,
        wrap: true,
      });
      strokeRect(totalsX + totalMarksW, y, gpaW, headerH);
      writeInBox("GPA", totalsX + totalMarksW, y, gpaW, headerH, {
        bold: true,
        size: headerLabelFont,
      });
      strokeRect(totalsX + totalMarksW + gpaW, y, failedW, headerH);
      writeInBox(
        "Total\nFailed",
        totalsX + totalMarksW + gpaW,
        y,
        failedW,
        headerH,
        { bold: true, size: headerFont, wrap: true },
      );

      return headerH;
    };

    const drawDataRow = (row: StudentSummaryRow, y: number) => {
      const writeCell = (
        x: number,
        w: number,
        value: string | number,
        align: "left" | "center" = "center",
      ) => {
        strokeRect(x, y, w, dataRowH);
        writeInBox(String(value), x, y, w, dataRowH, {
          size: dataFont,
          align,
          compact: true,
        });
      };

      writeCell(contentX, rollW, row.roll ?? "");
      writeCell(contentX + rollW, nameW, row.name, "left");

      for (const span of spans) {
        const cell = row.cells[span.col.subjectId];
        const values: (string | number)[] =
          span.col.kind === "paper"
            ? cell && cell.kind === "paper"
              ? [cell.first, cell.second, cell.total, cell.lg, cell.gp]
              : [0, 0, 0, "F", 0]
            : cell && cell.kind === "single"
              ? [cell.mark, cell.lg, cell.gp]
              : [0, "F", 0];

        let x = spanX(span);
        for (let i = 0; i < span.widths.length; i++) {
          writeCell(x, span.widths[i], values[i] ?? "");
          x += span.widths[i];
        }
      }

      writeCell(totalsX, totalMarksW, row.totalMarks);
      writeCell(totalsX + totalMarksW, gpaW, row.gpa);
      writeCell(totalsX + totalMarksW + gpaW, failedW, row.failed);
    };

    const startSectionPage = (
      sectionLabel: string,
      pageIndexInSection: number,
    ) => {
      doc.addPage({
        size: LEGAL_SIZE,
        layout: "landscape",
        margin: PAGE_MARGIN,
      });
      let y = PAGE_MARGIN;

      drawCentered(schoolName, y, 14);
      y += TITLE_H;
      drawCentered(`${exam} ${year}`, y, 12);
      y += SUBTITLE_H;
      const sectionTitle =
        pageIndexInSection > 0
          ? `Class: ${classText(classNum)}, Section: ${sectionLabel} (cont.)`
          : `Class: ${classText(classNum)}, Section: ${sectionLabel}`;
      drawCentered(sectionTitle, y, 11);
      y += CLASSLINE_H + 2;

      const headerH = drawTableHeader(y);
      return y + headerH;
    };

    return new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      try {
        for (const { section, rows: sectionRows } of sections) {
          let pageInSection = 0;
          let y = startSectionPage(section, pageInSection);
          const maxY = pageH - PAGE_MARGIN - FOOTER_RESERVE;

          for (const row of sectionRows) {
            if (y + dataRowH > maxY) {
              pageInSection += 1;
              y = startSectionPage(section, pageInSection);
            }
            drawDataRow(row, y);
            y += dataRowH;
          }
        }

        if (sections.length === 0) {
          doc.addPage({
            size: LEGAL_SIZE,
            layout: "landscape",
            margin: PAGE_MARGIN,
          });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
