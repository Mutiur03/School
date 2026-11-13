import PDFDocument from 'pdfkit';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import { loadSchoolHeader } from '../../common/school-pdf.js';
import { loadSessionResults } from './session-results.js';

type FinalResultRow = {
  classLevel: number;
  rank: number;
  name: string;
  total: number;
  failCount: number;
  nextClass: string;
  nextRoll: string;
};

// A4 portrait, points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 21;
const HEAD_ROW_HEIGHT = 24;
const CELL_PAD = 7;
const FOOTER_Y = PAGE_HEIGHT - MARGIN + 6;
// Rows end above the footer rule.
const CONTENT_BOTTOM = FOOTER_Y - 14;
type Column = { label: string; width: number; align: 'left' | 'center' };
const COLUMNS: Column[] = [
  { label: 'Rank', width: 50, align: 'center' },
  { label: 'Student Name', width: 205, align: 'left' },
  { label: 'Total Marks', width: 75, align: 'center' },
  { label: 'Fail Count', width: 65, align: 'center' },
  { label: 'Next Class', width: 60, align: 'center' },
  { label: 'New Roll', width: 60, align: 'center' },
];
const GRADUATING_COLUMNS: Column[] = [
  { label: 'Rank', width: 50, align: 'center' },
  { label: 'Student Name', width: 285, align: 'left' },
  { label: 'Total Marks', width: 95, align: 'center' },
  { label: 'Fail Count', width: 85, align: 'center' },
];
const INK = '#000000';
const SUB_INK = '#333333';
const RULE = '#000000';

const className = (value: number) => `Class ${value}`;

@Injectable()
export class FinalResultService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async generate(schoolId: number, year: number): Promise<Buffer> {
    const [header, session, enrollments] = await Promise.all([
      loadSchoolHeader(this.prisma, schoolId),
      loadSessionResults(this.prisma, schoolId, year),
      this.prisma.student_enrollments.findMany({
        where: { school_id: schoolId, year, student: { available: true } },
        select: {
          id: true,
          class: true,
          status: true,
          final_merit: true,
          next_year_roll: true,
          next_year_section: true,
        },
      }),
    ]);

    const enrollmentById = new Map(enrollments.map((row) => [row.id, row]));
    const rows: FinalResultRow[] = session.results
      .map((result) => {
        const enrollment = enrollmentById.get(result.enrollmentId);
        if (!enrollment || result.held || !['Passed', 'Failed'].includes(enrollment.status)) {
          return null;
        }
        const nextClass =
          result.classLevel === 10
            ? ''
            : enrollment.status === 'Passed'
              ? String(result.classLevel + 1)
              : String(result.classLevel);
        return {
          classLevel: result.classLevel,
          rank: enrollment.final_merit || result.position,
          name: result.studentName,
          total: result.totalMarks,
          failCount: result.failCount,
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

    const title = `FINAL RESULT - SESSION ${year}`;
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
        cellText(col.label, x, y, { ...col, align: col.align }, HEAD_ROW_HEIGHT);
        x += col.width;
      }
      y += HEAD_ROW_HEIGHT;
    };

    const drawRow = (columns: Column[], row: FinalResultRow) => {
      const values = [
        String(row.rank),
        row.name,
        row.total.toLocaleString('en-US'),
        String(row.failCount),
        row.nextClass,
        row.nextRoll,
      ];
      drawGridRow(columns, y, ROW_HEIGHT);
      doc.font('Times-Roman').fontSize(10).fillColor(INK);
      let x = MARGIN;
      columns.forEach((col, i) => {
        cellText(values[i] || '-', x, y, col, ROW_HEIGHT);
        x += col.width;
      });
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
