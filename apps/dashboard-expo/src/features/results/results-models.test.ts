/** Pure logic behind the results pages: exam setup, class teachers, year-end promotion, class results. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ClassMarksRow, Exam, Level, PromotionStats, StudentRow } from '@/lib/api';
import { examBody } from '@/lib/api/exams';
import {
  emptyExamForm,
  examFormFrom,
  examSummary,
  filterExams,
  formatExamRange,
  formatYmd,
  toExamInput,
  toggleLevel,
  validateExamForm,
} from '@/features/exams/model';
import {
  duplicateLevel,
  filterLevels,
  levelYearOptions,
  unassigned,
} from '@/features/levels/model';
import {
  failsText,
  generateConfirmText,
  generateMessages,
  graduateMessage,
  graduationDetail,
  holdConfirm,
  meritOrder,
  nextSecRoll,
  promoteMessages,
  promotionDetail,
  stepState,
  yearSummary,
} from '@/features/promotion/model';
import { examClasses, examNames, marksBySubject, resultsTable, sessionYears } from './filters';
import { pdfFileName } from '@/lib/files/pdf-name';

const exam = (o: Partial<Exam>): Exam => ({
  id: 1,
  exam_name: 'Half Yearly',
  exam_year: 2026,
  levels: [6, 7],
  visible: false,
  start_date: '2026-06-01',
  end_date: '2026-06-10',
  result_date: '2026-06-30',
  return_date: null,
  exam_type_id: 1,
  is_year_end: false,
  routine: null,
  ...o,
});

describe('exam setup', () => {
  const exams = [
    exam({ id: 1, visible: true, routine: 'r.pdf' }),
    exam({ id: 2, exam_name: 'Final', is_year_end: true, levels: [9, 10] }),
  ];

  it('filters by status, class and search; summarises', () => {
    const f = (o: Partial<Parameters<typeof filterExams>[1]>) =>
      filterExams(exams, { status: 'all', cls: null, search: '', ...o }).map((e) => e.id);
    assert.deepEqual(f({ status: 'published' }), [1]);
    assert.deepEqual(f({ status: 'draft' }), [2]);
    assert.deepEqual(f({ status: 'year-end' }), [2]);
    assert.deepEqual(f({ cls: 9 }), [2]);
    assert.deepEqual(f({ search: 'half' }), [1]);
    assert.deepEqual(examSummary(exams), { total: 2, published: 1, routines: 1, yearEnd: 1 });
  });

  it('validates like createExamSchema plus date order', () => {
    const e = validateExamForm(emptyExamForm(2026));
    assert.equal(e.exam_type_id, 'Exam type is required');
    assert.equal(e.levels, 'Select at least one class.');
    assert.equal(e.start_date, 'Start date is required');
    const v = { ...examFormFrom(exams[0]!), end_date: '2026-05-01' };
    assert.equal(validateExamForm(v).end_date, 'End date must be on or after the start date');
    assert.deepEqual(validateExamForm(examFormFrom(exams[0]!)), {});
    assert.equal(
      validateExamForm({ ...examFormFrom(exams[0]!), return_date: '1/2/2026' }).return_date,
      'Use YYYY-MM-DD',
    );
  });

  it('a valid form maps to a body the server schema accepts', async () => {
    const { createExamSchema } = await import('@school/shared-schemas');
    const form = { ...examFormFrom(exams[0]!), levels: toggleLevel(toggleLevel([6], 8), 6) };
    assert.deepEqual(form.levels, [8]);
    assert.equal(createExamSchema.safeParse(examBody(toExamInput(form))).success, true);
    assert.equal('return_date' in toExamInput(form), false);
  });

  it('formats dates', () => {
    assert.equal(formatYmd('2026-03-04'), '4 Mar 2026');
    assert.equal(formatYmd(''), '—');
    assert.equal(formatExamRange(exams[0]!), '1 Jun 2026 – 10 Jun 2026');
    assert.equal(
      formatExamRange({ start_date: '2026-06-01', end_date: '2026-06-01' }),
      '1 Jun 2026',
    );
  });
});

const level = (o: Partial<Level>): Level => ({
  id: 1,
  class_name: 9,
  section: 'A',
  year: 2026,
  teacher_id: 4,
  teacher_name: 'Rahim',
  teacher_available: true,
  ...o,
});

describe('class teachers', () => {
  const levels = [
    level({ id: 2, class_name: 10, section: 'B' }),
    level({ id: 1 }),
    level({ id: 3, year: 2025, teacher_name: 'Karim' }),
  ];

  it('year options and filtering', () => {
    assert.deepEqual(levelYearOptions(2026), [2027, 2026, 2025]);
    assert.deepEqual(
      filterLevels(levels, { year: 2026, cls: null, search: '' }).map((l) => l.id),
      [1, 2],
    );
    assert.deepEqual(
      filterLevels(levels, { year: 2026, cls: 10, search: '' }).map((l) => l.id),
      [2],
    );
    assert.deepEqual(
      filterLevels(levels, { year: 2026, cls: null, search: 'class 9' }).map((l) => l.id),
      [1],
    );
  });

  it('flags a duplicate class + section + year but not the row being edited', () => {
    assert.equal(duplicateLevel(levels, { class_name: 9, section: 'a', year: 2026 }, null)?.id, 1);
    assert.equal(duplicateLevel(levels, { class_name: 9, section: 'A', year: 2026 }, 1), undefined);
    assert.equal(
      duplicateLevel(levels, { class_name: 9, section: 'A', year: 2027 }, null),
      undefined,
    );
    assert.deepEqual(unassigned(levels, 2026, [9, 10], ['A', 'B']), ['9B', '10A']);
  });
});

const row = (o: Partial<StudentRow>): StudentRow =>
  ({
    id: 1,
    name: 'A',
    roll: 1,
    class: 6,
    section: 'A',
    group: null,
    status: 'Passed',
    final_merit: 0,
    fail_count: null,
    result_held: false,
    next_year_roll: 0,
    next_year_section: null,
    ...o,
  }) as StudentRow;

const stats = (o: Partial<PromotionStats> = {}): PromotionStats => ({
  year: 2026,
  newYear: 2027,
  promotion: { passed: 0, failed: 0, pending: 0, graduated: 0, total: 0 },
  class10: { passed: 0, failed: 0, pending: 0, graduated: 0, total: 0 },
  promoted: false,
  next_year_enrollments: 0,
  awaiting_roll: 0,
  ...o,
});

describe('year-end promotion', () => {
  it('orders by merit with unranked last, then class / section / roll', () => {
    const rows = [
      row({ id: 1, final_merit: 0, roll: 2 }),
      row({ id: 2, final_merit: 2 }),
      row({ id: 3, final_merit: 1 }),
      row({ id: 4, final_merit: 0, roll: 1 }),
    ];
    assert.deepEqual(
      meritOrder(rows).map((r) => r.id),
      [3, 2, 4, 1],
    );
  });

  it('fails / allowed and next section · roll', () => {
    assert.equal(failsText(row({ fail_count: 2, class: 7 }), { 7: 1 }), '2/1');
    assert.equal(failsText(row({ fail_count: null }), {}), '—');
    assert.equal(nextSecRoll(row({ next_year_section: 'B', next_year_roll: 12 })), 'B · 12');
    assert.equal(nextSecRoll(row({})), '—');
  });

  it('step state and texts follow the web page', () => {
    const s = stats({
      promotion: { passed: 3, failed: 1, pending: 2, graduated: 0, total: 6 },
      awaiting_roll: 1,
      next_year_enrollments: 4,
    });
    assert.equal(stepState(s).passFailGenerated, true);
    assert.equal(stepState(undefined).passFailGenerated, false);
    assert.equal(
      yearSummary(s, 2026),
      '6 in classes 6–9 · 3 passed · 1 failed · 2 pending · promotes into 2027',
    );
    assert.match(promotionDetail(s, 2026), /1 failed class-6 student have no roll yet/);
    assert.match(promotionDetail(s, 2026), /4 enrollments exist — re-running replaces/);
    assert.match(promotionDetail(stats(), 2026), /safe to promote/);
    assert.equal(graduationDetail(stats()), 'No active class-10 students for this year.');
    assert.equal(stepState(stats()).class10Done, true);
    assert.match(generateConfirmText(2026, [{ class: 6, max_failed: 1 }]), /6: 1/);
  });

  it('result messages', () => {
    assert.deepEqual(
      generateMessages({ passed: 5, failed: 1, missingYearEnd: [8], missingPrevious: [] }),
      {
        success: 'Pass/fail updated: 5 passed, 1 failed',
        errors: ['Skipped class 8: no year-end exam'],
      },
    );
    assert.equal(
      generateMessages({ passed: null, failed: null, missingYearEnd: [], missingPrevious: [] })
        .success,
      'Pass/fail status generated',
    );
    assert.deepEqual(
      promoteMessages({ promoted: 10, awaitingRoll: 2, skipped: 1, newYear: 2027 }).errors.length,
      2,
    );
    assert.equal(
      graduateMessage({ graduated: 40, retained: 2 }),
      'Graduation complete: 40 alumni, 2 retained',
    );
    assert.equal(holdConfirm('Rina', true).confirmLabel, 'Release');
    assert.equal(holdConfirm('Rina', false).title, 'Hold result?');
  });
});

describe('class results', () => {
  const m = (subject: string, priority: number, marks: number | null) => ({
    subject_id: priority,
    subject,
    priority,
    marking_scheme: 'TOTAL' as const,
    cq_marks: null,
    mcq_marks: null,
    practical_marks: null,
    marks,
  });
  const rows: ClassMarksRow[] = [
    {
      student_id: 1,
      name: 'Rafi',
      roll: 2,
      class: 9,
      section: 'A',
      group: 'Science',
      marks: [m('Math', 2, 80), m('Bangla', 1, null)],
    },
    {
      student_id: 2,
      name: 'Mitu',
      roll: 1,
      class: 9,
      section: 'B',
      group: 'Humanities',
      marks: [m('Bangla', 1, 70)],
    },
    {
      student_id: 3,
      name: 'Nila',
      roll: 3,
      class: 9,
      section: 'A',
      group: 'Science',
      marks: [m('Bangla', 1, null)],
    },
  ];

  it('subjects by priority; only students with marks; counts the rest', () => {
    const t = resultsTable(rows, { section: '', group: '', search: '' });
    assert.deepEqual(t.subjects, ['Bangla', 'Math']);
    assert.deepEqual(
      t.shown.map((r) => r.student_id),
      [1, 2],
    );
    assert.equal(t.noMarks, 1);
    assert.deepEqual(t.groups, ['Humanities', 'Science']);
    assert.deepEqual(
      resultsTable(rows, { section: 'A', group: '', search: '' }).shown.map((r) => r.student_id),
      [1],
    );
    assert.deepEqual(
      resultsTable(rows, { section: '', group: '', search: 'mitu' }).shown.map((r) => r.student_id),
      [2],
    );
    assert.deepEqual(marksBySubject(rows[0]!), { Math: 80, Bangla: null });
  });

  it('exam pickers', () => {
    const exams = [
      exam({ id: 2, exam_name: 'Final', start_date: '2026-11-01', levels: [10, 9] }),
      exam({ id: 1 }),
      exam({ id: 3, exam_year: 2024 }),
    ];
    assert.deepEqual(examNames(exams, 2026), ['Half Yearly', 'Final']);
    assert.deepEqual(examClasses(exams, 2026, 'Final'), [9, 10]);
    assert.deepEqual(sessionYears(exams, 2026, 2), [2026, 2025, 2024]);
  });

  it('PDF file names are filesystem-safe', () => {
    assert.equal(pdfFileName(['Class 9A', 'Half Yearly', 2026]), 'class-9a-half-yearly-2026.pdf');
    assert.equal(pdfFileName([null, '', '../..']), 'document.pdf');
  });
});
