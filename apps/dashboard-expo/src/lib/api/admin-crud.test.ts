/**
 * Admin CRUD clients (students, teachers, holidays, notices, events, subjects): exact paths,
 * methods and bodies as verified against server/ routes + controllers, and that no school id is
 * ever sent (the server derives it from host + token).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { createEventsApi, parseEvents } from './events';
import { createHolidaysApi, holidayBody, parseHolidays } from './holidays';
import { createNoticesApi, isPdf } from './notices';
import { createStudentsApi, readCreatedCounts } from './students';
import { createSubjectsApi, orderSubjects, parseSubjects, type Subject } from './subjects';
import { createTeachersApi, parseTeacherList } from './teachers';
import { parsePresigned, type PickedFile } from './uploads';

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

const ok = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ statusCode: status, success: true, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

function harness(respond: (c: Call, i: number) => Response = () => ok(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
      headers: (init?.headers as Record<string, string>) ?? {},
    };
    calls.push(call);
    return respond(call, calls.length - 1);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: {
      getAccessToken: () => 'tok',
      refresh: async () => false,
      onSessionExpired: () => {},
    },
  });
  return { calls, client, fetchImpl };
}

const path = (c: Call) => new URL(c.url).pathname;
const noSchoolId = (calls: Call[]) => {
  for (const c of calls) {
    assert.equal(new URL(c.url).searchParams.has('school_id'), false);
    if (c.body && typeof c.body === 'object')
      assert.equal('school_id' in (c.body as object), false);
  }
};

const pdf: PickedFile = {
  name: 'notice.pdf',
  type: 'application/pdf',
  size: 3,
  body: new Blob(['%PDF']),
};

describe('students (admin)', () => {
  it('sends class/section filters as comma lists', async () => {
    const h = harness(() => ok({ data: [], meta: { total: 0 } }));
    await createStudentsApi(h.client).list({ year: 2026, levels: [9, 10], sections: ['A'] });
    const u = new URL(h.calls[0]!.url);
    assert.equal(u.searchParams.get('levels'), '9,10');
    assert.equal(u.searchParams.get('sections'), 'A');
    noSchoolId(h.calls);
  });

  it('adds one student as a one-row bulk upload and returns the login sheet + counts', async () => {
    const h = harness(
      () =>
        new Response(new Uint8Array([0x50, 0x4b, 3, 4]), {
          status: 201,
          headers: {
            'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'X-Students-Created': '1',
            'X-Students-Requested': '1',
          },
        }),
    );
    const r = await createStudentsApi(h.client).create({
      name: 'Ayesha',
      father_name: 'Abdur',
      mother_name: 'Rokeya',
      father_phone: '01711111111',
      mother_phone: null,
      village: '',
      post_office: '',
      upazila: '',
      district: '',
      dob: '2012-01-05',
      religion: 'Islam',
      available: true,
      has_stipend: false,
      roll: '4',
      class: '9',
      section: 'A',
      group: 'Science',
    });
    const c = h.calls[0]!;
    assert.equal(c.method, 'POST');
    assert.equal(path(c), '/api/students/bulk');
    const body = c.body as { students: Record<string, unknown>[] };
    assert.equal(body.students.length, 1);
    assert.equal(body.students[0]!.class, '9');
    assert.equal(r.created, 1);
    assert.equal(new Uint8Array(r.credentials)[0], 0x50);
    noSchoolId(h.calls);
  });

  it('defaults counts when headers are missing; reads partial adds', () => {
    assert.deepEqual(readCreatedCounts(null), { created: 1, requested: 1 });
    const h = new Headers({ 'X-Students-Created': '0', 'X-Students-Requested': '1' });
    assert.deepEqual(readCreatedCounts(h), { created: 0, requested: 1 });
  });

  it('edits with PUT /students/:id then PATCH /enrollments/:enrollment_id', async () => {
    const h = harness();
    const personal = {
      name: 'A',
      father_name: 'B',
      mother_name: 'C',
      father_phone: '01711111111',
      mother_phone: null,
      village: '',
      post_office: '',
      upazila: '',
      district: '',
      dob: '2012-01-05',
      religion: 'Islam',
      available: true,
      has_stipend: true,
    };
    await createStudentsApi(h.client).update({ id: 7, enrollment_id: 70 }, personal, {
      roll: '1',
      class: '8',
      section: 'B',
      group: '',
    });
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['PUT', '/api/students/7'],
        ['PATCH', '/api/enrollments/70'],
      ],
    );
    assert.equal((h.calls[1]!.body as { section: string }).section, 'B');
  });

  it('deletes by student id', async () => {
    const h = harness();
    await createStudentsApi(h.client).remove(9);
    assert.deepEqual([h.calls[0]!.method, path(h.calls[0]!)], ['DELETE', '/api/students/9']);
  });
});

describe('teachers', () => {
  it('parses the paginated list', () => {
    const r = parseTeacherList({
      data: [{ id: 1, name: 'Rina', email: 'r@x.com', phone: '01700000000', designation: null }],
      meta: { total: 12, page: 2, limit: 10, totalPages: 2 },
    });
    assert.equal(r.rows[0]!.designation, null);
    assert.equal(r.meta.totalPages, 2);
    assert.throws(() => parseTeacherList({ data: 'x' }), ApiError);
  });

  it('creates with { teachers: [input] }, updates with PUT, deletes with DELETE', async () => {
    const h = harness((c) =>
      c.method === 'POST'
        ? ok({ teachers: [{ id: 5, name: 'Rina', email: 'r@x.com', phone: '1' }] }, 201)
        : ok(null),
    );
    const api = createTeachersApi(h.client);
    const input = {
      name: 'Rina',
      email: 'r@x.com',
      phone: '01700000000',
      designation: 'AT',
      address: 'Dhaka',
    };
    const created = await api.create(input);
    await api.update(5, input);
    await api.remove(5);
    assert.equal(created?.id, 5);
    assert.deepEqual(h.calls[0]!.body, { teachers: [input] });
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['POST', '/api/teachers'],
        ['PUT', '/api/teachers/5'],
        ['DELETE', '/api/teachers/5'],
      ],
    );
    noSchoolId(h.calls);
  });

  it('sends page/limit/search', async () => {
    const h = harness(() => ok({ data: [], meta: {} }));
    await createTeachersApi(h.client).list({ page: 3, search: ' rin ' });
    const u = new URL(h.calls[0]!.url);
    assert.equal(u.searchParams.get('page'), '3');
    assert.equal(u.searchParams.get('limit'), '50');
    assert.equal(u.searchParams.get('search'), 'rin');
  });
});

describe('holidays (Nest, forbidNonWhitelisted)', () => {
  it('parses dates to YYYY-MM-DD and defaults end to start', () => {
    const [h] = parseHolidays([
      {
        id: 1,
        title: 'Eid',
        start_date: '2026-03-30T00:00:00.000Z',
        end_date: null,
        is_optional: true,
      },
    ]);
    assert.equal(h!.start_date, '2026-03-30');
    assert.equal(h!.end_date, '2026-03-30');
    assert.equal(h!.is_optional, true);
  });

  it('only sends the DTO keys', async () => {
    const h = harness();
    const api = createHolidaysApi(h.client);
    const input = {
      title: ' Eid ',
      start_date: '2026-03-30',
      end_date: '2026-04-01',
      description: '',
      is_optional: false,
    };
    await api.create({ ...input, school_id: 3 } as never);
    await api.update(4, input);
    assert.deepEqual(Object.keys(h.calls[0]!.body as object).sort(), [
      'description',
      'end_date',
      'is_optional',
      'start_date',
      'title',
    ]);
    assert.equal((h.calls[0]!.body as { title: string }).title, 'Eid');
    assert.deepEqual([h.calls[1]!.method, path(h.calls[1]!)], ['PATCH', '/api/holidays/4']);
    assert.deepEqual(holidayBody(input).title, 'Eid');
  });
});

describe('uploads + notices', () => {
  it('rejects a malformed presign response', () => {
    assert.throws(() => parsePresigned({ uploadUrl: 'x' }, '/p'), ApiError);
    assert.deepEqual(parsePresigned({ uploadUrl: 'u', key: 'k' }, '/p'), {
      uploadUrl: 'u',
      key: 'k',
    });
  });

  it('presigns, PUTs the PDF to storage without credentials, then saves the key', async () => {
    const h = harness((c) =>
      path(c) === '/api/notices/presigned-url'
        ? ok({ uploadUrl: 'https://r2.test/put?sig=1', key: 'schools/3/notices/a.pdf' })
        : c.url.startsWith('https://r2.test')
          ? new Response(null, { status: 200 })
          : ok({ id: 1 }, 201),
    );
    await createNoticesApi(h.client, h.fetchImpl).create({
      title: ' Exam ',
      created_at: '',
      file: pdf,
    });
    const [presign, put, save] = h.calls;
    const pu = new URL(presign!.url);
    assert.equal(pu.searchParams.get('filename'), 'notice.pdf');
    assert.equal(pu.searchParams.get('contentType'), 'application/pdf');
    assert.equal(put!.method, 'PUT');
    assert.equal(put!.headers.Authorization, undefined);
    assert.equal(put!.headers['Content-Type'], 'application/pdf');
    assert.deepEqual([save!.method, path(save!)], ['POST', '/api/notices/addNotice']);
    assert.deepEqual(save!.body, { title: 'Exam', key: 'schools/3/notices/a.pdf' });
  });

  it('fails the whole create when the storage PUT fails (no record without a file)', async () => {
    const h = harness((c) =>
      path(c) === '/api/notices/presigned-url'
        ? ok({ uploadUrl: 'https://r2.test/put', key: 'k' })
        : new Response('denied', { status: 403 }),
    );
    await assert.rejects(
      createNoticesApi(h.client, h.fetchImpl).create({ title: 'x', created_at: '', file: pdf }),
      ApiError,
    );
    assert.equal(h.calls.length, 2);
  });

  it('requires a PDF to create; edit without a file keeps the current one', async () => {
    const h = harness();
    const api = createNoticesApi(h.client, h.fetchImpl);
    await assert.rejects(api.create({ title: 'x', created_at: '', file: null }), ApiError);
    await assert.rejects(
      api.create({
        title: 'x',
        created_at: '',
        file: { ...pdf, name: 'a.png', type: 'image/png' },
      }),
      ApiError,
    );
    await api.update(8, { title: 'New', created_at: '2026-04-01', file: null });
    assert.equal(h.calls.length, 1);
    assert.deepEqual(
      [h.calls[0]!.method, path(h.calls[0]!)],
      ['PUT', '/api/notices/updateNotice/8'],
    );
    assert.deepEqual(h.calls[0]!.body, { title: 'New', created_at: '2026-04-01' });
    assert.equal(isPdf({ name: 'X.PDF', type: '' }), true);
  });
});

describe('events', () => {
  it('parses dates and optional media', () => {
    const [e] = parseEvents([{ id: 2, title: 'Sports', date: '2026-05-01', image: '', file: 'k' }]);
    assert.equal(e!.image, null);
    assert.equal(e!.file, 'k');
  });

  it('creates without files; uploads an image with type=image and sends imageKey', async () => {
    const h = harness((c) =>
      path(c) === '/api/events/presigned-url'
        ? ok({ uploadUrl: 'https://r2.test/u', key: 'img-key' })
        : c.url.startsWith('https://r2.test')
          ? new Response(null, { status: 200 })
          : ok(null),
    );
    const api = createEventsApi(h.client, h.fetchImpl);
    const base = {
      title: 'Sports',
      date: '2026-05-01',
      details: '',
      location: 'Field',
      image: null,
      file: null,
    };
    await api.create(base);
    assert.deepEqual(h.calls[0]!.body, {
      title: 'Sports',
      date: '2026-05-01',
      details: '',
      location: 'Field',
    });
    await api.update(3, { ...base, image: { ...pdf, name: 'a.jpg', type: 'image/jpeg' } });
    const presign = new URL(h.calls[1]!.url);
    assert.equal(presign.searchParams.get('type'), 'image');
    const save = h.calls[3]!;
    assert.deepEqual([save.method, path(save)], ['PUT', '/api/events/updateEvent/3']);
    assert.equal((save.body as { imageKey: string }).imageKey, 'img-key');
    assert.equal('fileKey' in (save.body as object), false);
  });
});

describe('subjects', () => {
  const sub = (p: Partial<Subject>): Record<string, unknown> => ({
    id: 1,
    name: 'X',
    class: 9,
    year: 2026,
    subject_type: 'single',
    priority: 0,
    ...p,
  });

  it('parses and falls back on unknown enums', () => {
    const [s] = parseSubjects([sub({ subject_type: 'weird' as never, parent_id: null })]);
    assert.equal(s!.subject_type, 'single');
    assert.equal(s!.marking_scheme, 'TOTAL');
    assert.equal(s!.parent_id, null);
  });

  it('orders by class, priority, type and puts papers under their main subject', () => {
    const list = parseSubjects([
      sub({ id: 1, name: 'Bangla', subject_type: 'main', priority: 1 }),
      sub({ id: 2, name: 'Bangla 2nd', subject_type: 'paper', parent_id: 1, priority: 2 }),
      sub({ id: 3, name: 'Bangla 1st', subject_type: 'paper', parent_id: 1, priority: 1 }),
      sub({ id: 4, name: 'Math', priority: 0 }),
      sub({ id: 5, name: 'Art', class: 6, priority: 9 }),
    ]);
    assert.deepEqual(
      orderSubjects(list).map((s) => s.id),
      [5, 4, 1, 3, 2],
    );
  });

  it('strips id on create, sends old_parent_id on update', async () => {
    const h = harness();
    const api = createSubjectsApi(h.client);
    const [s] = parseSubjects([sub({ id: 9, subject_type: 'paper', parent_id: 4 })]);
    await api.create({ ...s!, id: 9 });
    await api.update(9, s!, 4);
    await api.clone(2025, 2026);
    const created = (h.calls[0]!.body as { subjects: Record<string, unknown>[] }).subjects[0]!;
    assert.equal('id' in created, false);
    assert.deepEqual([h.calls[1]!.method, path(h.calls[1]!)], ['PUT', '/api/sub/updateSubject/9']);
    assert.equal((h.calls[1]!.body as { old_parent_id: number }).old_parent_id, 4);
    assert.deepEqual(h.calls[2]!.body, { fromYear: 2025, toYear: 2026 });
  });
});

describe('client onHeaders', () => {
  it('passes the response headers of a successful request', async () => {
    let seen: string | null = null;
    const h = harness(() => ok(1, 200, { 'X-Test': 'yes' }));
    await h.client.get('/api/x', { onHeaders: (hd) => (seen = hd.get('X-Test')) });
    assert.equal(seen, 'yes');
  });
});
