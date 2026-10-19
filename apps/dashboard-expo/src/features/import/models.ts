/**
 * Spreadsheet import, replicating the web's two Excel uploads (StudentList.tsx and
 * NewSubject.tsx handleFileUpload): the same required columns, normalisation, per-row checks
 * and limits, on rows from src/lib/files/xlsx.ts. The server validates again; nothing here is a
 * security boundary. Teachers and marks have no Excel import on the web (or a server import
 * endpoint), so there is none here either.
 */
import type * as SharedSchemas from '@school/shared-schemas';
import type { StudentAcademicInput, StudentPersonalInput, Subject } from '@/lib/api';
import { rowsToObjects } from '@/lib/files/xlsx';

/**
 * The shared-schemas helpers the parsers use, passed in by the screen (`import * as shared from
 * '@school/shared-schemas'`). Injected rather than imported so the node test runner, which loads
 * this file as CommonJS, can supply the ESM-only package through a dynamic import.
 */
export type ImportSchemas = Pick<
  typeof SharedSchemas,
  'normalizeExcelDate' | 'studentFormSchema' | 'subjectFormSchema' | 'toExcelString'
>;

export type ImportResult<T> = { ok: true; rows: T[] } | { ok: false; errors: string[] };

const issueText = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.map(String).join('.') || 'row'}: ${i.message}`).join(' | ');

// ---- students -------------------------------------------------------------------------------

export const STUDENT_REQUIRED_COLUMNS = [
  'name',
  'father_name',
  'mother_name',
  'father_phone',
  'dob',
  'class',
  'roll',
  'section',
  'religion',
] as const;

export const STUDENT_TEMPLATE_COLUMNS = [
  'name',
  'father_name',
  'mother_name',
  'father_phone',
  'mother_phone',
  'village',
  'post_office',
  'upazila',
  'district',
  'dob',
  'class',
  'roll',
  'section',
  'religion',
  'group',
  'has_stipend',
] as const;

/** The web's demo rows (student_upload_demo.xlsx). */
export const STUDENT_TEMPLATE_ROWS: string[][] = [
  [
    'Rahim Uddin',
    'Karim Uddin',
    'Ayesha Begum',
    '01712345678',
    '01812345678',
    'Shantinagar',
    'Sadar',
    'Sadar',
    'Dhaka',
    '15/08/2008',
    '8',
    '12',
    'A',
    'Islam',
    '',
    'No',
  ],
  [
    'Nusrat Jahan',
    'Mizanur Rahman',
    'Shirin Akter',
    '01912345678',
    '01612345678',
    'Uttar Para',
    'Town',
    'Kotwali',
    'Chattogram',
    '20/01/2007',
    '9',
    '5',
    'B',
    'Islam',
    'Science',
    'Yes',
  ],
];

export const MAX_STUDENTS_PER_UPLOAD = 500;

export type StudentImportRow = StudentPersonalInput & StudentAcademicInput;

export function parseStudentSheet(
  rows: string[][],
  schemas: ImportSchemas,
): ImportResult<StudentImportRow> {
  const { normalizeExcelDate, studentFormSchema, toExcelString } = schemas;
  const headers = (rows[0] ?? []).map((h) => String(h).toLowerCase().trim());
  const missing = STUDENT_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length)
    return { ok: false, errors: [`Missing required columns: ${missing.join(', ')}`] };
  const objects = rowsToObjects(rows, (h) => h.toLowerCase().trim()).filter(
    (o) => toExcelString(o.name) !== '',
  );
  if (!objects.length) return { ok: false, errors: ['No students found in the file.'] };
  if (objects.length > MAX_STUDENTS_PER_UPLOAD)
    return {
      ok: false,
      errors: [
        `Maximum ${MAX_STUDENTS_PER_UPLOAD} students allowed per upload. Your file has ${objects.length}.`,
      ],
    };
  const errors: string[] = [];
  const out: StudentImportRow[] = objects.map((s, index) => {
    const row = {
      name: toExcelString(s.name),
      father_name: toExcelString(s.father_name),
      mother_name: toExcelString(s.mother_name),
      father_phone: toExcelString(s.father_phone),
      mother_phone: toExcelString(s.mother_phone) || null,
      village: toExcelString(s.village),
      post_office: toExcelString(s.post_office),
      upazila: toExcelString(s.upazila),
      district: toExcelString(s.district),
      dob: normalizeExcelDate(s.dob),
      class: toExcelString(s.class),
      roll: toExcelString(s.roll),
      section: toExcelString(s.section).toUpperCase(),
      religion: toExcelString(s.religion),
      group: toExcelString(s.group),
      has_stipend: toExcelString(s.has_stipend).toLowerCase() === 'yes',
      available: true,
    };
    const parsed = studentFormSchema.safeParse(row);
    if (!parsed.success)
      errors.push(`Row ${index + 2}: ${issueText(parsed.error.issues) || 'Invalid data'}`);
    const cls = Number(row.class || 0);
    if ((cls === 9 || cls === 10) && !row.group.trim())
      errors.push(`Row ${index + 2}: Group is required for class 9-10`);
    return row;
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out };
}

// ---- subjects -------------------------------------------------------------------------------

export const SUBJECT_REQUIRED_COLUMNS = [
  'name',
  'class',
  'full_mark',
  'year',
  'assessment_type',
  'priority',
] as const;

/** Column order of the web's subject_upload_demo.xlsx. */
export const SUBJECT_TEMPLATE_COLUMNS = [
  'name',
  'class',
  'full_mark',
  'pass_mark',
  'year',
  'subject_group',
  'assessment_type',
  'priority',
  'group',
  'cq_mark',
  'mcq_mark',
  'practical_mark',
  'cq_pass_mark',
  'mcq_pass_mark',
  'practical_pass_mark',
  'marking_scheme',
] as const;

/** Example rows for the template: one exam subject and one BREAKDOWN subject. */
export const SUBJECT_TEMPLATE_ROWS = (year: number): string[][] => [
  [
    'Bangla 1st Paper',
    '6',
    '100',
    '33',
    String(year),
    'Bangla',
    'exam',
    '1',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL',
  ],
  [
    'Physics',
    '9',
    '100',
    '33',
    String(year),
    '',
    'exam',
    '5',
    'Science',
    '50',
    '25',
    '25',
    '17',
    '8',
    '8',
    'BREAKDOWN',
  ],
];

export type SubjectImportRow = Omit<Subject, 'id' | 'pass_mark'> & {
  pass_mark: number | null;
  subject_group: string | null;
};

/** `Number()` that reads blank as NaN (the web's `Number(row.x)` on a missing cell is NaN). */
const numOf = (v: string | undefined) => (v == null || v.trim() === '' ? Number.NaN : Number(v));

export function parseSubjectSheet(
  rows: string[][],
  existing: readonly Pick<Subject, 'name' | 'class' | 'group' | 'year'>[],
  schemas: ImportSchemas,
  currentYear = new Date().getFullYear(),
): ImportResult<SubjectImportRow> {
  const { subjectFormSchema } = schemas;
  const headers = (rows[0] ?? []).map((h) => String(h));
  const missing = SUBJECT_REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length)
    return { ok: false, errors: [`Excel file is missing required columns: ${missing.join(', ')}`] };
  const objects = rowsToObjects(rows, (h) => h);
  if (!objects.length) return { ok: false, errors: ['No subjects found in the file.'] };
  const pick = (o: Record<string, string>, key: string) => {
    const k = Object.keys(o).find((x) => x.trim().toLowerCase() === key);
    return k ? String(o[k] ?? '').trim() : '';
  };
  const errors: string[] = [];
  const seen = new Set<string>();
  const out = objects.map((o, index): SubjectImportRow => {
    const n = (k: string) => Number(o[k] ?? '') || 0;
    const groupRaw = pick(o, 'group');
    const groupCased = groupRaw ? groupRaw[0]!.toUpperCase() + groupRaw.slice(1).toLowerCase() : '';
    const subjectGroup = Object.keys(o).some((x) => x.trim().toLowerCase() === 'subject_group')
      ? pick(o, 'subject_group')
      : null;
    const assessment = (o.assessment_type?.trim() || 'exam').toLowerCase();
    const row = {
      name: String(o.name ?? '').trim(),
      class: numOf(o.class),
      full_mark: numOf(o.full_mark),
      pass_mark: assessment === 'continuous' ? null : numOf(o.pass_mark),
      group: groupCased === 'General' ? '' : groupCased,
      year: Number(o.year) || currentYear,
      assessment_type: assessment as SubjectImportRow['assessment_type'],
      subject_group: subjectGroup,
      priority: n('priority'),
      cq_mark: n('cq_mark'),
      mcq_mark: n('mcq_mark'),
      practical_mark: n('practical_mark'),
      cq_pass_mark: n('cq_pass_mark'),
      mcq_pass_mark: n('mcq_pass_mark'),
      practical_pass_mark: n('practical_pass_mark'),
      marking_scheme: (o.marking_scheme?.trim()
        ? o.marking_scheme.trim().toUpperCase()
        : 'TOTAL') as SubjectImportRow['marking_scheme'],
      subject_type: 'single' as const,
      parent_id: null,
    };
    const r = index + 2;
    if (!row.name) errors.push(`Row ${r}: Subject name required.`);
    if (!row.class || Number.isNaN(row.class) || row.class < 6 || row.class > 10)
      errors.push(`Row ${r}: Class must be 6-10.`);
    if (!row.full_mark || Number.isNaN(row.full_mark) || row.full_mark <= 0)
      errors.push(`Row ${r}: Full mark required.`);
    if (
      row.assessment_type === 'exam' &&
      (row.pass_mark === null || Number.isNaN(row.pass_mark) || row.pass_mark < 0)
    )
      errors.push(`Row ${r}: Pass mark required for exam.`);
    if (!row.year || Number.isNaN(row.year) || row.year < 2000)
      errors.push(`Row ${r}: Invalid year.`);
    if (!['exam', 'continuous'].includes(row.assessment_type))
      errors.push(`Row ${r}: Invalid assessment type.`);
    if (row.priority < 0) errors.push(`Row ${r}: Priority must be non-negative.`);
    const breakdown = row.cq_mark + row.mcq_mark + row.practical_mark;
    if (row.marking_scheme === 'BREAKDOWN' && breakdown === 0)
      errors.push(
        `Row ${r}: BREAKDOWN scheme requires at least one mark type (CQ, MCQ, or Practical).`,
      );
    if (breakdown > 0 && row.full_mark !== breakdown)
      errors.push(
        `Row ${r}: Full mark (${row.full_mark}) must equal sum of CQ, MCQ, and Practical (${breakdown}).`,
      );
    const passBreakdown = row.cq_pass_mark + row.mcq_pass_mark + row.practical_pass_mark;
    if (passBreakdown > 0 && row.pass_mark !== passBreakdown)
      errors.push(
        `Row ${r}: Pass mark (${row.pass_mark}) must equal sum of breakdown pass marks (${passBreakdown}).`,
      );
    if (row.pass_mark !== null && row.pass_mark > row.full_mark)
      errors.push(
        `Row ${r}: Pass mark (${row.pass_mark}) cannot exceed full mark (${row.full_mark}).`,
      );
    if (!['TOTAL', 'BREAKDOWN'].includes(row.marking_scheme))
      errors.push(`Row ${r}: Invalid marking scheme (must be TOTAL or BREAKDOWN).`);
    const key = `${row.name}|${row.class}|${row.group}|${row.year}`;
    if (seen.has(key)) errors.push(`Row ${r}: Duplicate subject in file.`);
    seen.add(key);
    if (
      existing.some(
        (s) =>
          s.name === row.name &&
          s.class === row.class &&
          (s.group || '') === row.group &&
          s.year === row.year,
      )
    )
      errors.push(`Row ${r}: Subject already exists in database.`);
    const parsed = subjectFormSchema.safeParse(row);
    if (!parsed.success && !errors.some((e) => e.startsWith(`Row ${r}:`)))
      errors.push(`Row ${r}: ${issueText(parsed.error.issues)}`);
    return row;
  });
  return errors.length ? { ok: false, errors } : { ok: true, rows: out };
}
