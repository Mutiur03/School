/**
 * Upload paths added with the native build: exam routine PDF, student photo, teacher photo /
 * signature from the admin form, spreadsheet bulk creates. Exact paths, bodies, storage PUT
 * without credentials, and never a school id.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { createExamsApi } from './exams';
import { createStudentsApi } from './students';
import { createSubjectsApi } from './subjects';
import { createTeacherSelfApi } from './teacher-self';
import type { PickedFile } from './uploads';

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };
const ok = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ statusCode: 200, success: true, message: 'ok', data }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
function harness(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const c: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
      headers: (init?.headers as Record<string, string>) ?? {},
    };
    calls.push(c);
    return respond(c);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
  });
  return { calls, client, fetchImpl };
}
const path = (c: Call) => (c.url.startsWith('https://r2.test') ? 'R2' : new URL(c.url).pathname);
const trail = (calls: Call[]) => calls.map((c) => `${c.method} ${path(c)}`);
const noSchoolId = (calls: Call[]) =>
  calls.forEach((c) => {
    if (c.url.startsWith('https://s.test'))
      assert.equal(new URL(c.url).searchParams.has('school_id'), false);
    if (c.body && typeof c.body === 'object' && !(c.body instanceof Blob))
      assert.equal('school_id' in (c.body as object), false);
  });
const file = (name: string, type: string): PickedFile => ({
  name,
  type,
  size: 3,
  body: new Blob(['abc'], { type }),
});

describe('exam routine PDF', () => {
  it('presigns with filename + contentType, PUTs to storage, saves the key', async () => {
    const h = harness((c) =>
      path(c) === '/api/exams/presigned-url'
        ? ok({ uploadUrl: 'https://r2.test/put', key: 'schools/3/routines/r.pdf' })
        : path(c) === 'R2'
          ? new Response(null, { status: 200 })
          : ok({ id: 9 }),
    );
    await createExamsApi(h.client).uploadRoutine(
      9,
      file('Routine.pdf', 'application/pdf'),
      h.fetchImpl,
    );
    assert.deepEqual(trail(h.calls), [
      'GET /api/exams/presigned-url',
      'PUT R2',
      'POST /api/exams/uploadRoutinePDF/9',
    ]);
    const q = new URL(h.calls[0]!.url).searchParams;
    assert.equal(q.get('filename'), 'Routine.pdf');
    assert.equal(q.get('contentType'), 'application/pdf');
    assert.equal(h.calls[1]!.headers.Authorization, undefined);
    assert.deepEqual(h.calls[2]!.body, { key: 'schools/3/routines/r.pdf' });
    noSchoolId(h.calls);
  });

  it('refuses a non-PDF before any request and removes with DELETE', async () => {
    const h = harness(() => ok(null));
    await assert.rejects(
      createExamsApi(h.client).uploadRoutine(9, file('a.png', 'image/png')),
      /PDF/,
    );
    assert.equal(h.calls.length, 0);
    await createExamsApi(h.client).removeRoutine(9);
    assert.deepEqual(trail(h.calls), ['DELETE /api/exams/removeRoutinePDF/9']);
  });
});

describe('student photo', () => {
  it('asks for an upload URL for this student, PUTs, then saves the key', async () => {
    const h = harness((c) =>
      path(c) === '/api/students/5/image/upload-url'
        ? ok({ uploadUrl: 'https://r2.test/p', key: 'schools/3/students/5.jpg' })
        : path(c) === 'R2'
          ? new Response(null, { status: 200 })
          : ok(null),
    );
    const key = await createStudentsApi(h.client).uploadImage(
      5,
      file('my photo.jpg', 'image/jpeg'),
      h.fetchImpl,
    );
    assert.equal(key, 'schools/3/students/5.jpg');
    assert.deepEqual(trail(h.calls), [
      'POST /api/students/5/image/upload-url',
      'PUT R2',
      'PUT /api/students/5/image',
    ]);
    const presign = h.calls[0]!.body as { key: string; contentType: string };
    assert.match(presign.key, /^\d+-my-photo\.jpg$/);
    assert.equal(presign.contentType, 'image/jpeg');
    assert.deepEqual(h.calls[2]!.body, { key: 'schools/3/students/5.jpg' });
    noSchoolId(h.calls);
  });

  it('removes with key null and refuses a non-image', async () => {
    const h = harness(() => ok(null));
    await createStudentsApi(h.client).removeImage(5);
    assert.deepEqual(h.calls[0]!.body, { key: null });
    await assert.rejects(
      createStudentsApi(h.client).uploadImage(5, file('a.pdf', 'application/pdf')),
      /image/,
    );
    assert.equal(h.calls.length, 1);
  });
});

describe('bulk creates from a spreadsheet', () => {
  it('sends every student in one /bulk request and reads the created counts', async () => {
    const h = harness(
      () =>
        new Response(new Uint8Array([80, 75]), {
          status: 201,
          headers: { 'X-Students-Created': '2', 'X-Students-Requested': '3' },
        }),
    );
    const row = { name: 'A' } as never;
    const r = await createStudentsApi(h.client).createMany([row, row, row]);
    assert.deepEqual(trail(h.calls), ['POST /api/students/bulk']);
    assert.equal((h.calls[0]!.body as { students: unknown[] }).students.length, 3);
    assert.deepEqual([r.created, r.requested], [2, 3]);
  });

  it('sends every subject in one addSubject request', async () => {
    const h = harness(() => ok(null));
    await createSubjectsApi(h.client).createMany([{ name: 'A' }, { name: 'B' }]);
    assert.deepEqual(trail(h.calls), ['POST /api/sub/addSubject']);
    assert.deepEqual(h.calls[0]!.body, { subjects: [{ name: 'A' }, { name: 'B' }] });
  });
});

describe('teacher photo from the admin form', () => {
  it('removes a photo with DELETE /api/teachers/:id/image', async () => {
    const h = harness(() => ok(null));
    await createTeacherSelfApi(h.client).removeImage(7);
    assert.deepEqual(trail(h.calls), ['DELETE /api/teachers/7/image']);
  });
});
