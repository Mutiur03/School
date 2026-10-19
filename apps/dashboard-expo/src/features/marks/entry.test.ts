/**
 * Marks entry is a critical academic workflow: these tests pin the bounds, the "empty is null,
 * never 0" (absent / not entered) rule, the per-subject rules (TOTAL vs BREAKDOWN, disabled
 * parts, group subjects, unconfigured subjects) and exactly what goes into PUT /api/marks.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ClassMarksRow, RosterStudent, Subject } from '@/lib/api';
import {
  buildSubmission,
  cellText,
  changedStudents,
  checkCell,
  entryCounts,
  entrySubjects,
  groupMismatch,
  markColumns,
  nextRow,
  rowState,
  sanitizeMarkInput,
  saveMessage,
  savedMarks,
  scopeRoster,
  sortRoster,
  subjectConfigured,
  type Draft,
  type Saved,
} from './entry';

const subject = (o: Partial<Subject> = {}): Subject => ({
  id: 11,
  name: 'Bangla 1st',
  class: 9,
  year: 2026,
  full_mark: 100,
  pass_mark: 33,
  cq_mark: 0,
  mcq_mark: 0,
  practical_mark: 0,
  cq_pass_mark: 0,
  mcq_pass_mark: 0,
  practical_pass_mark: 0,
  group: null,
  subject_type: 'single',
  parent_id: null,
  assessment_type: 'exam',
  marking_scheme: 'TOTAL',
  priority: 1,
  ...o,
});
const TOTAL = subject();
// Physics: CQ 50, MCQ 25, Practical 25 (Science only)
const PHYSICS = subject({
  id: 21,
  name: 'Physics',
  marking_scheme: 'BREAKDOWN',
  full_mark: 100,
  cq_mark: 50,
  mcq_mark: 25,
  practical_mark: 25,
  group: 'Science',
});
// No practical part: that cell is disabled
const BANGLA2 = subject({
  id: 31,
  marking_scheme: 'BREAKDOWN',
  full_mark: 100,
  cq_mark: 70,
  mcq_mark: 30,
  practical_mark: 0,
});

const st = (id: number, o: Partial<RosterStudent> = {}): RosterStudent => ({
  student_id: id,
  name: `Student ${id}`,
  roll: id,
  class: 9,
  section: 'A',
  group: 'Science',
  ...o,
});
const ROSTER = [st(1), st(2), st(3, { group: 'Humanities' }), st(4)];

describe('bounds and cell checks', () => {
  it('accepts 0 … max and rejects above max with the limit in the message', () => {
    assert.deepEqual(checkCell('0', 100), { value: 0, error: null });
    assert.deepEqual(checkCell('100', 100), { value: 100, error: null });
    assert.deepEqual(checkCell('101', 100), { value: 101, error: 'Max 100' });
    assert.deepEqual(checkCell('26', 25), { value: 26, error: 'Max 25' });
  });

  it('empty or blank is not entered (null), never 0', () => {
    assert.deepEqual(checkCell('', 100), { value: null, error: null });
    assert.deepEqual(checkCell('   ', 100), { value: null, error: null });
  });

  it('rejects anything that is not a whole number', () => {
    for (const bad of ['-1', '4.5', '1e2', 'ab', '½']) {
      assert.equal(checkCell(bad, 100).error, 'Whole numbers only', bad);
    }
  });

  it('reads leading zeros as the number', () => {
    assert.deepEqual(checkCell('07', 100), { value: 7, error: null });
  });

  it('a part with no marks (limit 0) cannot take a value', () => {
    assert.equal(checkCell('5', 0).error, 'No marks for this part');
    assert.equal(checkCell('0', 0).error, 'No marks for this part');
    assert.equal(checkCell('', 0).error, null);
  });

  it('sanitizes typing and pastes to at most 4 digits', () => {
    assert.equal(sanitizeMarkInput('4 5'), '45');
    assert.equal(sanitizeMarkInput('-12.5'), '125');
    assert.equal(sanitizeMarkInput('12345'), '1234');
    assert.equal(sanitizeMarkInput('abc'), '');
  });
});

describe('per-subject rules', () => {
  it('TOTAL subjects have one Marks column up to full mark', () => {
    assert.deepEqual(markColumns(TOTAL), [{ field: 'marks', label: 'Marks', max: 100 }]);
  });

  it('BREAKDOWN subjects have CQ / MCQ / Prac with their own limits', () => {
    assert.deepEqual(
      markColumns(PHYSICS).map((c) => [c.field, c.max]),
      [
        ['cq_marks', 50],
        ['mcq_marks', 25],
        ['practical_marks', 25],
      ],
    );
    assert.equal(markColumns(BANGLA2)[2]!.max, 0);
  });

  it('a subject without limits is not configured (saving disabled)', () => {
    assert.equal(subjectConfigured(TOTAL), true);
    assert.equal(subjectConfigured(PHYSICS), true);
    assert.equal(subjectConfigured(subject({ full_mark: 0 })), false);
    assert.equal(
      subjectConfigured(subject({ marking_scheme: 'BREAKDOWN', full_mark: 100 })),
      false,
    );
  });

  it('lists only this class + session, never "main" subjects, filtered by group', () => {
    const all = [
      TOTAL,
      PHYSICS,
      subject({ id: 2, subject_type: 'main' }),
      subject({ id: 3, class: 8 }),
      subject({ id: 4, year: 2025 }),
      subject({ id: 5, group: 'Humanities' }),
    ];
    assert.deepEqual(
      entrySubjects(all, 9, 2026, '').map((s) => s.id),
      [11, 21, 5],
    );
    assert.deepEqual(
      entrySubjects(all, 9, 2026, 'Science').map((s) => s.id),
      [11, 21],
    );
  });

  it('a group subject is not for students of another group (or without one)', () => {
    assert.equal(groupMismatch(PHYSICS, st(1)), false);
    assert.equal(groupMismatch(PHYSICS, st(3, { group: 'Humanities' })), true);
    assert.equal(groupMismatch(PHYSICS, st(5, { group: null })), true);
    assert.equal(groupMismatch(TOTAL, st(3, { group: 'Humanities' })), false);
  });
});

describe('row values', () => {
  const saved: Saved = {
    1: { cq_marks: 40, mcq_marks: 20, practical_marks: 20, marks: 80 },
    2: { cq_marks: 10, mcq_marks: 5, practical_marks: null, marks: 77 },
  };

  it('shows the typed text, else the saved value, else empty', () => {
    const draft: Draft = { 1: { cq_marks: '45' } };
    assert.equal(cellText(draft, saved, 1, 'cq_marks'), '45');
    assert.equal(cellText(draft, saved, 1, 'mcq_marks'), '20');
    assert.equal(cellText(draft, saved, 4, 'marks'), '');
  });

  it('BREAKDOWN total is the sum of the entered parts', () => {
    const r = rowState(PHYSICS, { 4: { cq_marks: '45', mcq_marks: '20' } }, saved, 4);
    assert.deepEqual(r.values, { cq_marks: 45, mcq_marks: 20, practical_marks: null, marks: 65 });
    assert.equal(r.total, 65);
    assert.deepEqual(r.errors, {});
  });

  it('BREAKDOWN with every part empty is not entered (null), not 0', () => {
    const r = rowState(
      PHYSICS,
      { 1: { cq_marks: '', mcq_marks: '', practical_marks: '' } },
      saved,
      1,
    );
    assert.deepEqual(r.values, {
      cq_marks: null,
      mcq_marks: null,
      practical_marks: null,
      marks: null,
    });
    assert.equal(r.total, null);
  });

  it('BREAKDOWN 0 + 0 + 0 is a real zero, not absent', () => {
    const r = rowState(
      PHYSICS,
      { 4: { cq_marks: '0', mcq_marks: '0', practical_marks: '0' } },
      {},
      4,
    );
    assert.equal(r.values.marks, 0);
  });

  it('a disabled part never carries a value', () => {
    const r = rowState(BANGLA2, { 4: { cq_marks: '60', mcq_marks: '25' } }, {}, 4);
    assert.deepEqual(r.values, { cq_marks: 60, mcq_marks: 25, practical_marks: null, marks: 85 });
  });

  it('an over-limit part is an error and is left out of the total', () => {
    const r = rowState(PHYSICS, { 4: { cq_marks: '51', mcq_marks: '20' } }, {}, 4);
    assert.equal(r.errors.cq_marks, 'Max 50');
    assert.equal(r.values.cq_marks, null);
    assert.equal(r.total, 20);
  });

  it('TOTAL subjects keep the saved part values and only change marks', () => {
    const r = rowState(TOTAL, { 2: { marks: '90' } }, saved, 2);
    assert.deepEqual(r.values, { cq_marks: 10, mcq_marks: 5, practical_marks: null, marks: 90 });
  });

  it('clearing a saved TOTAL mark sends null (stored as not entered)', () => {
    const r = rowState(TOTAL, { 2: { marks: '' } }, saved, 2);
    assert.equal(r.values.marks, null);
  });

  it('reads saved marks of one subject per student', () => {
    const rows: ClassMarksRow[] = [
      {
        ...st(1),
        marks: [
          {
            subject_id: 21,
            subject: 'Physics',
            priority: 1,
            marking_scheme: 'BREAKDOWN',
            cq_marks: 40,
            mcq_marks: 20,
            practical_marks: 20,
            marks: 80,
          },
          {
            subject_id: 11,
            subject: 'Bangla',
            priority: 2,
            marking_scheme: 'TOTAL',
            cq_marks: null,
            mcq_marks: null,
            practical_marks: null,
            marks: 70,
          },
        ],
      },
      { ...st(2), marks: [] },
    ];
    assert.deepEqual(savedMarks(rows, 11), {
      1: { cq_marks: null, mcq_marks: null, practical_marks: null, marks: 70 },
    });
  });
});

describe('what gets saved', () => {
  const saved: Saved = { 1: { cq_marks: null, mcq_marks: null, practical_marks: null, marks: 70 } };
  const base = { subject: TOTAL, students: ROSTER, saved, examName: 'Half Yearly', year: 2026 };

  it('sends only changed students, with exactly the DTO fields', () => {
    const s = buildSubmission({
      ...base,
      draft: { 1: { marks: '75' }, 2: { marks: '60' }, 4: { marks: '' } },
    });
    assert.deepEqual(s.invalid, []);
    assert.equal(s.changed, 2);
    assert.deepEqual(s.payload, {
      examName: 'Half Yearly',
      year: 2026,
      students: [
        {
          studentId: 1,
          subjectMarks: [
            { subjectId: 11, cq_marks: null, mcq_marks: null, practical_marks: null, marks: 75 },
          ],
        },
        {
          studentId: 2,
          subjectMarks: [
            { subjectId: 11, cq_marks: null, mcq_marks: null, practical_marks: null, marks: 60 },
          ],
        },
      ],
    });
    assert.equal(JSON.stringify(s.payload).includes('school'), false);
  });

  it('retyping the saved value ("070" for 70) is not a change', () => {
    assert.deepEqual(changedStudents(TOTAL, ROSTER, { 1: { marks: '070' } }, saved), []);
    const s = buildSubmission({ ...base, draft: { 1: { marks: '070' } } });
    assert.equal(s.payload, null);
    assert.equal(s.changed, 0);
  });

  it('any invalid cell blocks the whole save and is listed', () => {
    const s = buildSubmission({ ...base, draft: { 1: { marks: '75' }, 2: { marks: '120' } } });
    assert.equal(s.payload, null);
    assert.deepEqual(s.invalid, [
      { studentId: 2, name: 'Student 2', field: 'marks', message: 'Max 100' },
    ]);
  });

  it('an invalid cell that equals nothing saved still counts as changed', () => {
    assert.deepEqual(changedStudents(TOTAL, ROSTER, { 4: { marks: '999' } }, {}), [4]);
  });

  it('students outside the subject group are never sent', () => {
    const s = buildSubmission({
      ...base,
      subject: PHYSICS,
      saved: {},
      draft: { 1: { cq_marks: '40' }, 3: { cq_marks: '40' } },
    });
    assert.deepEqual(
      s.payload?.students.map((x) => x.studentId),
      [1],
    );
  });

  it('nothing is sent for an unconfigured subject or without an exam', () => {
    const draft = { 1: { marks: '75' } };
    assert.equal(
      buildSubmission({ ...base, draft, subject: subject({ full_mark: 0 }) }).payload,
      null,
    );
    assert.equal(buildSubmission({ ...base, draft, examName: '' }).payload, null);
  });

  it('counts eligible / entered / not entered; a missing mark is not entered, not 0', () => {
    const c = entryCounts(
      PHYSICS,
      ROSTER,
      { 2: { cq_marks: '0' } },
      { 1: { cq_marks: 40, mcq_marks: null, practical_marks: null, marks: 40 } },
    );
    assert.deepEqual(c, { eligible: 3, entered: 2, notEntered: 1 });
  });

  it('save toasts: count, nothing changed, and server-skipped students', () => {
    assert.deepEqual(saveMessage({ count: 3, errors: [] }), {
      text: 'Marks saved (3 updated).',
      tone: 'success',
    });
    assert.deepEqual(saveMessage({ count: 0, errors: [] }), {
      text: 'No changes to save.',
      tone: 'success',
    });
    assert.deepEqual(saveMessage({ count: 1, errors: ['Student 9 is not enrolled', 'x'] }), {
      text: 'Saved 1 mark. Skipped: Student 9 is not enrolled (+1 more)',
      tone: 'error',
    });
  });
});

describe('keyboard flow and roster order', () => {
  it('Enter / ↓ / ↑ skip disabled rows and stop at the ends', () => {
    const enabled = [true, false, true, true];
    assert.equal(nextRow(enabled, 0, 1), 2);
    assert.equal(nextRow(enabled, 2, -1), 0);
    assert.equal(nextRow(enabled, 3, 1), null);
    assert.equal(nextRow(enabled, 0, -1), null);
  });

  it('orders section → roll → name and filters by section, group and search', () => {
    const list = [
      st(5, { section: 'B', roll: 1 }),
      st(2, { roll: 10 }),
      st(3, { roll: 2, group: 'Humanities' }),
    ];
    assert.deepEqual(
      sortRoster(list).map((s) => s.student_id),
      [3, 2, 5],
    );
    assert.deepEqual(
      scopeRoster(list, { section: 'A', group: 'Science' }).map((s) => s.student_id),
      [2],
    );
    assert.deepEqual(
      scopeRoster(list, { section: '', group: '', search: 'student 5' }).map((s) => s.student_id),
      [5],
    );
  });
});
