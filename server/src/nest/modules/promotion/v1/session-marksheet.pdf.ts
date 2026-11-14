// Promotion rules v1: session marksheet body (student info + split-marks table + summary).
// Pure PDFKit drawing from the engine result. The caller draws the page shell
// (border, watermark, school header, signatures) with the existing marksheet helpers.
import { examsForClass, type StudentSessionResult } from './session-result.js';

export interface SessionMarksheetData {
  student: { name: string; class: number; section: string; roll: number };
  /** `position` / `officialResult`: what generation saved (0 / null = not generated, shown as "-"). */
  result: StudentSessionResult & { position: number; officialResult?: string | null };
  previousExamName: string | null;
  yearEndExamName: string;
  /** Footer lines under the summary (result date, return note, ...). */
  notes?: string[];
}

export interface SessionRow {
  subject: string;
  /** split: [previous, year-end, total]; year-end only: [year-end]. */
  marks: string[];
  fullMark: string;
  grade: string;
  gp: string;
  highestMark: string;
  /** Main subjects: one row per paper (marks + full mark); grade/GP span them. */
  papers?: {
    subjectId: number;
    subject: string;
    marks: string[];
    fullMark: string;
    highestMark: string;
  }[];
}

export interface SessionTable {
  split: boolean;
  examRows: SessionRow[];
  continuousRows: SessionRow[];
  /** Exam-subject totals, same shape as SessionRow.marks. */
  totals: string[];
  /** Sum of the exam subjects' full marks (Total Marks row, Full Marks column). */
  totalFull: string;
  /** Full marks of every subject, continuous assessment included (Grand Total row). */
  grandFull: string;
}

const fmt = (n: number | null | undefined) => (n == null ? '-' : String(n));

export function buildSessionTable(result: StudentSessionResult): SessionTable {
  const split = examsForClass(result.classLevel) === 'both';
  const toRow = (s: StudentSessionResult['subjects'][number]): SessionRow => {
    const entered = s.yearEnd.marks != null || s.previous?.marks != null;
    return {
      subject: s.name,
      marks: split
        ? [fmt(s.previous?.marks), fmt(s.yearEnd.marks), entered ? String(s.combined) : '-']
        : [fmt(s.yearEnd.marks)],
      fullMark: s.fullMark > 0 ? String(s.fullMark) : '-',
      grade: s.grade,
      gp: s.gp.toFixed(2),
      highestMark: s.classHighestMark == null ? '-' : String(s.classHighestMark),
      ...(s.papers?.length && {
        papers: s.papers.map((p) => ({
          subjectId: p.subjectId,
          subject: p.name,
          marks: split
            ? [
                fmt(p.previous?.marks),
                fmt(p.yearEnd.marks),
                p.yearEnd.marks != null || p.previous?.marks != null ? String(p.combined) : '-',
              ]
            : [fmt(p.yearEnd.marks)],
          fullMark: p.fullMark > 0 ? String(p.fullMark) : '-',
          highestMark:
            result.classHighestBySubject?.[p.subjectId] == null
              ? '-'
              : String(result.classHighestBySubject[p.subjectId]),
        })),
      }),
    };
  };
  const exam = result.subjects.filter((s) => !s.isContinuous);
  const sum = (pick: (s: (typeof exam)[number]) => number | null | undefined) =>
    String(exam.reduce((t, s) => t + (pick(s) ?? 0), 0));
  return {
    split,
    examRows: exam.map(toRow),
    continuousRows: result.subjects.filter((s) => s.isContinuous).map(toRow),
    totals: split
      ? [sum((s) => s.previous?.marks), sum((s) => s.yearEnd.marks), String(result.totalMarks)]
      : [String(result.totalMarks)],
    totalFull: sum((s) => s.fullMark),
    grandFull: String(result.subjects.reduce((t, s) => t + s.fullMark, 0)),
  };
}

// Same metrics as the per-exam marksheet (marksheets/pdf/marksheet-draw.ts PDF_STYLES).
const X0 = 50;
const WIDTH = 495;
const ROW_H = 20;
const FONT = 'Times-Roman';
const BOLD = 'Times-Bold';
const PAGE_BOTTOM = 750;

type Opts = { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number };

/** Single-line text vertically centred in a box; squeezed horizontally when too wide. */
function cell(doc: any, text: string, x: number, y: number, w: number, h: number, o: Opts = {}) {
  const size = o.size ?? 9;
  doc
    .font(o.bold ? BOLD : FONT)
    .fontSize(size)
    .fillColor('#000000');
  const pad = 4;
  const box = w - pad * 2;
  const textW = doc.widthOfString(text);
  const ty = y + Math.max(0, (h - doc.currentLineHeight()) / 2);
  const scale = textW > box && textW > 0 ? box / textW : 1;
  doc.save();
  doc.scale(scale, 1);
  doc.text(text, (x + pad) / scale, ty, {
    width: box / scale,
    align: o.align ?? 'center',
    lineBreak: false,
  });
  doc.restore();
}

