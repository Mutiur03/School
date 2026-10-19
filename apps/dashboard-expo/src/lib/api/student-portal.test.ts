import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import {
  createStudentPortalApi,
  parseMarks,
  parsePublishedExams,
  parseStudentAttendance,
  STUDENT_PORTAL_PATHS,
  totalMarks,
} from './student-portal';

describe('student portal api', () => {
  it('keeps only published exams of the session, sorted like the web page', () => {
    const r = parsePublishedExams(
      [
        { id: 3, exam_name: 'Final', exam_year: 2026, visible: true, start_date: '2026-11-01' },
        {
          id: 1,
          exam_name: 'Half',
          exam_year: 2026,
          visible: true,
          start_date: '2026-06-01T00:00:00Z',
        },
        { id: 2, exam_name: 'Draft', exam_year: 2026, visible: false, start_date: '2026-07-01' },
        { id: 4, exam_name: 'Old', exam_year: 2025, visible: true },
      ],
      2026,
    );
    assert.deepEqual(
      r.map((e) => e.exam_name),
      ['Half', 'Final'],
    );
  });
  it('sorts marks by subject and totals nulls as 0', () => {
    const rows = parseMarks([
      { subject: 'Math', marks: 80 },
      { subject: 'Bangla', marks: null },
      { subject: 'English', marks: '70' },
    ]);
    assert.deepEqual(
      rows.map((r) => r.subject),
      ['Bangla', 'English', 'Math'],
    );
    assert.equal(totalMarks(rows), 150);
  });
  it('normalises attendance statuses', () => {
    const a = parseStudentAttendance({
      records: [{ id: 1, date: '2026-10-15', status: ' Run-Awayed ' }],
      stats: { present: 0, absent: 0, runAwayed: 1, total: 1, attendanceRate: 0 },
    });
    assert.equal(a.records[0]!.status, 'run-awayed');
    assert.equal(a.stats.attendanceRate, 0);
  });
  it('uses /me endpoints and never sends a school id', async () => {
    const urls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://x',
      fetch: (async (url: string) => {
        urls.push(String(url));
        const data = String(url).includes('attendance')
          ? { records: [], stats: {} }
          : { id: 5, name: 'A', class: 9, section: 'A', roll: 1 };
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const api = createStudentPortalApi(client);
    await api.me(2026);
    await api.attendance({ month: 9, year: 2026 });
    assert.ok(urls[0]!.startsWith(`http://x${STUDENT_PORTAL_PATHS.me}?`));
    assert.ok(urls[1]!.startsWith(`http://x${STUDENT_PORTAL_PATHS.attendance}?`));
    assert.ok(!urls.some((u) => /school/i.test(u)));
  });
});

describe('marksheet bytes', () => {
  it('sends the token as a header (never in the URL), refreshes once on 401, returns bytes', async () => {
    const calls: { url: string; auth: string | null; tenant: string | null }[] = [];
    let token = 'old';
    const client = createApiClient({
      baseUrl: 'http://x',
      defaultHeaders: () => ({ 'x-tenant-host': 'alpha.localhost' }),
      auth: {
        getAccessToken: () => token,
        refresh: async () => {
          token = 'new';
          return true;
        },
        onSessionExpired: () => {},
      },
      fetch: (async (url: string, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        calls.push({
          url: String(url),
          auth: h.get('authorization'),
          tenant: h.get('x-tenant-host'),
        });
        if (h.get('authorization') === 'Bearer old') {
          return new Response(JSON.stringify({ success: false, message: 'expired' }), {
            status: 401,
          });
        }
        return new Response(new TextEncoder().encode('%PDF-1.7'), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        });
      }) as typeof fetch,
    });
    const api = createStudentPortalApi(client);
    const buf = await api.marksheetBytes({ studentId: 8, year: 2026, exam: 'Half Yearly' });
    assert.equal(new TextDecoder().decode(buf), '%PDF-1.7');
    assert.deepEqual(
      calls.map((c) => c.auth),
      ['Bearer old', 'Bearer new'],
    );
    assert.ok(calls.every((c) => c.tenant === 'alpha.localhost'));
    assert.ok(calls.every((c) => !/token|bearer|old|new/i.test(c.url)));
    assert.ok(calls[0]!.url.startsWith('http://x/api/marksheets/students/8?'));
  });
  it('throws the server message for an error response (nothing to save)', async () => {
    const client = createApiClient({
      baseUrl: 'http://x',
      fetch: (async () =>
        new Response(
          JSON.stringify({ success: false, message: 'This result has not been published yet' }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch,
    });
    await assert.rejects(
      createStudentPortalApi(client).marksheetBytes({ studentId: 8, year: 2026, exam: 'Annual' }),
      /not been published/,
    );
  });
});
