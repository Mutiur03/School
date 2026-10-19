import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttendanceStudent } from '@/lib/api/attendance';
import { applyToggle, buildMaps, buildSavePayload, dayStats, setAll } from './model';

const st = (id: number, available = true): AttendanceStudent => ({
  id,
  name: `S${id}`,
  class: 9,
  section: 'A',
  roll: id,
  enrollment_id: id,
  login_id: String(1000 + id),
  available,
  has_phone: true,
});
const students = [st(1), st(2), st(3), st(4, false)];
const { attendance: saved } = buildMaps(
  [
    { id: 1, student_id: 1, date: '2026-10-18', status: 'present', send_msg: false },
    { id: 2, student_id: 3, date: '2026-10-18', status: 'run-awayed', send_msg: true },
    { id: 3, student_id: 2, date: '2026-09-30', status: 'present', send_msg: false },
  ],
  2026,
  9,
);

describe('attendance model', () => {
  it('maps only the selected month', () => {
    assert.deepEqual(saved, { '1-18': 'present', '3-18': 'run-awayed' });
  });
  it('drops edits that equal the saved value and never touches run-awayed', () => {
    let e = applyToggle({}, saved, 2, 18, true);
    assert.deepEqual(e, { '2-18': 'present' });
    e = applyToggle(e, saved, 2, 18, false);
    assert.deepEqual(e, {});
    assert.deepEqual(applyToggle({}, saved, 3, 18, true), {});
    assert.deepEqual(applyToggle({}, saved, 1, 18, false), { '1-18': 'absent' });
  });
  it('counts unmarked separately and skips inactive students', () => {
    assert.deepEqual(dayStats(students, {}, saved, 18), {
      total: 3,
      present: 1,
      absent: 0,
      runAwayed: 1,
      notMarked: 1,
    });
  });
  it('mark-all skips run-awayed and inactive', () => {
    assert.deepEqual(setAll(students, {}, saved, 18, true), { '2-18': 'present' });
  });
  it('saves every student, unmarked as absent, keeping run-awayed', () => {
    const p = buildSavePayload(students, { '2-18': 'present' }, saved, {
      year: 2026,
      month: 9,
      day: 18,
      level: 9,
      section: 'A',
    });
    assert.equal(p.date, '2026-10-18');
    assert.deepEqual(
      p.records.map((r) => r.status),
      ['present', 'present', 'run-awayed', 'absent'],
    );
    assert.ok(!('school_id' in p));
  });
});
