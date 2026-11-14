import PDFDocument from 'pdfkit';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import { loadSchoolHeader } from '../../common/school-pdf.js';
import { loadSessionResults, officialResult } from './session-results.js';

type FinalResultRow = {
  classLevel: number;
  rank: number;
  name: string;
  /** This year's section and roll, e.g. "A-35". */
  secRoll: string;
  total: number;
  gpa: string;
  failCount: number;
  /** Saved result: Passed / Failed. */
  result: string;
  nextClass: string;
  nextRoll: string;
};

// A4 portrait, points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 21;
// Two lines: labels such as "Total Marks" wrap in their narrow columns.
const HEAD_ROW_HEIGHT = 30;
const CELL_PAD = 7;
const FOOTER_Y = PAGE_HEIGHT - MARGIN + 6;
// Rows end above the footer rule.
const CONTENT_BOTTOM = FOOTER_Y - 14;
type Column = {
  label: string;
  width: number;
  align: 'left' | 'center';
  value: (row: FinalResultRow) => string;
};
const RANK: Column = { label: 'Rank', width: 40, align: 'center', value: (r) => String(r.rank) };
const TOTAL: Column = {
  label: 'Total Marks',
  width: 50,
  align: 'center',
  value: (r) => r.total.toLocaleString('en-US'),
};
const GPA: Column = { label: 'GPA', width: 40, align: 'center', value: (r) => r.gpa };
const FAILS: Column = {
  label: 'Fail Count',
  width: 42,
  align: 'center',
  value: (r) => String(r.failCount),
};
const name = (width: number): Column => ({
  label: 'Student Name',
  width,
  align: 'left',
  value: (r) => r.name,
});
// Widths add up to the 515pt content width.
const COLUMNS: Column[] = [
  RANK,
  name(185),
  { label: 'Current Roll', width: 60, align: 'center', value: (r) => r.secRoll },
  TOTAL,
  GPA,
  FAILS,
  { label: 'Next Class', width: 46, align: 'center', value: (r) => r.nextClass },
  { label: 'New Roll', width: 52, align: 'center', value: (r) => r.nextRoll },
];
// Class 10 graduates: no next class/roll, so the result is spelled out instead.
const GRADUATING_COLUMNS: Column[] = [
  RANK,
  name(223),
  { label: 'Current Roll', width: 60, align: 'center', value: (r) => r.secRoll },
  TOTAL,
  GPA,
  FAILS,
  { label: 'Result', width: 60, align: 'center', value: (r) => r.result },
];
const INK = '#000000';
const SUB_INK = '#333333';
const RULE = '#000000';

const className = (value: number) => `Class ${value}`;

