import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ATTENDANCE_PATHS, createAttendanceApi, parseOverview, parseSmsPublic } from './attendance';
import { createApiClient } from './client';
import { isApiError } from './errors';
import {
  checkTeacherFile,
  createTeacherSelfApi,
  TEACHER_SELF_PATHS,
  teacherFileKey,
} from './teacher-self';
import type { PickedFile } from './uploads';

type Call = { url: string; method: string; body: unknown };

function harness(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const call: Call = {
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
  return { calls, client, fetchImpl };
}
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ statusCode: status, success: true, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ statusCode: status, success: false, message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const pathOf = (c: Call) => new URL(c.url).pathname;
const png: PickedFile = { name: 'Me.PNG', type: 'image/png', size: 1000, body: new Blob(['x']) };

describe('teacher self api', () => {
  it('changes the password with exactly the web body', async () => {
    const h = harness(() => ok(null));
    await createTeacherSelfApi(h.client).changePassword({
      currentPassword: 'a',
      newPassword: 'B1!bbbbb',
    });
    assert.equal(h.calls[0]!.method, 'POST');
    assert.equal(pathOf(h.calls[0]!), '/api/teachers/change-password');
    assert.deepEqual(h.calls[0]!.body, { currentPassword: 'a', newPassword: 'B1!bbbbb' });
  });

  it('surfaces the server message for a wrong current password', async () => {
    const h = harness(() => fail(400, 'Current password is incorrect'));
    await assert.rejects(
      createTeacherSelfApi(h.client).changePassword({ currentPassword: 'x', newPassword: 'y' }),
      (e: unknown) => isApiError(e) && e.message === 'Current password is incorrect',
    );
  });

  it('uploads a photo: presign (own id), PUT to storage, save the signed key', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : pathOf(c) === TEACHER_SELF_PATHS.imageUploadUrl
          ? ok({ uploadUrl: 'https://r2.test/put?sig=1', key: 'school-3/teachers/7-1.png' })
          : ok({ id: 7 }),
    );
    const key = await createTeacherSelfApi(h.client, h.fetchImpl).uploadFile('image', 7, png);
    assert.equal(key, 'school-3/teachers/7-1.png');
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${c.url.startsWith('https://r2.test') ? 'R2' : pathOf(c)}`),
      ['POST /api/teachers/image/upload-url', 'PUT R2', 'PUT /api/teachers/7/image'],
    );
    const presign = h.calls[0]!.body as Record<string, unknown>;
    assert.equal(presign.id, 7);
    assert.equal(presign.contentType, 'image/png');
    assert.match(String(presign.key), /^7-\d+\.png$/);
    assert.deepEqual(h.calls[2]!.body, { key: 'school-3/teachers/7-1.png' });
    for (const c of h.calls) {
      if (c.body && typeof c.body === 'object' && !(c.body instanceof Blob))
        assert.equal('school_id' in (c.body as object), false);
    }
  });

  it('uploads and removes a signature on the signature routes', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 200 })
        : pathOf(c) === TEACHER_SELF_PATHS.signatureUploadUrl
          ? ok({ uploadUrl: 'https://r2.test/s', key: 'school-3/signatures/7-x.png' })
          : ok(null),
    );
    const api = createTeacherSelfApi(h.client, h.fetchImpl);
    await api.uploadFile('signature', 7, png);
    await api.removeSignature(7);
    assert.deepEqual(
      h.calls.map((c) => `${c.method} ${c.url.startsWith('https://r2.test') ? 'R2' : pathOf(c)}`),
      [
        'POST /api/teachers/signature/upload-url',
        'PUT R2',
        'PUT /api/teachers/7/signature',
        'DELETE /api/teachers/7/signature',
      ],
    );
  });

  it('stops before saving when storage rejects the upload', async () => {
    const h = harness((c) =>
      c.url.startsWith('https://r2.test')
        ? new Response(null, { status: 403 })
        : ok({ uploadUrl: 'https://r2.test/put', key: 'school-3/teachers/k.png' }),
    );
    await assert.rejects(createTeacherSelfApi(h.client, h.fetchImpl).uploadFile('image', 7, png));
    assert.equal(h.calls.length, 2);
  });

  it('applies the web file limits', () => {
    assert.equal(checkTeacherFile('image', { type: 'image/jpeg', size: 2 * 1024 * 1024 }), null);
    assert.equal(
      checkTeacherFile('image', { type: 'image/jpeg', size: 2 * 1024 * 1024 + 1 }),
      'File size must be less than 2MB',
    );
    assert.equal(
      checkTeacherFile('signature', { type: 'image/png', size: 1024 * 1024 + 1 }),
      'File size must be less than 1MB',
    );
    assert.equal(
      checkTeacherFile('image', { type: 'application/pdf', size: 10 }),
      'Please select an image file',
    );
    assert.equal(teacherFileKey('signature', 7, png, 5), '7-signature-5.png');
    assert.equal(teacherFileKey('image', 7, { ...png, name: 'noext' }, 5), '7-5.png');
  });
});

describe('attendance additions for Running away', () => {
  it('parses login ids and the public SMS settings', () => {
    const [s] = parseOverview([
      { id: 1, name: 'A', class: 8, section: 'A', roll: 1, login_id: 260801 },
    ]);
    assert.equal(s!.login_id, '260801');
    assert.equal(parseOverview([{ id: 2 }])[0]!.login_id, '');
    assert.deepEqual(
      parseSmsPublic({
        is_active: 1,
        sms_balance: '12',
        run_awayed_template: 'x',
        school_name: 'D',
      }),
      {
        is_active: true,
        send_to_present: false,
        send_to_absent: false,
        send_to_run_awayed: false,
        present_template: '',
        absent_template: '',
        run_awayed_template: 'x',
        sms_balance: 12,
        school_name: 'D',
      },
    );
  });
  it('reads GET /api/sms-settings/public', async () => {
    const h = harness(() => ok({ is_active: true, send_to_run_awayed: true, sms_balance: 3 }));
    const r = await createAttendanceApi(h.client).smsSettings();
    assert.equal(pathOf(h.calls[0]!), ATTENDANCE_PATHS.smsPublic);
    assert.equal(h.calls[0]!.method, 'GET');
    assert.equal(r.send_to_run_awayed, true);
  });
});
