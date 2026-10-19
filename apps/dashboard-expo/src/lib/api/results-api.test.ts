/**
 * Results clients (marks, exams, class teachers, year-end promotion): exact paths, methods,
 * whitelisted bodies, response parsing, and that no school id is ever sent (the server derives
 * the school from host + token).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import {
  createExamsApi,
  examBody,
  parseExamTypes,
  parseExams,
  yearEndGaps,
  type Exam,
} from './exams';
import { createLevelsApi, parseLevels } from './levels';
import { createMarksApi, parseClassMarks, parseSaveResult } from './marks';
import {
  clampMaxFailed,
  createPromotionsApi,
  normalizeRules,
  parseGraduationPlan,
  parsePlan,
  parsePromotionStats,
} from './promotions';

type Call = { url: string; method: string; body: unknown };

const legacy = (data: unknown, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ statusCode: 200, success: true, message: 'ok', data, ...extra }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const nest = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function harness(respond: (c: Call) => Response = () => legacy(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
  });
  return { calls, client };
}
const url = (c: Call) => new URL(c.url);
const noSchoolId = (calls: Call[]) => {
  for (const c of calls) {
    assert.equal(url(c).searchParams.has('school_id'), false);
    assert.equal(JSON.stringify(c.body ?? {}).includes('school'), false);
  }
};

describe('marks client', () => {
  it('loads the roster and class marks with class / year / exam', async () => {
    const h = harness(() => nest([]));
    const api = createMarksApi(h.client);
    await api.roster({ cls: 9, year: 2026 });
    await api.classMarks({ cls: 9, year: 2026, exam: 'Half Yearly' });
    assert.equal(url(h.calls[0]!).pathname, '/api/marks/roster');
    assert.equal(url(h.calls[0]!).search, '?class=9&year=2026');
    assert.equal(url(h.calls[1]!).pathname, '/api/marks');
    assert.equal(url(h.calls[1]!).searchParams.get('exam'), 'Half Yearly');
    noSchoolId(h.calls);
  });

  it('saves with PUT and only the DTO keys (extra fields stripped)', async () => {
    const h = harness(() => nest({ success: true, count: 1 }));
    const r = await createMarksApi(h.client).save({
      examName: 'Half Yearly',
      year: 2026,
      students: [
        {
          studentId: 7,
          subjectMarks: [
            {
              subjectId: 3,
              cq_marks: 40,
              mcq_marks: null,
              practical_marks: null,
              marks: 40,
              // a stray field must never reach the forbidNonWhitelisted DTO
              ...({ school_id: 99, name: 'x' } as object),
            },
          ],
          ...({ school_id: 99 } as object),
        },
      ],
    });
    const c = h.calls[0]!;
    assert.equal(c.method, 'PUT');
    assert.equal(url(c).pathname, '/api/marks');
    assert.deepEqual(c.body, {
      students: [
        {
          studentId: 7,
          subjectMarks: [
            { subjectId: 3, cq_marks: 40, mcq_marks: null, practical_marks: null, marks: 40 },
          ],
        },
      ],
      examName: 'Half Yearly',
      year: 2026,
    });
    assert.deepEqual(r, { count: 1, errors: [] });
    noSchoolId(h.calls);
  });

  it('keeps null (not entered) as null in the body', async () => {
    const h = harness(() => nest({ success: true, count: 1 }));
    await createMarksApi(h.client).save({
      examName: 'Final',
      year: 2026,
      students: [
        {
          studentId: 1,
          subjectMarks: [
            { subjectId: 2, cq_marks: null, mcq_marks: null, practical_marks: null, marks: null },
          ],
        },
      ],
    });
    const body = h.calls[0]!.body as { students: { subjectMarks: Record<string, unknown>[] }[] };
    assert.equal(body.students[0]!.subjectMarks[0]!.marks, null);
  });

  it('surfaces per-student errors returned with a 200', () => {
    assert.deepEqual(
      parseSaveResult({ success: true, count: 2, errors: ['Student 4 not enrolled', 5] }),
      {
        count: 2,
        errors: ['Student 4 not enrolled'],
      },
    );
    assert.throws(() => parseSaveResult('nope'), ApiError);
  });

  it('refuses to save without an exam (no request sent)', async () => {
    const h = harness();
    await assert.rejects(
      createMarksApi(h.client).save({ examName: '  ', year: 2026, students: [] }),
      (e: unknown) => e instanceof ApiError && e.kind === 'config',
    );
    assert.equal(h.calls.length, 0);
  });

  it('parses class marks: scheme from subject_info, null marks stay null', () => {
    const rows = parseClassMarks([
      {
        student_id: 1,
        name: 'A',
        roll: 3,
        class: 9,
        section: 'A',
        group: 'Science',
        marks: [
          {
            subject_id: 5,
            subject: 'Physics',
            priority: 2,
            cq_marks: 40,
            mcq_marks: null,
            marks: 40,
            subject_info: { marking_scheme: 'BREAKDOWN' },
          },
          { subject_id: 6, subject: 'Bangla', priority: 1, marks: null },
        ],
      },
    ]);
    assert.equal(rows[0]!.marks[0]!.marking_scheme, 'BREAKDOWN');
    assert.equal(rows[0]!.marks[0]!.mcq_marks, null);
    assert.equal(rows[0]!.marks[1]!.marking_scheme, 'TOTAL');
    assert.equal(rows[0]!.marks[1]!.marks, null);
  });

  it('marksheet PDFs and the bundle URL', async () => {
    const h = harness((c) =>
      url(c).pathname.endsWith('/bundle')
        ? nest({ url: 'https://cdn.test/b.pdf' })
        : new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
            headers: { 'content-type': 'application/pdf' },
          }),
    );
    const api = createMarksApi(h.client);
    await api.studentPdf({ studentId: 8, year: 2026, exam: 'Final' });
    await api.summaryPdf({ cls: 9, year: 2026, exam: 'Final', section: 'B' });
    assert.equal(
      await api.bundleUrl({ cls: 9, year: 2026, exam: 'Final' }),
      'https://cdn.test/b.pdf',
    );
    assert.equal(url(h.calls[0]!).pathname, '/api/marksheets/students/8');
    assert.equal(url(h.calls[1]!).pathname, '/api/marksheets/classes/9/summary');
    assert.equal(url(h.calls[1]!).searchParams.get('section'), 'B');
    assert.equal(url(h.calls[2]!).searchParams.has('section'), false);
  });

  it('rejects a bundle response without an http(s) URL', async () => {
    const h = harness(() => nest({ url: 'javascript:alert(1)' }));
    await assert.rejects(
      createMarksApi(h.client).bundleUrl({ cls: 9, year: 2026, exam: 'F' }),
      ApiError,
    );
  });
});

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

describe('exams client', () => {
  it('parses exams: ymd dates, sorted unique levels, empty return date → null', () => {
    const [e] = parseExams([
      {
        id: 3,
        exam_name: 'Final',
        exam_year: 2026,
        levels: [9, '6', 9],
        visible: true,
        start_date: '2026-11-01T00:00:00.000Z',
        end_date: '2026-11-10',
        result_date: '2026-12-01',
        return_date: '',
        is_year_end: true,
      },
    ]);
    assert.deepEqual(e!.levels, [6, 9]);
    assert.equal(e!.start_date, '2026-11-01');
    assert.equal(e!.return_date, null);
    assert.equal(e!.is_year_end, true);
  });

  it('orders exam types by sort order', () => {
    assert.deepEqual(
      parseExamTypes([
        { id: 2, name: 'Final', sort_order: 2 },
        { id: 1, name: 'Half', sort_order: 1 },
      ]).map((t) => t.id),
      [1, 2],
    );
  });

  it('creates as { exams: [body] }, updates and deletes by id', async () => {
    const h = harness();
    const api = createExamsApi(h.client);
    const input = {
      exam_type_id: 2,
      exam_year: 2026,
      levels: [7, 6, 7],
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      result_date: '2026-06-30',
      return_date: ' ',
    };
    await api.create(input);
    await api.update(5, input);
    await api.remove(5);
    assert.equal(h.calls[0]!.method, 'POST');
    assert.equal(url(h.calls[0]!).pathname, '/api/exams/addExam');
    assert.deepEqual(h.calls[0]!.body, {
      exams: [
        {
          exam_type_id: 2,
          exam_year: 2026,
          levels: [6, 7],
          start_date: '2026-06-01',
          end_date: '2026-06-10',
          result_date: '2026-06-30',
        },
      ],
    });
    assert.equal(url(h.calls[1]!).pathname, '/api/exams/updateExam/5');
    assert.equal(h.calls[1]!.method, 'PUT');
    assert.equal(h.calls[2]!.method, 'DELETE');
    assert.equal(url(h.calls[2]!).pathname, '/api/exams/deleteExam/5');
    noSchoolId(h.calls);
  });

  it('publishing reads the top-level `queued` count', async () => {
    const h = harness(() => legacy(null, { queued: 42 }));
    assert.deepEqual(await createExamsApi(h.client).setVisibility(4, true), { queued: 42 });
    assert.deepEqual(h.calls[0]!.body, { visible: true });
    assert.equal(url(h.calls[0]!).pathname, '/api/exams/updateVisibility/4');
  });

  it('the exam body passes the server schema (createExamSchema)', async () => {
    const { createExamSchema } = await import('@school/shared-schemas');
    const body = examBody({
      exam_type_id: 1,
      exam_year: 2026,
      levels: [6],
      start_date: '2026-01-01',
      end_date: '2026-01-05',
      result_date: '2026-01-20',
      return_date: '2026-01-25',
    });
    assert.equal(createExamSchema.safeParse(body).success, true);
    assert.equal(createExamSchema.safeParse({ ...body, levels: [] }).success, false);
  });

  it('finds classes with exams but no year-end exam', () => {
    const exams = [exam({ levels: [6, 7, 8] }), exam({ id: 2, levels: [6], is_year_end: true })];
    assert.deepEqual(yearEndGaps(exams), [7, 8]);
    assert.deepEqual(yearEndGaps([]), []);
  });
});

describe('class teachers client', () => {
  it('upper-cases the section and sends only form keys', async () => {
    const h = harness();
    const api = createLevelsApi(h.client);
    await api.create({
      class_name: 9,
      section: ' b ',
      year: 2026,
      teacher_id: 4,
      ...({ school_id: 1 } as object),
    });
    await api.update(3, { class_name: 9, section: 'a', year: 2026, teacher_id: 4 });
    await api.remove(3);
    assert.deepEqual(h.calls[0]!.body, { class_name: 9, section: 'B', year: 2026, teacher_id: 4 });
    assert.equal(url(h.calls[0]!).pathname, '/api/level/addLevel');
    assert.equal(url(h.calls[1]!).pathname, '/api/level/updateLevel/3');
    assert.equal(url(h.calls[2]!).pathname, '/api/level/deleteLevel/3');
    noSchoolId(h.calls);
  });

  it('parses levels; missing teacher name → Unknown', () => {
    const [l] = parseLevels([
      { id: 1, class_name: '9', section: 'A', year: 2026, teacher_id: null },
    ]);
    assert.equal(l!.class_name, 9);
    assert.equal(l!.teacher_name, 'Unknown');
    assert.equal(l!.teacher_id, null);
  });
});

describe('promotion client', () => {
  it('pass rules: missing class is strict 0; saved values clamped to 0–15', async () => {
    assert.deepEqual(
      normalizeRules([{ class: 7, max_failed: 2 }]).map((r) => r.max_failed),
      [0, 2, 0, 0, 0],
    );
    assert.equal(clampMaxFailed('99'), 15);
    assert.equal(clampMaxFailed('-3'), 0);
    assert.equal(clampMaxFailed('abc'), 0);
    assert.equal(clampMaxFailed(2.7), 2);
    const h = harness(() => nest(null));
    await createPromotionsApi(h.client).savePassRules(2026, [
      { class: 6, max_failed: 40 },
      { class: 11, max_failed: 1 },
    ]);
    assert.equal(h.calls[0]!.method, 'PUT');
    assert.equal(url(h.calls[0]!).pathname, '/api/promotions/2026/pass-rules');
    assert.deepEqual(h.calls[0]!.body, { rules: [{ class: 6, max_failed: 15 }] });
  });

  it('generate / override / hold / release / promote / graduate hit the right endpoints', async () => {
    const h = harness((c) =>
      url(c).pathname.endsWith('/results')
        ? nest({ passed: 10, failed: 2, missingYearEnd: [8] })
        : nest({ promoted: 5, newYear: 2027 }),
    );
    const api = createPromotionsApi(h.client);
    assert.deepEqual(await api.generateResults(2026), {
      passed: 10,
      failed: 2,
      missingYearEnd: [8],
      missingPrevious: [],
    });
    await api.overrideStatus(2026, 77, 'Failed');
    await api.hold(2026, [77]);
    await api.release(2026, [77]);
    const p = await api.promote(2026);
    await api.assignRetained(2026);
    await api.graduate(2026);
    const seen = h.calls.map((c) => `${c.method} ${url(c).pathname}`);
    assert.deepEqual(seen, [
      'POST /api/promotions/2026/results',
      'PATCH /api/promotions/2026/results/77',
      'POST /api/promotions/2026/results/holds',
      'POST /api/promotions/2026/results/releases',
      'POST /api/promotions/2026',
      'POST /api/promotions/2026/retained',
      'POST /api/graduations/2026',
    ]);
    assert.deepEqual(h.calls[1]!.body, { status: 'Failed' });
    assert.deepEqual(h.calls[2]!.body, { enrollment_ids: [77] });
    assert.equal(p.promoted, 5);
    noSchoolId(h.calls);
  });

  it('parses stats and dry-run plans defensively', () => {
    const s = parsePromotionStats({ promotion: { passed: 3, failed: 1, total: 5 } }, 2026);
    assert.equal(s.newYear, 2027);
    assert.equal(s.promotion.pending, 0);
    assert.equal(s.class10.total, 0);
    const plan = parsePlan(
      { students: [{ enrollment_id: 1, name: 'A', new_roll: null }], summary: { total: 1 } },
      2026,
    );
    assert.equal(plan.students[0]!.new_roll, null);
    assert.equal(plan.summary.total, 1);
    const g = parseGraduationPlan({ sscBatch: '2027', students: [{ action: 'weird' }] }, 2026);
    assert.equal(g.students[0]!.action, 'retain');
    assert.throws(() => parsePlan(null, 2026), ApiError);
  });
});
