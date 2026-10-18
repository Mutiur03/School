import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { createStudentsApi, parseStudentList, STUDENT_PATHS } from './students';

const serverBody = {
  statusCode: 200,
  success: true,
  message: 'ok',
  data: {
    data: [
      {
        id: 3,
        enrollment_id: 11,
        name: 'Ayesha',
        father_name: 'Abdur',
        roll: 1,
        class: 9,
        section: 'A',
        available: true,
      },
      {
        id: 4,
        name: 'Rafi',
        father_name: null,
        roll: 2,
        class: 9,
        section: 'B',
        available: false,
        extra: 'x',
      },
    ],
    meta: { total: 40, filtered: 2, page: 1, limit: 50, totalPages: 1 },
  },
};

describe('students api', () => {
  it('parses the legacy list envelope', () => {
    const r = parseStudentList(serverBody.data, { year: 2026 });
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[1]!.available, false);
    assert.equal(r.rows[1]!.father_name, null);
    assert.equal(r.meta.total, 40);
  });
  it('rejects anything that is not a list', () => {
    assert.throws(() => parseStudentList({ data: 'x' }, { year: 2026 }), ApiError);
    assert.throws(() => parseStudentList(null, { year: 2026 }), ApiError);
  });
  it('sends year/page/limit and a trimmed search; no school id', async () => {
    const urls: string[] = [];
    const api = createStudentsApi(
      createApiClient({
        baseUrl: 'https://s.test',
        fetch: (async (url: RequestInfo | URL) => {
          urls.push(String(url));
          return new Response(JSON.stringify(serverBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }) as typeof fetch,
      }),
    );
    await api.list({ year: 2026, page: 2, limit: 25, search: '  ayesha ' });
    await api.list({ year: 2026, search: '   ' });
    const a = new URL(urls[0]!);
    assert.equal(a.pathname, STUDENT_PATHS.list);
    assert.equal(a.searchParams.get('year'), '2026');
    assert.equal(a.searchParams.get('page'), '2');
    assert.equal(a.searchParams.get('limit'), '25');
    assert.equal(a.searchParams.get('search'), 'ayesha');
    assert.equal(a.searchParams.has('school_id'), false);
    assert.equal(new URL(urls[1]!).searchParams.has('search'), false);
  });
});
