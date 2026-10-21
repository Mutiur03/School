import PDFDocument from 'pdfkit';
import { buildSessionTable, drawSessionMarksheetBody } from './session-marksheet.pdf.js';
import type { StudentSessionResult, SubjectResult } from './session-result.js';

const subject = (over: Partial<SubjectResult>): SubjectResult => ({
  subjectId: 1,
  name: 'Bangla',
  priority: 1,
  isContinuous: false,
  isFourth: false,
  previous: { marks: 60, cq: null, mcq: null, practical: null },
  yearEnd: { marks: 70, cq: null, mcq: null, practical: null },
  combined: 130,
  fullMark: 200,
  passMark: 66,
  grade: 'A-',
  gp: 3.5,
  passed: true,
  ...over,
});

const result = (over: Partial<StudentSessionResult>): StudentSessionResult => ({
  enrollmentId: 1,
  classLevel: 7,
  group: null,
  section: 'A',
  roll: 1,
  subjects: [],
  totalMarks: 0,
  grandTotal: 0,
  gpa: 0,
  failCount: 0,
  isFailed: false,
  ...over,
});

describe('buildSessionTable', () => {
  it('splits marks into previous | year-end | total for classes 6-9', () => {
    const table = buildSessionTable(
      result({
        subjects: [
          subject({}),
          subject({
            subjectId: 2,
            name: 'Math',
            previous: { marks: null, cq: null, mcq: null, practical: null },
            yearEnd: { marks: 40, cq: null, mcq: null, practical: null },
            combined: 40,
            grade: 'F',
            gp: 0,
          }),
          subject({ subjectId: 3, name: 'Physical Education', isContinuous: true, passMark: 0 }),
        ],
        totalMarks: 170,
      }),
    );
    expect(table.split).toBe(true);
    expect(table.examRows).toEqual([
      {
        subject: 'Bangla',
        marks: ['60', '70', '130'],
        fullMark: '200',
        grade: 'A-',
        gp: '3.50',
      },
      {
        subject: 'Math',
        marks: ['-', '40', '40'],
        fullMark: '200',
        grade: 'F',
        gp: '0.00',
      },
    ]);
    expect(table.continuousRows.map((r) => r.subject)).toEqual(['Physical Education']);
    // Continuous subjects stay out of the exam totals.
    expect(table.totals).toEqual(['60', '110', '170']);
  });

  it('lists each paper of a main subject on its own row, without a pass-mark column', () => {
    const none = { marks: null, cq: null, mcq: null, practical: null };
    const table = buildSessionTable(
      result({
        subjects: [
          subject({
            name: 'English',
            fullMark: 200,
            papers: [
              {
                name: 'English 1st Paper',
                previous: { ...none, marks: 30 },
                yearEnd: { ...none, marks: 35 },
                combined: 65,
                fullMark: 100,
              },
              {
                name: 'English 2nd Paper',
                previous: { ...none, marks: 28 },
                yearEnd: { ...none, marks: 31 },
                combined: 59,
                fullMark: 100,
              },
            ],
          }),
        ],
      }),
    );
    expect(table.examRows[0]).not.toHaveProperty('passMark');
    expect(table.examRows[0].papers).toEqual([
      { subject: 'English 1st Paper', marks: ['30', '35', '65'], fullMark: '100' },
      { subject: 'English 2nd Paper', marks: ['28', '31', '59'], fullMark: '100' },
    ]);
  });

  it('shows only the year-end column for class 10', () => {
    const table = buildSessionTable(
      result({
        classLevel: 10,
        subjects: [subject({ previous: null, combined: 70, fullMark: 100 })],
        totalMarks: 70,
      }),
    );
    expect(table.split).toBe(false);
    expect(table.examRows[0].marks).toEqual(['70']);
    expect(table.totals).toEqual(['70']);
  });

  it('prints "-" total when neither exam has marks', () => {
    const table = buildSessionTable(
      result({
        subjects: [
          subject({
            previous: { marks: null, cq: null, mcq: null, practical: null },
            yearEnd: { marks: null, cq: null, mcq: null, practical: null },
            combined: 0,
          }),
        ],
      }),
    );
    expect(table.examRows[0].marks).toEqual(['-', '-', '-']);
  });
});

describe('drawSessionMarksheetBody', () => {
  it('renders paper rows without throwing', () => {
    const none = { marks: null, cq: null, mcq: null, practical: null };
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    const y = drawSessionMarksheetBody(doc, {
      student: { name: 'Rahim', class: 7, section: 'A', roll: 1 },
      result: {
        ...result({
          subjects: [
            subject({
              name: 'English',
              papers: [
                {
                  name: 'English 1st Paper',
                  previous: { ...none, marks: 30 },
                  yearEnd: { ...none, marks: 35 },
                  combined: 65,
                  fullMark: 100,
                },
                {
                  name: 'English 2nd Paper',
                  previous: { ...none, marks: 28 },
                  yearEnd: { ...none, marks: 31 },
                  combined: 59,
                  fullMark: 100,
                },
              ],
            }),
          ],
        }),
        position: 1,
      },
      previousExamName: 'Half Yearly',
      yearEndExamName: 'Annual',
    });
    doc.end();
    expect(y).toBeGreaterThan(232 + 20 * 4); // header (2 rows) + 2 paper rows
  });

  it('renders without throwing and returns the y below the summary', () => {
    const doc = new (PDFDocument as any)({ size: 'A4', margin: 40 });
    const y = drawSessionMarksheetBody(doc, {
      student: { name: 'Rahim', class: 7, section: 'A', roll: 1 },
      result: { ...result({ subjects: [subject({})], totalMarks: 130 }), position: 3 },
      previousExamName: 'Half Yearly',
      yearEndExamName: 'Annual',
      notes: ['Date of result published: 01 December, 2026.'],
    });
    doc.end();
    expect(y).toBeGreaterThan(232);
    expect(y).toBeLessThan(750);
  });
});
