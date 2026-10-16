// Promotion rules v1: session marksheet body (student info + split-marks table + summary).
// Pure PDFKit drawing from the engine result. The caller draws the page shell
// (border, watermark, school header, signatures) with the existing marksheet helpers.
import { examsForClass, type StudentSessionResult } from './session-result.js';

export interface SessionMarksheetData {
  student: { name: string; class: number; section: string; roll: number };
  result: StudentSessionResult & { position: number };
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
  passMark: string;
  grade: string;
  gp: string;
}

export interface SessionTable {
  split: boolean;
  examRows: SessionRow[];
  continuousRows: SessionRow[];
  /** Exam-subject totals, same shape as SessionRow.marks. */
  totals: string[];
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
      passMark: s.isContinuous || !s.passMark ? '-' : String(s.passMark),
      grade: s.grade,
      gp: s.gp.toFixed(2),
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
  pair('Result:', data.result.isFailed ? 'Failed' : 'Passed', 420, 50, 75, 0);
  pair('Class:', classText[s.class] ?? String(s.class), 50, 45, 90, 1);
  pair('Section:', s.section || '-', 175, 55, 70, 1);
  pair('Roll No:', String(s.roll ?? '-'), 300, 55, 60, 1);
  pair('Position:', data.result.position ? String(data.result.position) : '-', 420, 60, 70, 1);
}

/** Draws student info, the session table and the summary. Returns the y below the last line. */
export function drawSessionMarksheetBody(doc: any, data: SessionMarksheetData): number {
  drawStudentInfo(doc, data);

  const table = buildSessionTable(data.result);
  const markW = table.split ? [62, 62, 44] : [80];
  const tailW = [42, 42, 42, 42]; // Full, Pass, Letter Grade, Grade Point
  const subjectW = WIDTH - [...markW, ...tailW].reduce((a, b) => a + b, 0);
  const widths = [subjectW, ...markW, ...tailW];
  const xs = widths.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [X0]);
  const markEnd = 1 + markW.length; // index of first tail column

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
  headerCell(doc, 'Obtained Marks', xs[1], y, xs[markEnd] - xs[1], ROW_H);
  doc
    .moveTo(xs[1], y + ROW_H)
    .lineTo(xs[markEnd], y + ROW_H)
    .stroke();
  const subHeads = table.split
    ? [data.previousExamName ?? 'Previous Exam', data.yearEndExamName, 'Total']
    : [data.yearEndExamName];
  subHeads.forEach((h, i) => {
    headerCell(doc, h, xs[1 + i], y + ROW_H, widths[1 + i], ROW_H, 8);
    if (i > 0) vline(doc, xs[1 + i], y + ROW_H, ROW_H);
  });
  ['Full Marks', 'Pass Marks', 'Letter Grade', 'Grade Point'].forEach((h, i) =>
    headerCell(doc, h, xs[markEnd + i], y, widths[markEnd + i], headH),
  );
  for (let i = 1; i < widths.length; i++) if (i <= 1 || i >= markEnd) vline(doc, xs[i], y, headH);
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
  const rowCells = (r: SessionRow) => [
    r.subject,
    ...r.marks,
    r.fullMark,
    r.passMark,
    r.grade,
    r.gp,
  ];

  table.examRows.forEach((r) => drawRow(rowCells(r)));
  drawRow(['Total Marks', ...table.totals, '', '', '', ''], { bold: true });

  if (table.continuousRows.length) {
    ensure(ROW_H * 2);
    cell(doc, 'Continuous assessment', X0, y + 4, WIDTH, ROW_H - 4, { bold: true, size: 11 });
    y += ROW_H;
    table.continuousRows.forEach((r) => drawRow(rowCells(r)));
  }

  // Summary: Grand Total | GPA.
  const r = data.result;
  ensure(ROW_H);
  doc.lineWidth(0.5).rect(X0, y, WIDTH, ROW_H).stroke('#000000');
  const totalCol = markEnd - 1;
  cell(doc, 'Grand Total Marks', X0, y, xs[totalCol] - X0 - 4, ROW_H, {
    bold: true,
    align: 'right',
  });
  [totalCol, markEnd, markEnd + 2].forEach((i) => vline(doc, xs[i], y, ROW_H));
  cell(doc, String(r.grandTotal), xs[totalCol], y, widths[totalCol], ROW_H, { bold: true });
  cell(doc, 'GPA', xs[markEnd], y, widths[markEnd] * 2, ROW_H, { bold: true });
  cell(doc, r.gpa.toFixed(2), xs[markEnd + 2], y, widths[markEnd + 2] * 2, ROW_H, { bold: true });
  y += ROW_H;

  for (const note of data.notes ?? []) {
    y += 4;
    doc.font(FONT).fontSize(9).fillColor('#000000').text(note, X0, y, { width: WIDTH });
    y += 11;
  }
  return y + 8;
}
