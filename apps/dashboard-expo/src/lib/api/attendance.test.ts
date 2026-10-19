import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ATTENDANCE_PATHS, createAttendanceApi, parseRecords, parseStats } from './attendance';

describe('attendance api', () => {
  it('normalises records and drops unknown statuses', () => {
    const r = parseRecords([
      {
        id: 1,
        student_id: 2,
        date: '2026-10-18',
        status: 'run-awayed ',
        send_msg: true,
        school_id: 9,
      },
      { id: 2, student_id: 2, date: '2026-10-17', status: 'late' },
    ]);
    assert.deepEqual(r, [
      { id: 1, student_id: 2, date: '2026-10-18', status: 'run-awayed', send_msg: true },
    ]);
  });
  it('defaults missing stats', () => {
    assert.deepEqual(parseStats({ present: 2 }), {
      present: 2,
      absent: 0,
      runAwayed: 0,
      sms: { successful: 0, failed: 0, pending: 0 },
    });
  });
  it('calls the existing endpoints without a school id', async () => {
    const calls: { url: string; body?: string }[] = [];
    const client = createApiClient({
      baseUrl: 'http://x',
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), body: init?.body as string | undefined });
        const data = String(url).includes('save-and-send')
          ? { processed: 1, present: 1, absent: 0, smsError: 'SMS off' }
          : [];
        return new Response(JSON.stringify({ success: true, statusCode: 200, data }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const api = createAttendanceApi(client);
    await api.records({ year: 2026, month: 9, level: 9, section: 'A' });
    const res = await api.saveAndSend({
      date: '2026-10-18',
      level: 9,
      section: 'A',
      year: 2026,
      records: [{ studentId: 1, date: '2026-10-18', status: 'present' }],
    });
    assert.ok(calls[0]!.url.startsWith(`http://x${ATTENDANCE_PATHS.records}?`));
    assert.ok(calls[0]!.url.includes('month=9'));
    assert.ok(calls[1]!.url.endsWith(ATTENDANCE_PATHS.saveAndSend));
    assert.ok(!calls.some((c) => /school/i.test(c.url + (c.body ?? ''))));
    assert.equal(res.smsError, 'SMS off');
  });
});
