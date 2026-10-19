import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import {
  createDashboardApi,
  DASHBOARD_PATHS,
  latestAttendance,
  parseAttendanceSeries,
  parseDashboardOverview,
  sortExams,
} from './dashboard';
import { ApiError } from './errors';

const overviewBody = {
  quickStats: { students: 412, teachers: 23, events: 2 },
  announcements: [
    {
      id: 5,
      title: 'Exam routine',
      content: 'No details available',
      date: '2026-10-10T00:00:00.000Z',
      url: 'notices/a.pdf',
    },
    { id: 6, title: 'Holiday', date: '2026-10-01', url: null },
  ],
  events: [{ id: 1, title: 'Science fair', date: '2026-10-28', location: '' }],
  examSchedule: [
    { name: 'Done', start_date: '2026-01-01', end_date: '2026-01-05' },
    { name: 'Later', start_date: '2026-12-01', end_date: '2026-12-05' },
    { name: 'Now', start_date: '2026-10-10', end_date: '2026-10-25' },
  ],
};

describe('dashboard api', () => {
  it('maps the overview, tolerating nulls and empty strings', () => {
    const o = parseDashboardOverview(overviewBody);
    assert.deepEqual(o.quickStats, { students: 412, teachers: 23, events: 2 });
    assert.equal(o.announcements[0]!.url, 'notices/a.pdf');
    assert.equal(o.announcements[1]!.url, null);
    assert.equal(o.events[0]!.location, null);
    assert.equal(o.examSchedule.length, 3);
  });
  it('defaults missing lists to empty and rejects a missing quickStats', () => {
    const o = parseDashboardOverview({ quickStats: {} });
    assert.deepEqual(o.quickStats, { students: 0, teachers: 0, events: 0 });
    assert.deepEqual(o.events, []);
    assert.throws(() => parseDashboardOverview({}), ApiError);
    assert.throws(() => parseDashboardOverview(null), ApiError);
  });
  it('maps the attendance series and rejects non-arrays', () => {
    const s = parseAttendanceSeries([
      { name: '18 Oct', present: 9, absent: 1, sort_date: '2026-10-18' },
    ]);
    assert.deepEqual(s[0], {
      name: '18 Oct',
      present: 9,
      absent: 1,
      run_awayed: 0,
      sort_date: '2026-10-18',
    });
    assert.throws(() => parseAttendanceSeries({}), ApiError);
  });
  it('orders exams Ongoing, Upcoming, Completed', () => {
    const now = new Date('2026-10-19T00:00:00Z');
    const sorted = sortExams(parseDashboardOverview(overviewBody).examSchedule, now);
    assert.deepEqual(
      sorted.map((e) => [e.name, e.status]),
      [
        ['Now', 'Ongoing'],
        ['Later', 'Upcoming'],
        ['Done', 'Completed'],
      ],
    );
  });
  it('computes the latest attendance rate like the web KPI', () => {
    assert.equal(latestAttendance([]), null);
    const r = latestAttendance(
      parseAttendanceSeries([
        { name: 'a', present: 1, absent: 1, run_awayed: 0 },
        { name: 'b', present: 3, absent: 1, run_awayed: 0 },
      ]),
    )!;
    assert.equal(r.rate, 75);
    assert.equal(r.total, 4);
    assert.equal(r.latest.name, 'b');
    assert.equal(latestAttendance(parseAttendanceSeries([{ name: 'z' }]))!.rate, null);
  });
  it('calls the web dashboard endpoints with attendanceDays; no school id', async () => {
    const urls: string[] = [];
    const api = createDashboardApi(
      createApiClient({
        baseUrl: 'https://s.test',
        fetch: (async (url: RequestInfo | URL) => {
          urls.push(String(url));
          const data = String(url).includes('attendance') ? [] : overviewBody;
          return new Response(
            JSON.stringify({ statusCode: 200, success: true, message: 'ok', data }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }) as typeof fetch,
      }),
    );
    assert.equal((await api.overview()).quickStats.students, 412);
    assert.deepEqual(await api.attendance(15), []);
    assert.equal(new URL(urls[0]!).pathname, DASHBOARD_PATHS.overview);
    const a = new URL(urls[1]!);
    assert.equal(a.pathname, DASHBOARD_PATHS.attendance);
    assert.equal(a.searchParams.get('attendanceDays'), '15');
    assert.equal(a.searchParams.has('school_id'), false);
  });
});
