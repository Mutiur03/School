import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttendanceStudent } from '@/lib/api/attendance';
import {
  applyToggle,
  attendanceSmsEstimate,
  buildMaps,
  buildSavePayload,
  dayStats,
  parseStoredClass,
  setAll,
} from './model';

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

describe('attendance sms estimate', () => {
  const settings = {
    is_active: true,
    send_to_present: false,
    send_to_absent: true,
    send_to_run_awayed: true,
    present_template: 'P {student_name}',
    absent_template: 'A {student_name}',
    run_awayed_template: 'R {student_name}',
    sms_balance: 5,
    school_name: 'X',
  };
  const seg = (t: string) => t.length;
  const mark18 = { ...saved };

  it('counts unmarked-as-absent, skips sent, inactive and no-phone students', () => {
    // day 18 saved: s1 present (not texted), s3 run-awayed (texted). s2 unmarked = absent.
    const sent = { '3-18': true };
    const r = attendanceSmsEstimate(students, {}, mark18, sent, settings, '2026-10-18', 18, seg);
    // s1 present -> not wanted; s2 absent -> "A S2" (4); s3 sent; s4 inactive.
    assert.deepEqual(r, { count: 1, cost: 4 });
    const noPhone = [{ ...st(2), has_phone: false }];
    assert.equal(
      attendanceSmsEstimate(noPhone, {}, {}, {}, settings, '2026-10-18', 18, seg).count,
      0,
    );
    assert.equal(
      attendanceSmsEstimate(
        students,
        {},
        mark18,
        {},
        { ...settings, is_active: false },
        '2026-10-18',
        18,
        seg,
      ).cost,
      0,
    );
  });
  it('follows unsaved edits', () => {
    const edits = { '1-18': 'absent' as const };
    const r = attendanceSmsEstimate(
      students,
      edits,
      mark18,
      { '3-18': true },
      settings,
      '2026-10-18',
      18,
      seg,
    );
    assert.equal(r.count, 2);
  });
  it('parses the remembered class', () => {
    assert.equal(parseStoredClass('9'), 9);
    assert.equal(parseStoredClass('5'), null);
    assert.equal(parseStoredClass(null), null);
  });
});
