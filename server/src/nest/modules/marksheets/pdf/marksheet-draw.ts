import PDFDocument from 'pdfkit';
import { pdf } from 'pdf-to-img';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import type { SessionResultRow } from '@/nest/modules/promotion/session-results.js';
import { drawSessionMarksheetBody as drawSessionBodyV1 } from '@/nest/modules/promotion/v1/session-marksheet.pdf.js';
import { calculateGPA, getGradeByPercentage } from './grading.js';

// Pure pdfkit drawing for per-exam and session marksheets (no DB; the renderer loads the data).

/** Header/watermark fields drawn on every marksheet page. */
export type SchoolMarksheetMeta = {
  ownership: string | null;
  name: string | null;
  location: string | null;
  eiin: string | null;
  website: string | null;
  phone: string | null;
  logoKey: string | null;
  logoEtag: string | null;
};

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

// Session marksheet body per school.promotionVersion (falls back to v1).
const SESSION_MARKSHEET_BODIES = { v1: drawSessionBodyV1 };

export type SessionMarksheetPage = {
  result: SessionResultRow;
  previousExamName: string | null;
  yearEndExamName: string;
  resultDate: string | null;
  returnDate: string | null;
};

export type MarksheetSignatures = {
  teacher?: Buffer | null;
  teacherName?: string | null;
  teacherPhone?: string | null;
  head?: Buffer | null;
  headName?: string | null;
  headRole?: string | null;
  schoolPhone?: string | null;
};

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

/** One A4 page per session result, drawn with the school's promotion-version body. */
export async function renderSessionMarksheetsPDF(
  year: number,
  version: string,
  pages: SessionMarksheetPage[],
  signaturesFor: (page: SessionMarksheetPage) => Promise<MarksheetSignatures>,
  schoolMeta: SchoolMarksheetMeta,
  logoBuffer: Buffer | null,
): Promise<Buffer> {
  const drawBody =
    SESSION_MARKSHEET_BODIES[version as keyof typeof SESSION_MARKSHEET_BODIES] ??
    SESSION_MARKSHEET_BODIES.v1;
  const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
  registerMarksheetFonts(doc);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  for (const [i, page] of pages.entries()) {
    if (i > 0) doc.addPage();
    const r = page.result;
    const student = {
      name: r.studentName,
      class: r.classLevel,
      section: r.section,
      roll: r.roll,
      year,
    };
    const notes: string[] = [];
    const published = formatMarksheetDate(page.resultDate);
    if (published) notes.push(`Date of result published: ${published}.`);
    const returnBy = formatMarksheetDate(page.returnDate);
    if (returnBy) {
      notes.push(
        `This academic transcript (mark sheet) must be returned by ${returnBy}.`,
        'Please contact the class teacher for any corrections.',
      );
    }

    drawProperBackground(doc);
    await drawWatermark(doc, logoBuffer);
    drawGradingSystemTable(doc, 425, 75);
    await drawProperHeader(
      doc,
      { exam: page.yearEndExamName, year },
      schoolMeta,
      buildMarksQrText({ ...student, name: `${student.name} (Position ${r.position})` }, [
        {
          exam: 'Session Result',
          rows: r.subjects.map((s) => ({ subject: s.name, marks: s.combined })),
        },
      ]),
    );
    const endY = drawBody(doc, {
      student,
      result: r,
      previousExamName: page.previousExamName,
      yearEndExamName: page.yearEndExamName,
      notes,
    });
    drawSignatures(doc, await signaturesFor(page), endY);
  }
  doc.end();
  return done;
}

async function renderStudentMarksheetPage(
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
  drawProperBackground(doc);
  await drawWatermark(doc, logoBuffer);
  drawGradingSystemTable(doc, 425, 75);
  await drawProperHeader(
    doc,
    student,
    schoolMeta,
    buildMarksQrText(student, [{ exam: student.exam, rows: tableData }]),
  );
  drawProperStudentInfo(doc, student);

  const y = doc.y + 5;
  const headers = useBreakdownLayout(student.class, tableData)
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

  const { y: finalY, colWidths } = drawProperTable(
    doc,
    y,
    headers,
    tableData,
    student.class,
    student.classHighestTotal,
  );

  const tableEndY = await drawSummary(
    doc,
    finalY,
    tableData,
    student.class,
    student.classHighestTotal,
    student.fourth_subject_id,
    student.applyBonus,
    colWidths,
    student.result_date,
    student.classHighestGrandTotal,
    student.return_date,
  );

  drawSignatures(doc, signatures, tableEndY);
}