/** Wrapping header text centred in a (possibly multi-row) box. */
function headerCell(doc: any, text: string, x: number, y: number, w: number, h: number, size = 9) {
  doc.font(BOLD).fontSize(size).fillColor('#000000');
  const th = doc.heightOfString(text, { width: w - 4, align: 'center' });
  doc.text(text, x + 2, y + Math.max(0, (h - th) / 2), { width: w - 4, align: 'center' });
}

const vline = (doc: any, x: number, y: number, h: number) =>
  doc
    .moveTo(x, y)
    .lineTo(x, y + h)
    .stroke();

function drawStudentInfo(doc: any, data: SessionMarksheetData) {
  const y = 185;
  const h = 18;
  const pair = (label: string, value: string, x: number, lw: number, vw: number, row: number) => {
    cell(doc, label, x, y + row * h, lw, h, { bold: true, align: 'left', size: 11 });
    cell(doc, value, x + lw - 6, y + row * h, vw, h, { align: 'left', size: 11 });
  };
  const classText: Record<number, string> = {
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
  };
  const s = data.student;
  pair("Student's Name:", s.name, 50, 100, 270, 0);
  pair('Result:', data.result.officialResult ?? '-', 420, 50, 75, 0);
  pair('Class:', classText[s.class] ?? String(s.class), 50, 45, 90, 1);
  pair('Section:', s.section || '-', 175, 55, 70, 1);
  pair('Roll No:', String(s.roll ?? '-'), 300, 55, 60, 1);
  pair('Position:', data.result.position ? String(data.result.position) : '-', 420, 60, 70, 1);
}