@Injectable()
export class FinalResultService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async generate(schoolId: number, year: number, classes?: number[]): Promise<Buffer> {
    const [header, session, enrollments, exams] = await Promise.all([
      loadSchoolHeader(this.prisma, schoolId),
      loadSessionResults(this.prisma, schoolId, year),
      this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, year, student: { available: true } },
        select: {
          id: true,
          class: true,
          next_year_roll: true,
          next_year_section: true,
        },
      }),
      this.prisma.exams.findMany({
        where: { school_id: schoolId, exam_year: year, is_year_end: true },
        select: { id: true, exam_name: true },
      }),
    ]);
    const examName = new Map(exams.map((e) => [e.id, e.exam_name]));

    const enrollmentById = new Map(enrollments.map((row) => [row.id, row]));
    const rows: FinalResultRow[] = session.results
      .map((result) => {
        if (classes?.length && !classes.includes(result.classLevel)) return null;
        const enrollment = enrollmentById.get(result.enrollmentId);
        // Only generated (saved) results: never the live calculation.
        const official = officialResult(result);
        if (
          !enrollment ||
          result.saved.merit <= 0 ||
          (official !== 'Passed' && official !== 'Failed')
        ) {
          return null;
        }
        const nextClass =
          result.classLevel === 10
            ? ''
            : official === 'Passed'
              ? String(result.classLevel + 1)
              : String(result.classLevel);
        return {
          classLevel: result.classLevel,
          rank: result.saved.merit,
          name: result.studentName,
          secRoll: result.section ? `${result.section}-${result.roll}` : String(result.roll),
          total: result.totalMarks,
          gpa: result.gpa.toFixed(2),
          failCount: result.saved.failCount,
          result: official,
          nextClass,
          nextRoll:
            result.classLevel === 10 || !enrollment.next_year_roll
              ? ''
              : String(enrollment.next_year_roll),
        };
      })
      .filter((row): row is FinalResultRow => row !== null)
      .sort(
        (a, b) => a.classLevel - b.classLevel || a.rank - b.rank || a.name.localeCompare(b.name),
      );

    const doc = new (PDFDocument as any)({
      size: 'A4',
      layout: 'portrait',
      margin: MARGIN,
      autoFirstPage: false,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const byClass = new Map<number, FinalResultRow[]>();
    for (const row of rows) {
      const list = byClass.get(row.classLevel);
      if (list) list.push(row);
      else byClass.set(row.classLevel, [row]);
    }

    const titleFor = (classLevel: number) => {
      const id = session.results.find((x) => x.classLevel === classLevel)?.yearEndExamId;
      return `${(id != null && examName.get(id)) || 'Final Result'} - ${year}`;
    };
    let title = '';
    let y = 0;

    const centered = (text: string, font: string, size: number, color = INK, gap = 4) => {
      doc.font(font).fontSize(size).fillColor(color);
      doc.text(text, MARGIN, y, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
      y += doc.currentLineHeight() + gap;
    };

    // School block, double rule, result title, then the class name centered under it.
    const pageClass: number[] = []; // class of each page, for per-class page numbers
    const addPage = (subtitle?: string, classLevel = 0) => {
      doc.addPage({ size: 'A4', layout: 'portrait', margin: MARGIN });
      pageClass.push(classLevel);
      y = MARGIN - 8;
      if (header.isGov) {
        centered(
          "Government of the People's Republic of Bangladesh",
          'Times-Roman',
          10,
          SUB_INK,
          3,
        );
      }
      centered(header.name ?? '', 'Times-Bold', 18, INK, 3);
      if (header.place) centered(header.place, 'Times-Roman', 10, SUB_INK, 2);
      y += 6;
      doc
        .lineWidth(1.2)
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .stroke(RULE);
      doc
        .lineWidth(0.5)
        .moveTo(MARGIN, y + 2.5)
        .lineTo(PAGE_WIDTH - MARGIN, y + 2.5)
        .stroke(RULE);
      y += 14;
      title = titleFor(classLevel);
      centered(title, 'Times-Bold', 13, INK, 4);
      if (subtitle) centered(subtitle, 'Times-Bold', 12, INK, 0);
      y += 12;
    };

    // Text vertically centered in a cell, with side padding; long names end in an ellipsis.
    const cellText = (text: string, x: number, top: number, col: Column, height: number) => {
      const lh = doc.currentLineHeight();
      doc.text(text, x + CELL_PAD, top + (height - lh) / 2 + 1, {
        width: col.width - CELL_PAD * 2,
        height: lh,
        align: col.align,
        lineBreak: false,
        ellipsis: true,
      });
    };

    const drawGridRow = (columns: Column[], top: number, height: number, outer = 0.5) => {
      let x = MARGIN;
      doc.lineWidth(0.5).strokeColor(RULE);
      for (const col of columns) {
        doc.rect(x, top, col.width, height).stroke();
        x += col.width;
      }
      if (outer > 0.5) {
        doc
          .lineWidth(outer)
          .moveTo(MARGIN, top)
          .lineTo(MARGIN + CONTENT_WIDTH, top)
          .stroke();
        doc
          .lineWidth(outer)
          .moveTo(MARGIN, top + height)
          .lineTo(MARGIN + CONTENT_WIDTH, top + height)
          .stroke();
      }
    };

    const drawTableHeader = (columns: Column[]) => {
      drawGridRow(columns, y, HEAD_ROW_HEIGHT, 1);
      doc.font('Times-Bold').fontSize(10).fillColor(INK);
      let x = MARGIN;
      for (const col of columns) {
        // Wraps to two lines when the column is narrow; centred vertically.
        const w = col.width - CELL_PAD * 2;
        const h = doc.heightOfString(col.label, { width: w, align: col.align });
        doc.text(col.label, x + CELL_PAD, y + (HEAD_ROW_HEIGHT - h) / 2 + 1, {
          width: w,
          align: col.align,
        });
        x += col.width;
      }
      y += HEAD_ROW_HEIGHT;
    };

    const drawRow = (columns: Column[], row: FinalResultRow) => {
      drawGridRow(columns, y, ROW_HEIGHT);
      doc.font('Times-Roman').fontSize(10).fillColor(INK);
      let x = MARGIN;
      for (const col of columns) {
        cellText(col.value(row) || '-', x, y, col, ROW_HEIGHT);
        x += col.width;
      }
      y += ROW_HEIGHT;
    };

    if (byClass.size === 0) {
      addPage();
      doc.font('Times-Roman').fontSize(11).fillColor(INK);
      doc.text('No finalized results are available.', MARGIN, y + 12, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
    } else {
      // Every class starts on a fresh page.
      for (const [classLevel, classRows] of byClass) {
        const columns = classLevel === 10 ? GRADUATING_COLUMNS : COLUMNS;
        addPage(className(classLevel), classLevel);
        drawTableHeader(columns);
        for (const row of classRows) {
          if (y + ROW_HEIGHT > CONTENT_BOTTOM) {
            addPage(`${className(classLevel)} (continued)`, classLevel);
            drawTableHeader(columns);
          }
          drawRow(columns, row);
        }
      }
    }

    // Footer on every page: rule, generation date, "Page X of Y" counted within the class.
    const generated = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Dhaka',
    });
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // writing below the margin must not add a page
      doc
        .lineWidth(0.5)
        .moveTo(MARGIN, FOOTER_Y - 4)
        .lineTo(PAGE_WIDTH - MARGIN, FOOTER_Y - 4)
        .stroke(RULE);
      doc.font('Times-Roman').fontSize(8.5).fillColor(SUB_INK);
      doc.text(`Generated on ${generated}`, MARGIN, FOOTER_Y, { lineBreak: false });
      const cls = pageClass[i - range.start];
      const pageNo = pageClass.slice(0, i - range.start + 1).filter((c) => c === cls).length;
      const pageTotal = pageClass.filter((c) => c === cls).length;
      doc.text(`Page ${pageNo} of ${pageTotal}`, MARGIN, FOOTER_Y, {
        width: CONTENT_WIDTH,
        align: 'right',
        lineBreak: false,
      });
    }

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.end();
    return done;
  }
}
