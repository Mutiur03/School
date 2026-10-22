/**
 * Batch 4 clients (staff, alumni, head message, SMS, school codes, billing, student bulk
 * actions, password rotations, student profile): exact paths, methods and bodies as verified
 * against server/ routes + controllers, and that no school id is ever sent.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBillingApi, parseSubscription } from './billing';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { createSchoolCodesAdminApi, parseSchoolCode } from './school-codes';
import {
  createSmsApi,
  normalizeSmsStatus,
  parseSmsLogsPage,
  parseSmsSettings,
  parseStudentCount,
  settingsPatchBody,
} from './sms';
import { createStaffApi } from './staff';
import { parseProfile } from './student-portal';
import { createStudentsApi, parseAlumnus, uniqueIds } from './students';
import { createTeachersApi, headMessageBody, parseHeadMessage } from './teachers';

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ statusCode: status, success: true, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const raw = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const bytes = (type: string) =>
  new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
    status: 200,
    headers: { 'content-type': type },
  });

function harness(respond: (c: Call, i: number) => Response = () => ok(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const b = init?.body;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof b === 'string' ? JSON.parse(b) : b,
      headers: (init?.headers as Record<string, string>) ?? {},
    };
    calls.push(call);
    return respond(call, calls.length - 1);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
  });
  return { calls, client };
}

const path = (c: Call) => new URL(c.url).pathname;
const query = (c: Call) => Object.fromEntries(new URL(c.url).searchParams);
const noSchoolId = (calls: Call[]) => {
  for (const c of calls) {
    assert.equal(new URL(c.url).searchParams.has('school_id'), false);
    if (c.body && typeof c.body === 'object') {
      assert.equal('school_id' in (c.body as object), false);
      assert.equal('schoolId' in (c.body as object), false);
    }
  }
};

describe('staff', () => {
  it('lists, creates ({staff:[...]}), updates, deletes and swaps the photo', async () => {
    const h = harness((c) => {
      if (c.method === 'GET') return ok([{ id: 3, name: 'Rahim', phone: '01711111111' }]);
      if (path(c) === '/api/staffs' && c.method === 'POST')
        return ok([{ id: 9, name: 'Karim', phone: '01722222222' }], 201);
      return ok(null);
    });
    const api = createStaffApi(h.client);
    const rows = await api.list();
    assert.equal(rows[0]?.name, 'Rahim');
    assert.equal(rows[0]?.email, null);
    const input = {
      name: 'Karim',
      email: null,
      phone: '01722222222',
      designation: 'Peon',
      address: null,
    };
    assert.equal((await api.create(input))?.id, 9);
    await api.update(9, input);
    await api.remove(9);
    await api.removeImage(9);
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${path(c)}`),
      [
        'GET /api/staffs',
        'POST /api/staffs',
        'PUT /api/staffs/9',
        'DELETE /api/staffs/9',
        'DELETE /api/staffs/9/image',
      ],
    );
    assert.deepEqual(h.calls[1]?.body, { staff: [input] });
    noSchoolId(h.calls);
  });
});

describe('students: bulk, rotation, certificates, TC, alumni', () => {
  it('deletes many with DELETE /api/students {studentIds}, deduped', async () => {
    const h = harness(() => ok({ deletedCount: 2 }));
    assert.equal(await createStudentsApi(h.client).removeMany([4, 5, 4]), 2);
    assert.equal(h.calls[0]?.method, 'DELETE');
    assert.equal(path(h.calls[0]!), '/api/students');
    assert.deepEqual(h.calls[0]?.body, { studentIds: [4, 5] });
  });
  it('uniqueIds drops duplicates and non-positive ids', () => {
    assert.deepEqual(uniqueIds([3, 3, 0, -1, 2.5, 7]), [3, 7]);
  });
  it('rotates passwords and returns the workbook bytes', async () => {
    const h = harness(() => bytes('application/vnd.ms-excel'));
    const buf = await createStudentsApi(h.client).rotatePasswords(new Set([8, 9]));
    assert.equal(buf.byteLength, 4);
    assert.equal(path(h.calls[0]!), '/api/students/password-rotations');
    assert.deepEqual(h.calls[0]?.body, { studentIds: [8, 9] });
  });
  it('testimonial is a POST returning the PDF; TC and reactivate are plain POSTs', async () => {
    const h = harness((c) =>
      path(c).endsWith('testimonials') ? bytes('application/pdf') : ok({}),
    );
    const api = createStudentsApi(h.client);
    assert.equal((await api.testimonial(12)).byteLength, 4);
    await api.issueTc(12);
    await api.reactivate(12);
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${path(c)}`),
      [
        'POST /api/students/12/testimonials',
        'POST /api/students/12/tc',
        'POST /api/students/12/reactivate',
      ],
    );
    noSchoolId(h.calls);
  });
  it('alumni parses rows and rejects a non-array', async () => {
    const h = harness(() =>
      ok([{ id: 1, name: 'A', batch: '2020', dob: '2004-05-06T00:00:00.000Z', has_stipend: true }]),
    );
    const [a] = await createStudentsApi(h.client).alumni();
    assert.equal(path(h.calls[0]!), '/api/students/alumni');
    assert.equal(a?.dob, '2004-05-06');
    assert.equal(a?.has_stipend, true);
    assert.equal(a?.available, true);
    const bad = harness(() => ok({ rows: [] }));
    await assert.rejects(createStudentsApi(bad.client).alumni(), ApiError);
    assert.equal(parseAlumnus({ id: 2, name: 'B', available: false }).available, false);
  });
});

describe('teachers: rotation and head message', () => {
  it('rotates with {teacherIds} deduped', async () => {
    const h = harness(() => bytes('application/vnd.ms-excel'));
    await createTeachersApi(h.client).rotatePasswords([1, 1, 2]);
    assert.equal(path(h.calls[0]!), '/api/teachers/password-rotations');
    assert.deepEqual(h.calls[0]?.body, { teacherIds: [1, 2] });
  });
  it('reads and saves the head message', async () => {
    const h = harness((c) =>
      c.method === 'GET'
        ? ok({ teacher: { id: 4, name: 'Head' }, head_message: 'হ্যালো।', head_role: 'Headmaster' })
        : ok({}),
    );
    const api = createTeachersApi(h.client);
    const m = await api.headMessage();
    assert.equal(m.teacher?.id, 4);
    assert.equal(m.message, 'হ্যালো।');
    await api.saveHeadMessage({ teacherId: 4, message: 'x', headRole: 'Headmaster' });
    assert.equal(h.calls[1]?.method, 'POST');
    assert.equal(path(h.calls[1]!), '/api/teachers/head-message');
    noSchoolId(h.calls);
  });
  it('headMessageBody sends only set fields, trimmed; null when empty', () => {
    assert.deepEqual(headMessageBody({ teacherId: 3, message: '  hi  ', role: 'Headmaster' }), {
      teacherId: 3,
      message: 'hi',
      headRole: 'Headmaster',
    });
    assert.equal(headMessageBody({ teacherId: null, message: '  ', role: '' }), null);
    assert.equal(parseHeadMessage(null).role, 'Headmaster');
  });
});

describe('sms', () => {
  const settingsRow = {
    id: 1,
    school_id: 7,
    api_key: 'enc:secret',
    present_template: 'P {student_name}',
    absent_template: 'A {student_name}',
    run_awayed_template: 'R {student_name}',
    send_to_present: false,
    send_to_absent: true,
    send_to_run_awayed: true,
    is_active: true,
  };
  it('PATCH body is a whitelist: never id, school_id or credentials', async () => {
    const parsed = parseSmsSettings(settingsRow);
    assert.equal('api_key' in parsed, false);
    const body = settingsPatchBody({ ...parsed, ...({ school_id: 99, id: 5 } as object) }, [
      '{date}',
    ]);
    assert.deepEqual(Object.keys(body).sort(), [
      'absent_template',
      'is_active',
      'present_template',
      'requiredPlaceholders',
      'run_awayed_template',
      'send_to_absent',
      'send_to_present',
      'send_to_run_awayed',
    ]);
    const h = harness((c) => (c.method === 'GET' ? ok(settingsRow) : ok({})));
    const api = createSmsApi(h.client);
    await api.saveSettings(await api.settings(), []);
    assert.equal(h.calls[1]?.method, 'PATCH');
    assert.equal(path(h.calls[1]!), '/api/sms-settings');
    assert.equal('api_key' in (h.calls[1]?.body as object), false);
    noSchoolId(h.calls);
  });
  it('logs: raw (unenveloped) JSON, query params, folded provider statuses', async () => {
    const h = harness(() =>
      raw({
        smsLogs: [{ id: 1, status: 'delivered', category: 'bulk', message: 'm', created_at: '' }],
        totalPages: 3,
        totalCount: 41,
        stats: { success: 2, sent: 1, failed: 4, queued: 1 },
      }),
    );
    const page = await createSmsApi(h.client).logs({
      page: 2,
      limit: 20,
      category: 'bulk',
      status: 'failed',
      date: '2026-10-01',
    });
    assert.equal(path(h.calls[0]!), '/api/sms/sms-logs');
    assert.deepEqual(query(h.calls[0]!), {
      page: '2',
      limit: '20',
      category: 'bulk',
      status: 'failed',
      date: '2026-10-01',
    });
    assert.equal(page.logs[0]?.status, 'sent');
    assert.deepEqual(page.stats, { sent: 3, failed: 4, pending: 1 });
    assert.equal(page.totalCount, 41);
    assert.throws(() => parseSmsLogsPage({}), ApiError);
    assert.equal(normalizeSmsStatus('SUCCESS'), 'sent');
    assert.equal(normalizeSmsStatus(undefined), 'pending');
  });
  it('retry, delete (DELETE with body), bulk, test send and student count', async () => {
    const h = harness((c) => {
      if (path(c) === '/api/sms/bulk-sms')
        return raw({ successCount: 10, failedCount: 1, results: [] });
      if (path(c) === '/api/sms/student-count')
        return raw({
          totalStudents: 5,
          withPhone: 4,
          classBreakdown: { 10: { total: 2, withPhone: 2 }, 6: { total: 3, withPhone: 2 } },
        });
      return raw({ message: 'ok' });
    });
    const api = createSmsApi(h.client);
    await api.retry([1, 2]);
    await api.deleteLogs([3]);
    assert.deepEqual(await api.sendBulk([6, 10], 'Hello'), { sent: 10, failed: 1 });
    await api.sendTest('01711111111', 'Hi');
    const count = await api.studentCount([6, 10]);
    assert.deepEqual(
      count.classBreakdown.map((c) => c.cls),
      [6, 10],
    );
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${path(c)}`),
      [
        'POST /api/sms/retry-sms',
        'DELETE /api/sms/sms-logs',
        'POST /api/sms/bulk-sms',
        'POST /api/sms-settings/test',
        'GET /api/sms/student-count',
      ],
    );
    assert.deepEqual(h.calls[0]?.body, { smsLogIds: [1, 2] });
    assert.deepEqual(h.calls[1]?.body, { smsLogIds: [3] });
    assert.deepEqual(h.calls[2]?.body, { classNames: [6, 10], message: 'Hello' });
    assert.deepEqual(h.calls[3]?.body, { phoneNumber: '01711111111', message: 'Hi' });
    assert.throws(() => parseStudentCount(null), ApiError);
    noSchoolId(h.calls);
  });
});

describe('school codes (admin)', () => {
  it('lists, creates with or without a role hint, revokes', async () => {
    const row = { id: 5, code: 'ABCD-EFGH', role_hint: 'teacher', status: 'active' };
    const h = harness((c) => (c.method === 'GET' ? ok([row, { bogus: 1 }]) : ok(row)));
    const api = createSchoolCodesAdminApi(h.client);
    const list = await api.list();
    assert.equal(list.length, 1);
    await api.create('teacher');
    await api.create(null);
    await api.revoke(5);
    assert.deepEqual(h.calls[1]?.body, { role_hint: 'teacher' });
    assert.deepEqual(h.calls[2]?.body, {});
    assert.equal(`${h.calls[3]?.method} ${path(h.calls[3]!)}`, 'DELETE /api/school-codes/5');
    assert.equal(parseSchoolCode({ id: 1, code: 'X', status: 'weird' })?.status, 'expired');
    noSchoolId(h.calls);
  });
});

describe('billing', () => {
  it('reads GET /api/schools/billing and rejects unknown statuses', async () => {
    const h = harness(() =>
      ok({
        status: 'active',
        plan_name: 'Annual plan',
        access_state: 'active',
        days_remaining: 40,
      }),
    );
    const s = await createBillingApi(h.client).current();
    assert.equal(path(h.calls[0]!), '/api/schools/billing');
    assert.equal(s.days_remaining, 40);
    assert.throws(() => parseSubscription({ status: 'free' }), ApiError);
    assert.equal(
      parseSubscription({ status: 'expired', access_state: '??' }).access_state,
      'locked',
    );
  });
});

describe('subscription access', () => {
  it('reads GET /api/schools/subscription-access; a 402 body still means locked', async () => {
    const ok200 = harness(() =>
      ok({ status: 'active', access_state: 'grace', grace_days_remaining: 3 }),
    );
    const g = await createBillingApi(ok200.client).access();
    assert.equal(path(ok200.calls[0]!), '/api/schools/subscription-access');
    assert.deepEqual([g.access_state, g.is_locked, g.grace_days_remaining], ['grace', false, 3]);

    const locked = harness(() =>
      raw(
        {
          success: false,
          message: 'locked',
          data: { status: 'expired', access_state: 'locked', is_locked: true },
          errors: [],
        },
        402,
      ),
    );
    assert.equal((await createBillingApi(locked.client).access()).is_locked, true);

    const down = harness(() => raw({ success: false, message: 'boom', errors: [] }, 500));
    await assert.rejects(createBillingApi(down.client).access(), ApiError);
  });
});

describe('student profile', () => {
  it('parses personal, contact and address fields', () => {
    const p = parseProfile({
      id: 1,
      name: 'Ayesha',
      login_id: '26100045',
      class: '9',
      roll: 3,
      section: 'A',
      year: 2026,
      father_name: 'Karim',
      father_phone: '01711111111',
      mother_phone: '',
      district: 'Rangpur',
      religion: 'Islam',
      dob: '2011-02-03T00:00:00.000Z',
      has_stipend: true,
      available: false,
    });
    assert.equal(p.class, 9);
    assert.equal(p.father_name, 'Karim');
    assert.equal(p.mother_phone, null);
    assert.equal(p.dob, '2011-02-03');
    assert.equal(p.has_stipend, true);
    assert.equal(p.available, false);
    assert.equal(p.village, null);
  });
});
