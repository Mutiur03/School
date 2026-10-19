/** Spreadsheet import rules (the web's StudentList / NewSubject handleFileUpload). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import { buildXlsx, readXlsxRows } from '../../lib/files/xlsx';
import {
  type ImportSchemas,
  MAX_STUDENTS_PER_UPLOAD,
  parseStudentSheet,
  parseSubjectSheet,
  STUDENT_TEMPLATE_COLUMNS,
  STUDENT_TEMPLATE_ROWS,
  SUBJECT_TEMPLATE_COLUMNS,
  SUBJECT_TEMPLATE_ROWS,
} from './models';

// ESM-only package; loaded the way the CJS test runner can.
let schemas: ImportSchemas;
before(async () => {
  schemas = await import('@school/shared-schemas');
});

const studentSheet = (rows: string[][]) => [[...STUDENT_TEMPLATE_COLUMNS], ...rows];

describe('student import', () => {
  it('accepts the template and normalises like the web (dob, section, stipend, mother phone)', () => {
    const r = parseStudentSheet(
      readXlsxRows(buildXlsx('Students', studentSheet(STUDENT_TEMPLATE_ROWS))),
      schemas,
    );
    assert.ok(r.ok);
    assert.equal(r.rows.length, 2);
    assert.deepEqual(r.rows[0], {
      name: 'Rahim Uddin',
      father_name: 'Karim Uddin',
      mother_name: 'Ayesha Begum',
      father_phone: '01712345678',
      mother_phone: '01812345678',
      village: 'Shantinagar',
      post_office: 'Sadar',
      upazila: 'Sadar',
      district: 'Dhaka',
      dob: '2008-08-15',
      class: '8',
      roll: '12',
      section: 'A',
      religion: 'Islam',
      group: '',
      has_stipend: false,
      available: true,
    });
    assert.equal(r.rows[1]!.has_stipend, true);
  });

  it('reads a real date cell (ISO from the reader) and lower-cases headers', () => {
    const rows = [
      [
        'NAME',
        'Father_Name',
        'mother_name',
        'father_phone',
        'dob',
        'class',
        'roll',
        'section',
        'religion',
      ],
      ['A B', 'Karim', 'Rina', '01712345678', '2010-02-03', '6', '1', 'b', 'Islam'],
    ];
    const r = parseStudentSheet(rows, schemas);
    assert.ok(r.ok);
    assert.equal(r.rows[0]!.dob, '2010-02-03');
    assert.equal(r.rows[0]!.section, 'B');
    assert.equal(r.rows[0]!.mother_phone, null);
  });

  it('reports missing columns, bad rows (with row numbers) and the class 9-10 group rule', () => {
    const missing = parseStudentSheet([['name', 'class']], schemas);
    assert.ok(!missing.ok);
    assert.match(missing.errors[0]!, /^Missing required columns: father_name, mother_name/);
    const row = [...STUDENT_TEMPLATE_ROWS[1]!];
    row[14] = ''; // class 9, no group
    const bad = parseStudentSheet(studentSheet([STUDENT_TEMPLATE_ROWS[0]!, row]), schemas);
    assert.ok(!bad.ok);
    assert.ok(bad.errors.includes('Row 3: Group is required for class 9-10'));
  });

  it('skips rows without a name and caps an upload at 500 students', () => {
    const blankName = [...STUDENT_TEMPLATE_ROWS[0]!];
    blankName[0] = '';
    const r = parseStudentSheet(studentSheet([STUDENT_TEMPLATE_ROWS[0]!, blankName]), schemas);
    assert.ok(r.ok);
    assert.equal(r.rows.length, 1);
    const many = Array.from({ length: MAX_STUDENTS_PER_UPLOAD + 1 }, (_, i) => {
      const x = [...STUDENT_TEMPLATE_ROWS[0]!];
      x[11] = String(i + 1);
      return x;
    });
    const over = parseStudentSheet(studentSheet(many), schemas);
    assert.ok(!over.ok);
    assert.match(over.errors[0]!, /Maximum 500 students/);
  });
});

describe('subject import', () => {
  const demo = readXlsxRows(
    new Uint8Array(
      readFileSync(new URL('../../lib/files/__fixtures__/subject-demo.xlsx', import.meta.url)),
    ),
  );

  it('accepts the web demo file and normalises rows', () => {
    const r = parseSubjectSheet(demo, [], schemas);
    assert.ok(r.ok, r.ok ? '' : r.errors.join('\n'));
    assert.equal(r.rows.length, 64);
    const first = r.rows[0]!;
    assert.equal(first.name, 'Bangla 1st Paper');
    assert.equal(first.class, 6);
    assert.equal(first.pass_mark, 33);
    assert.equal(first.subject_type, 'single');
    assert.equal(first.parent_id, null);
    assert.equal(first.marking_scheme, 'TOTAL');
  });

  it('flags subjects that already exist and duplicates inside the file', () => {
    const r = parseSubjectSheet(
      demo,
      [{ name: 'Bangla 1st Paper', class: 6, group: null, year: 2026 }],
      schemas,
    );
    assert.ok(!r.ok);
    assert.ok(r.errors.includes('Row 2: Subject already exists in database.'));
    const dup = parseSubjectSheet([demo[0]!, demo[1]!, demo[1]!], [], schemas);
    assert.ok(!dup.ok);
    assert.ok(dup.errors.includes('Row 3: Duplicate subject in file.'));
  });

  it('checks breakdown sums, pass ≤ full, class range and continuous pass marks', () => {
    const h = [...SUBJECT_TEMPLATE_COLUMNS];
    const [, breakdown] = SUBJECT_TEMPLATE_ROWS(2026);
    assert.ok(parseSubjectSheet([h, breakdown!], [], schemas).ok);
    const wrongSum = [...breakdown!];
    wrongSum[2] = '90';
    const e = parseSubjectSheet([h, wrongSum], [], schemas);
    assert.ok(!e.ok);
    assert.ok(e.errors.some((x) => x.includes('must equal sum of CQ, MCQ, and Practical (100)')));
    const cls = [...breakdown!];
    cls[1] = '11';
    assert.ok(parseSubjectSheet([h, cls], [], schemas).ok === false);
    const continuous = [...SUBJECT_TEMPLATE_ROWS(2026)[0]!];
    continuous[6] = 'Continuous';
    continuous[3] = '';
    const c = parseSubjectSheet([h, continuous], [], schemas);
    assert.ok(c.ok);
    assert.equal(c.rows[0]!.pass_mark, null);
    assert.equal(c.rows[0]!.assessment_type, 'continuous');
  });

  it('needs the mandatory columns', () => {
    const r = parseSubjectSheet([['name', 'class']], [], schemas);
    assert.ok(!r.ok);
    assert.equal(
      r.errors[0],
      'Excel file is missing required columns: full_mark, year, assessment_type, priority',
    );
  });
});