/** Draws student info, the session table and the summary. Returns the y below the last line. */
export function drawSessionMarksheetBody(doc: any, data: SessionMarksheetData): number {
  drawStudentInfo(doc, data);

  const table = buildSessionTable(data.result);
  // Columns: Subject | Full Marks | obtained marks (previous, year-end, total) | LG | GP | Highest.
  // Subjects with papers split the last marks column (paper totals | merged subject total), so it
  // gets wider when any are present.
  const hasPapers = [...table.examRows, ...table.continuousRows].some((r) => r.papers?.length);
  const fullW = 50;
  const markW = table.split ? (hasPapers ? [58, 58, 72] : [62, 62, 44]) : [80];
  // Letter Grade, Grade Point, Highest Mark
  const tailW = table.split && hasPapers ? [45, 45, 50] : [50, 50, 55];
  const subjectW = WIDTH - [fullW, ...markW, ...tailW].reduce((a, b) => a + b, 0);
  const widths = [subjectW, fullW, ...markW, ...tailW];
  const xs = widths.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [X0]);
  const markStart = 2; // first obtained-marks column
  const markEnd = markStart + markW.length; // index of first tail column (Letter Grade)

  let y = 232;
  const ensure = (h: number) => {
    if (y + h <= PAGE_BOTTOM) return;
    doc.addPage();
    doc.rect(20, 20, 555, 802).lineWidth(2).stroke('#000000');
    doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke('#666666');
    y = 50;
  };

  // Header: two rows; "Obtained Marks" spans the exam sub-columns.
  const headH = ROW_H * 2;
  doc.lineWidth(0.5).rect(X0, y, WIDTH, headH).fillAndStroke('#f3f4f6', '#000000');
  headerCell(doc, 'Name of Subjects', xs[0], y, widths[0], headH);
  headerCell(doc, 'Full Marks', xs[1], y, widths[1], headH);
  headerCell(doc, 'Obtained Marks', xs[markStart], y, xs[markEnd] - xs[markStart], ROW_H);
  doc
    .moveTo(xs[markStart], y + ROW_H)
    .lineTo(xs[markEnd], y + ROW_H)
    .stroke();
  // "Half Yearly Examination" → "Half Yearly Exam": the full word crowds the narrow columns.
  const short = (h: string) => h.replace(/\bExamination\b/i, 'Exam');
  const subHeads = table.split
    ? [short(data.previousExamName ?? 'Previous Exam'), short(data.yearEndExamName), 'Total']
    : [short(data.yearEndExamName)];
  subHeads.forEach((h, i) => {
    headerCell(doc, h, xs[markStart + i], y + ROW_H, widths[markStart + i], ROW_H, 8);
    if (i > 0) vline(doc, xs[markStart + i], y + ROW_H, ROW_H);
  });
  ['Letter Grade', 'Grade Point', 'Highest Marks'].forEach((h, i) =>
    headerCell(doc, h, xs[markEnd + i], y, widths[markEnd + i], headH),
  );
  for (let i = 1; i < widths.length; i++) {
    if (i <= markStart || i >= markEnd) vline(doc, xs[i], y, headH);
  }
  y += headH;

  const drawRow = (cells: string[], o: Opts = {}) => {
    ensure(ROW_H);
    doc.lineWidth(0.5).rect(X0, y, WIDTH, ROW_H).stroke('#000000');
    for (let i = 1; i < widths.length; i++) vline(doc, xs[i], y, ROW_H);
    cells.forEach((c, i) =>
      cell(doc, c, xs[i], y, widths[i], ROW_H, {
        bold: o.bold,
        align: i === 0 ? 'left' : 'center',
      }),
    );
    y += ROW_H;
  };
  // A main subject: one row per paper like the per-exam sheet (each with its own highest mark);
  // the last marks column is split: each paper's total, then the merged subject total spanning
  // the papers; grade and GP span the papers too.
  const drawSubject = (r: SessionRow) => {
    if (!r.papers) {
      drawRow([r.subject, r.fullMark, ...r.marks, r.grade, r.gp, r.highestMark]);
      return;
    }
    const h = ROW_H * r.papers.length;
    ensure(h);
    doc.lineWidth(0.5).rect(X0, y, WIDTH, h).stroke('#000000');
    const spanFrom = markEnd; // grade and GP span the papers
    const last = markEnd - 1;
    const half = widths[last] / 2;
    for (let i = 1; i < widths.length; i++) vline(doc, xs[i], y, h);
    vline(doc, xs[last] + half, y, h);
    r.papers.forEach((p, k) => {
      const py = y + k * ROW_H;
      const hx = xs[spanFrom + 2];
      if (k > 0) {
        doc
          .moveTo(X0, py)
          .lineTo(xs[last] + half, py)
          .stroke();
        doc
          .moveTo(hx, py)
          .lineTo(X0 + WIDTH, py)
          .stroke();
      }
      [p.subject, p.fullMark, ...p.marks].forEach((c, i) =>
        cell(doc, c, xs[i], py, i === last ? half : widths[i], ROW_H, {
          align: i === 0 ? 'left' : 'center',
        }),
      );
      cell(doc, p.highestMark, hx, py, widths[spanFrom + 2], ROW_H);
    });
    cell(doc, r.marks[r.marks.length - 1] ?? '-', xs[last] + half, y, half, h);
    cell(doc, r.grade, xs[spanFrom], y, widths[spanFrom], h);
    cell(doc, r.gp, xs[spanFrom + 1], y, widths[spanFrom + 1], h);
    y += h;
  };

  table.examRows.forEach(drawSubject);
  drawRow(
    [
      'Total Marks',
      table.totalFull,
      ...table.totals,
      '',
      '',
      String(data.result.classHighestTotal ?? '-'),
    ],
    { bold: true },
  );

  if (table.continuousRows.length) {
    ensure(ROW_H * 2);
    cell(doc, 'Continuous Assessment', X0, y + 4, WIDTH, ROW_H - 4, { bold: true, size: 11 });
    y += ROW_H;
    table.continuousRows.forEach(drawSubject);
  }

  // Summary: Grand Total | GPA.
  const r = data.result;
  ensure(ROW_H);
  doc.lineWidth(0.5).rect(X0, y, WIDTH, ROW_H).stroke('#000000');
  const totalCol = markEnd - 1;
  // Label | grand full marks | (previous / year-end merged) | grand total | GPA | value | highest.
  cell(doc, 'Grand Total Marks', X0, y, widths[0], ROW_H, { bold: true, align: 'left' });
  cell(doc, table.grandFull, xs[1], y, widths[1], ROW_H, { bold: true });
  [1, markStart, totalCol, markEnd, markEnd + 1, markEnd + 2].forEach((i) =>
    vline(doc, xs[i], y, ROW_H),
  );
  cell(doc, String(r.grandTotal), xs[totalCol], y, widths[totalCol], ROW_H, { bold: true });
  cell(doc, 'GPA', xs[markEnd], y, widths[markEnd], ROW_H, { bold: true });
  cell(doc, r.gpa.toFixed(2), xs[markEnd + 1], y, widths[markEnd + 1], ROW_H, { bold: true });
  cell(
    doc,
    String(r.classHighestGrandTotal ?? r.grandTotal),
    xs[markEnd + 2],
    y,
    widths[markEnd + 2],
    ROW_H,
    { bold: true },
  );
  y += ROW_H;

  for (const note of data.notes ?? []) {
    y += 4;
    doc.font(FONT).fontSize(9).fillColor('#000000').text(note, X0, y, { width: WIDTH });
    y += 11;
  }
  return y + 8;
}
