/**
 * Pure logic behind the admin pages: form → request mapping (checked against the same shared zod
 * schemas the server validates with), holiday/event/notice helpers and error messages.
 * `@school/shared-schemas` is ESM-only, so runtime use goes through a dynamic import.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '@/lib/api/errors';
import type { Holiday, Notice, SchoolEvent } from '@/lib/api';
import { maskDate } from '@/lib/dates';
import { splitEvents, validateEvent } from '@/features/events/model';
import {
  dayCount,
  formatDay,
  formatRange,
  holidayStats,
  inYear,
  todayYmd,
  validateHoliday,
  yearOptions,
} from '@/features/holidays/model';
import { filterNotices, noticeSummary } from '@/features/notices/model';
import {
  addedMessage,
  credentialsFileName,
  needsGroup,
  studentDefaults,
  toStudentPayload,
} from '@/features/students/form';
import {
  breakdownTotals,
  issuesToErrors,
  subjectDefaults,
  toSubjectInput,
} from '@/features/subjects/form';
import { teacherDefaults, toTeacherInput } from '@/features/teachers/form';
import { mutationErrorMessage, plural } from './errors';

const schemas = () => import('@school/shared-schemas');

describe('student form', () => {
  const values = {
    ...studentDefaults(null, 9),
    name: 'Ayesha',
    father_name: 'Abdur',
    mother_name: 'Rokeya',
    father_phone: '01711111111',
    mother_phone: '  ',
    roll: '4',
    section: 'a',
    dob: '2012-01-05',
    religion: 'Islam' as const,
    group: 'Science',
  };

  it('splits into personal + academic bodies like the web', () => {
    const { personal, academic } = toStudentPayload(values);
    assert.equal(personal.mother_phone, null);
    assert.equal(academic.section, 'A');
    assert.equal(academic.class, '9');
    assert.equal(academic.group, 'Science');
    assert.equal(toStudentPayload({ ...values, class: '7' }).academic.group, '');
    assert.equal(needsGroup('10'), true);
    assert.equal(needsGroup(8), false);
  });

  it('defaults pass the shared schema once required fields are filled', async () => {
    const { studentFormSchema } = await schemas();
    assert.equal(studentFormSchema.safeParse(values).success, true);
    assert.equal(studentFormSchema.safeParse(studentDefaults()).success, false);
  });

  it('describes the add result and names the login sheet', () => {
    assert.match(addedMessage(1, 1), /login sheet/);
    assert.equal(addedMessage(0, 1), 'No student was added (already exists?).');
    assert.equal(
      credentialsFileName(new Date('2026-10-19T05:00:00Z')),
      'students_credentials_2026-10-19.xlsx',
    );
  });
});

describe('teacher form', () => {
  it('lowercases the email and validates with the shared schema', async () => {
    const { teacherFormSchema } = await schemas();
    const v = { ...teacherDefaults(), name: 'Rina', email: ' Rina@X.com ', phone: '01700000000' };
    assert.equal(toTeacherInput(v).email, 'rina@x.com');
    assert.equal(teacherFormSchema.safeParse(teacherDefaults()).success, false);
  });
});

describe('subject form', () => {
  const base = { ...subjectDefaults(null, 9), name: 'Physics', full_mark: '100', pass_mark: '33' };

  it('maps a single TOTAL subject and passes the shared schema', async () => {
    const { subjectFormSchema } = await schemas();
    const input = toSubjectInput(base, 2026);
    assert.equal(input.full_mark, 100);
    assert.equal(input.cq_mark, 0);
    assert.equal(input.parent_id, null);
    assert.equal(subjectFormSchema.safeParse(input).success, true);
  });

  it('breakdown subjects send the summed full/pass marks', async () => {
    const { subjectFormSchema } = await schemas();
    const v = {
      ...base,
      full_mark: '',
      marking_scheme: 'BREAKDOWN' as const,
      cq_mark: '50',
      mcq_mark: '25',
      practical_mark: '25',
      cq_pass_mark: '17',
      mcq_pass_mark: '8',
      practical_pass_mark: '8',
    };
    assert.deepEqual(breakdownTotals(v), { full: 100, pass: 33 });
    const input = toSubjectInput(v, 2026);
    assert.equal(input.full_mark, 100);
    assert.equal(input.pass_mark, 33);
    assert.equal(subjectFormSchema.safeParse(input).success, true);
  });

  it('a new main subject is valid with 0/0 and is always TOTAL', async () => {
    const { subjectFormSchema } = await schemas();
    const input = toSubjectInput(
      {
        ...subjectDefaults(null, 9),
        name: 'Bangla',
        subject_type: 'main',
        marking_scheme: 'BREAKDOWN',
      },
      2026,
    );
    assert.equal(input.marking_scheme, 'TOTAL');
    assert.equal(input.full_mark, 0);
    assert.equal(subjectFormSchema.safeParse(input).success, true);
  });

  it('only papers keep a parent, and group only applies from class 9', () => {
    assert.equal(toSubjectInput({ ...base, parent_id: '4' }, 2026).parent_id, null);
    assert.equal(
      toSubjectInput({ ...base, subject_type: 'paper', parent_id: '4' }, 2026).parent_id,
      4,
    );
    assert.equal(toSubjectInput({ ...base, class: '8', group: 'Science' }, 2026).group, null);
  });

  it('turns issues into first-per-field errors, dropping REQUIRED markers', () => {
    assert.deepEqual(
      issuesToErrors([
        { path: ['name'], message: 'REQUIRED' },
        { path: ['pass_mark'], message: 'Too high' },
        { path: ['pass_mark'], message: 'Second' },
      ]),
      { pass_mark: 'Too high' },
    );
  });
});

const hol = (p: Partial<Holiday>): Holiday => ({
  id: 1,
  title: 'H',
  start_date: '2026-01-01',
  end_date: '2026-01-01',
  description: '',
  is_optional: false,
  ...p,
});

describe('holidays model', () => {
  it('counts inclusive days and formats ranges', () => {
    assert.equal(dayCount(hol({ start_date: '2026-03-30', end_date: '2026-04-02' })), 4);
    assert.equal(dayCount(hol({ start_date: '2026-03-30', end_date: '2026-03-01' })), 1);
    assert.equal(formatDay('2026-04-15'), '15 Apr 2026');
    assert.equal(
      formatRange(hol({ start_date: '2026-03-30', end_date: '2026-04-01' })),
      '30 Mar 2026 – 1 Apr 2026',
    );
  });

  it('stats count distinct days off clipped to the year', () => {
    const list = [
      hol({ id: 1, start_date: '2025-12-30', end_date: '2026-01-02' }),
      hol({ id: 2, start_date: '2026-01-02', end_date: '2026-01-03', is_optional: true }),
      hol({ id: 3, start_date: '2027-01-01', end_date: '2027-01-01' }),
    ];
    const year = inYear(list, 2026);
    assert.deepEqual(
      year.map((h) => h.id),
      [1, 2],
    );
    assert.deepEqual(holidayStats(year, 2026, '2026-01-02'), {
      holidays: 2,
      daysOff: 3,
      upcoming: 1,
      optional: 1,
    });
    assert.deepEqual(yearOptions(list, 2026), [2027, 2026, 2025]);
  });

  it('validates required dates and order', () => {
    const ok = {
      title: 'Eid',
      start_date: '2026-03-30',
      end_date: '2026-03-31',
      description: '',
      is_optional: false,
    };
    assert.deepEqual(validateHoliday(ok), {});
    assert.ok(validateHoliday({ ...ok, end_date: '2026-03-01' }).end_date);
    assert.ok(validateHoliday({ ...ok, title: ' ', start_date: '2026-3-1' }).start_date);
    assert.equal(todayYmd(new Date(2026, 9, 9)), '2026-10-09');
  });

  it('masks typed dates', () => {
    assert.equal(maskDate('20260415'), '2026-04-15');
    assert.equal(maskDate('2026-0'), '2026-0');
    assert.equal(maskDate('2026/04/15999'), '2026-04-15');
  });
});

describe('events + notices', () => {
  const ev = (id: number, date: string) => ({ id, title: `E${id}`, date }) as SchoolEvent;

  it('splits upcoming (soonest first) and past (newest first)', () => {
    const { upcoming, past } = splitEvents(
      [ev(1, '2026-01-01'), ev(2, '2026-12-01'), ev(3, '2026-11-01'), ev(4, '2025-05-01')],
      '2026-10-19',
    );
    assert.deepEqual(
      upcoming.map((e) => e.id),
      [3, 2],
    );
    assert.deepEqual(
      past.map((e) => e.id),
      [1, 4],
    );
    assert.deepEqual(Object.keys(validateEvent({ title: '', date: 'x' })).sort(), [
      'date',
      'title',
    ]);
  });

  it('filters notices by title, newest first', () => {
    const list = [
      { id: 1, title: 'Exam routine', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'Holiday', created_at: '2026-03-01T00:00:00Z' },
      { id: 3, title: 'Final exam', created_at: '2026-05-01T00:00:00Z' },
    ] as Notice[];
    assert.deepEqual(
      filterNotices(list, ' EXAM ').map((n) => n.id),
      [3, 1],
    );
    assert.equal(typeof noticeSummary(list), 'string');
  });
});

describe('errors', () => {
  it('prefers the first validation issue with its field', () => {
    const e = new ApiError({
      kind: 'http',
      status: 400,
      message: 'Validation failed',
      details: [{ path: ['subjects', 0, 'pass_mark'], message: 'Too high' }],
    });
    assert.equal(mutationErrorMessage(e, 'x'), 'pass_mark: Too high');
    assert.equal(mutationErrorMessage(new Error('boom'), 'x'), 'boom');
    assert.equal(mutationErrorMessage(null, 'fallback'), 'fallback');
    assert.equal(plural(1, 'student'), '1 student');
    assert.equal(plural(2000, 'student'), '2,000 students');
  });
});