export async function renderStudentReportPDF(
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
  registerMarksheetFonts(doc);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>(async (resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    await renderStudentMarksheetPage(doc, student, tableData, signatures, schoolMeta, logoBuffer);
    doc.end();
  });
}

function registerMarksheetFonts(doc: any) {
  const regularFont = MARKSHEET_FONT_PATHS.regular.find((fontPath) => fs.existsSync(fontPath));
  const boldFont = MARKSHEET_FONT_PATHS.bold.find((fontPath) => fs.existsSync(fontPath));

  if (regularFont) {
    doc.registerFont(PDF_STYLES.fontRegular, regularFont);
  }
  if (boldFont) {
    doc.registerFont(PDF_STYLES.fontBold, boldFont);
  }
}

export async function finalizeMarksheetBuffer(buffer: Buffer): Promise<Buffer> {
  return RASTERIZE_MARKSHEET ? convertPdfToImagePdf(buffer) : buffer;
}

async function convertPdfToImagePdf(pdfBuffer: Buffer): Promise<Buffer> {
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
function useBreakdownLayout(className: number | undefined, data: any[]): boolean {
  if (className !== 9 && className !== 10) return false;
  return data.some((row: any) => row.marking_scheme === 'BREAKDOWN');
}

async function drawSummary(
  doc: any,
  y: number,
  tableData: any[],
  className?: number,
  classHighestTotal?: number,
  fourth_subject_id?: number | null,
  applyBonus = false,
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

  const { gpa } = calculateGPA(tableData, fourth_subject_id ?? null, applyBonus, className);
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

  const isBreakdown = useBreakdownLayout(className, tableData);
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
    drawDynamicText(doc, 'Grand Total Marks', startX + 5, rowY, w03 - 10, rowHeight, {
      align: 'right',
      bold: true,
    });
    doc
      .moveTo(startX + w03, rowY)
      .lineTo(startX + w03, rowY + rowHeight)
      .stroke();

    const x4 = startX + w03;
    drawDynamicText(doc, String(grandTotalMarks), x4, rowY, actualColWidths[4], rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x4 + actualColWidths[4], rowY)
      .lineTo(x4 + actualColWidths[4], rowY + rowHeight)
      .stroke();

    const x5 = x4 + actualColWidths[4];
    drawDynamicText(doc, 'GPA', x5 + 5, rowY, actualColWidths[5] - 10, rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x5 + actualColWidths[5], rowY)
      .lineTo(x5 + actualColWidths[5], rowY + rowHeight)
      .stroke();

    const x6 = x5 + actualColWidths[5];
    drawDynamicText(doc, gpa.toFixed(2), x6, rowY, actualColWidths[6], rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x6 + actualColWidths[6], rowY)
      .lineTo(x6 + actualColWidths[6], rowY + rowHeight)
      .stroke();

    const x7 = x6 + actualColWidths[6];
    drawDynamicText(
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
    drawDynamicText(doc, 'Grand Total Marks', startX + 5, rowY, w01 - 10, rowHeight, {
      align: 'right',
      bold: true,
    });
    doc
      .moveTo(startX + w01, rowY)
      .lineTo(startX + w01, rowY + rowHeight)
      .stroke();

    const x2 = startX + w01;
    drawDynamicText(doc, String(grandTotalMarks), x2, rowY, actualColWidths[2], rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x2 + actualColWidths[2], rowY)
      .lineTo(x2 + actualColWidths[2], rowY + rowHeight)
      .stroke();

    const x3 = x2 + actualColWidths[2]; // Column 3 (LG)
    drawDynamicText(doc, 'GPA', x3, rowY, actualColWidths[3], rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x3 + actualColWidths[3], rowY)
      .lineTo(x3 + actualColWidths[3], rowY + rowHeight)
      .stroke();

    const x4 = x3 + actualColWidths[3]; // Column 4 (GP)
    drawDynamicText(doc, gpa.toFixed(2), x4, rowY, actualColWidths[4], rowHeight, {
      align: 'center',
      bold: true,
    });
    doc
      .moveTo(x4 + actualColWidths[4], rowY)
      .lineTo(x4 + actualColWidths[4], rowY + rowHeight)
      .stroke();

    const x5 = x4 + actualColWidths[4]; // Column 5 (Highest)
    drawDynamicText(doc, `${grandHighest || '-'}`, x5, rowY, actualColWidths[5], rowHeight, {
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

function drawFittedCenteredText(
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

function drawSignatures(
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
    drawProperBackground(doc);
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
      drawFittedCenteredText(doc, name, x, textY, width, {
        fontSize: 10,
        font: 'Times-Roman',
      });
      drawFittedCenteredText(doc, role, x, textY + 12, width, {
        fontSize: 10,
        minFontSize: 8,
        font: 'Times-Roman',
      });
      if (phone) {
        drawFittedCenteredText(doc, phone, x, textY + 24, width, {
          fontSize: 9,
          minFontSize: 7,
          font: 'Times-Roman',
        });
      }
      return;
    }

    drawFittedCenteredText(doc, role, x, textY, width, {
      fontSize: 10,
      font: 'Times-Roman',
    });
    if (phone) {
      drawFittedCenteredText(doc, phone, x, textY + 12, width, {
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
  drawFittedCenteredText(doc, "Guardian's Signature", guardianStartX, textY, guardianLineWidth, {
    fontSize: 10,
    font: 'Times-Bold',
  });

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

function drawProperBackground(doc: any) {
  doc.rect(20, 20, 555, 802).lineWidth(2).stroke('#000000');
  doc.rect(25, 25, 545, 792).lineWidth(0.5).stroke('#666666');
}

export function normalizeSchoolWebsite(customDomain?: string | null): string | null {
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

function buildMarksQrText(student: any, exams: { exam?: string | null; rows: any[] }[]): string {
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

async function drawProperHeader(
  doc: any,
  exam?: any,
  school?: {
    ownership?: string | null;
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

  // Top line spans full page — above side widgets. Government schools only (AGENTS.md).
  if (school?.ownership === 'Government') {
    doc
      .font('Times-Bold')
      .fontSize(10)
      .text("Government of the People's Republic of Bangladesh", pageHeaderX, 40, {
        align: 'center',
        width: pageHeaderWidth,
      });
  }

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

async function drawWatermark(doc: any, logoBuffer?: Buffer | null) {
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
  } catch {
    doc.save();
    doc.opacity(0.1);
    doc.image(image, 150, 236, { width: 300 });
    doc.restore();
  }
}

function getClassText(classNum: number | string): string {
  const classMap: Record<string, string> = {
    '6': 'Six',
    '7': 'Seven',
    '8': 'Eight',
    '9': 'Nine',
    '10': 'Ten',
  };
  return classMap[String(classNum)] || String(classNum);
}

function drawProperStudentInfo(doc: any, student: any) {
  const startY = 185;
  const lineHeight = 18;
  doc.fillColor('#000000');

  // Row 1: Student's Name
  drawDynamicText(doc, "Student's Name:", 50, startY, 100, lineHeight, {
    fontSize: 11,
    bold: true,
  });
  drawDynamicText(doc, student.name, 150, startY, 350, lineHeight, {
    fontSize: 11,
    font: 'Times-Roman',
  });

  // Row 2: Class, Section, Roll No
  const row2Y = startY + lineHeight;

  // Class
  drawDynamicText(doc, 'Class:', 50, row2Y, 50, lineHeight, { fontSize: 11, bold: true });
  drawDynamicText(doc, getClassText(student.class), 100, row2Y, 90, lineHeight, {
    fontSize: 11,
    font: 'Times-Roman',
  });

  // Section
  drawDynamicText(doc, 'Section:', 230, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
  drawDynamicText(doc, student.section || '-', 290, row2Y, 50, lineHeight, {
    fontSize: 11,
    font: 'Times-Roman',
  });

  // Roll No
  drawDynamicText(doc, 'Roll No:', 350, row2Y, 60, lineHeight, { fontSize: 11, bold: true });
  drawDynamicText(doc, String(student.roll || '-'), 410, row2Y, 50, lineHeight, {
    fontSize: 11,
    font: 'Times-Roman',
  });
}

function formatSubjectWithFullMark(subject: string, fullMark?: number | null): string {
  if (fullMark !== undefined && fullMark !== null && fullMark > 0) {
    return `${subject} (${fullMark})`;
  }
  return subject;
}

function drawProperTable(
  doc: any,
  y: number,
  headers: string[],
  data: any[],
  className?: number,
  classHighestTotal?: number,
) {
  const { startX, contentWidth, rowHeight, headerFontSize, rowFontSize, fontBold, fontRegular } =
    PDF_STYLES;
  const isBreakdown = useBreakdownLayout(className, data);

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
    drawDynamicText(doc, h, currentX + 5, y, colWidths[i] - 10, rowHeight, {
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
      drawProperBackground(doc);
      y = 50;
    }

    doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke('#000000');

    if (isBreakdown) {
      const w03 = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
      drawDynamicText(doc, 'Total Marks', startX + 5, y, w03 - 10, rowHeight, {
        align: 'right',
        bold: true,
        fontSize: rowFontSize,
      });
      doc
        .moveTo(startX + w03, y)
        .lineTo(startX + w03, y + rowHeight)
        .stroke();

      const x4 = startX + w03;
      drawDynamicText(doc, String(examTotalMarks), x4, y, colWidths[4], rowHeight, {
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
      drawDynamicText(doc, `${classHighestTotal ?? '-'}`, x7 + 2, y, colWidths[7] - 4, rowHeight, {
        align: 'center',
        bold: true,
        fontSize: rowFontSize,
      });
    } else {
      const w01 = colWidths[0] + colWidths[1];
      drawDynamicText(doc, 'Total Marks', startX + 5, y, w01 - 10, rowHeight, {
        align: 'right',
        bold: true,
        fontSize: rowFontSize,
      });
      doc
        .moveTo(startX + w01, y)
        .lineTo(startX + w01, y + rowHeight)
        .stroke();

      const x2 = startX + w01;
      drawDynamicText(doc, String(examTotalMarks), x2, y, colWidths[2], rowHeight, {
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
      drawDynamicText(doc, `${classHighestTotal ?? '-'}`, x5, y, colWidths[5], rowHeight, {
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
      drawDynamicText(
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
      drawProperBackground(doc);
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

        drawDynamicText(
          doc,
          formatSubjectWithFullMark(paper.subject, paper.full_mark),
          startX + 5,
          py,
          colWidths[0] - 10,
          rowHeight,
          { fontSize: rowFontSize },
        );
        if (isBreakdown) {
          drawDynamicText(
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
          drawDynamicText(
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
          drawDynamicText(
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
          drawDynamicText(
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
          drawDynamicText(
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
          drawDynamicText(
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
        ? getGradeByPercentage((row.marks / fullMark) * 100, {
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

      drawDynamicText(doc, row.marks ?? '-', mx + 5, y, colWidths[middleStart] - 10, totalHeight, {
        fontSize: rowFontSize,
        align: 'center',
      });
      drawDynamicText(
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
      drawDynamicText(
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
        ? getGradeByPercentage((row.marks / fullMark) * 100, {
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
          formatSubjectWithFullMark(row.subject, row.full_mark),
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
          formatSubjectWithFullMark(row.subject, row.full_mark),
          String(row.marks ?? '-'),
          String(row.marks ?? '-'),
          grade.lg,
          Number.isFinite(grade.gp) ? grade.gp.toFixed(2) : '-',
          row.highest_mark ? String(row.highest_mark) : '-',
        ];
      }

      currentX = startX;
      cols.forEach((c, i) => {
        drawDynamicText(doc, c, currentX + 5, y, colWidths[i] - 10, rowHeight, {
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

function drawDynamicText(
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

function drawGradingSystemTable(doc: any, x: number, y: number) {
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

//   drawDynamicText(doc, headers[0], startX + 5, y, subjectWidth - 10, rowHeight, {
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
//     drawDynamicText(doc, exam, curX, y, colWidth, rowHeight, {
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
//       drawProperBackground(doc);
//       y = 50;
//     }

//     doc.lineWidth(0.5).rect(startX, y, contentWidth, rowHeight).stroke();
//     drawDynamicText(doc, row.subject, startX + 5, y, subjectWidth - 10, rowHeight, {
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
//       drawDynamicText(doc, String(row.exam_marks[exam] ?? "-"), curX, y, colWidth, rowHeight, {
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
//   drawDynamicText(doc, "TOTAL", startX + 5, y, subjectWidth - 10, rowHeight, {
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
//     drawDynamicText(doc, String(totals[exam] ?? "-"), curX, y, colWidth, rowHeight, {
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
//   drawDynamicText(doc, "GPA", startX + 5, y, subjectWidth - 10, rowHeight, {
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
//     drawDynamicText(doc, String(gpas[exam] ?? "-"), curX, y, colWidth, rowHeight, {
//       fontSize: rowFontSize,
//       align: "center",
//       bold: true,
//     });
//   });
// }
