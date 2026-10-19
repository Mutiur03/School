import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttendanceStudent, PublicSmsSettings } from '@/lib/api/attendance';
import {
  fillSmsTemplate,
  isLocked,
  morningTaken,
  runAwayPayload,
  smsDate,
  smsEstimate,
  statusOf,
  stayStats,
  todayMaps,
  toggleRunAway,
} from './model';

const TODAY = '2026-10-19';
const st = (id: number, extra: Partial<AttendanceStudent> = {}): AttendanceStudent => ({
  id,
  name: `S${id}`,
  class: 8,
  section: 'A',
  roll: id,
  enrollment_id: 100 + id,
  login_id: `26080${id}`,
  available: true,
  has_phone: true,
  ...extra,
});
// 1 present, 2 absent, 3 run-awayed (texted), 4 present (inactive), 5 no record, 6 present no phone.
const students = [
  st(1),
  st(2),
  st(3),
  st(4, { available: false }),
  st(5),
  st(6, { has_phone: false }),
];
const maps = todayMaps(
  [
    { id: 1, student_id: 1, date: TODAY, status: 'present', send_msg: false },
    { id: 2, student_id: 2, date: TODAY, status: 'absent', send_msg: false },
    { id: 3, student_id: 3, date: TODAY, status: 'run-awayed', send_msg: true },
    { id: 4, student_id: 4, date: TODAY, status: 'present', send_msg: false },
    { id: 5, student_id: 5, date: '2026-10-18', status: 'present', send_msg: false },
    { id: 6, student_id: 6, date: TODAY, status: 'present', send_msg: false },
  ],
  TODAY,
);
const sms: PublicSmsSettings = {
  is_active: true,
  send_to_present: false,
  send_to_absent: true,
  send_to_run_awayed: true,
  present_template: '',
  absent_template: '',
  run_awayed_template:
    '{student_name} ({class}{section}-{roll}, {login_id}) left {school_name} on {date}',
  sms_balance: 10,
  school_name: 'Demo High',
};

describe('running away model', () => {
  it('keeps only today and knows when morning attendance exists', () => {
    assert.deepEqual(maps.saved, {
      1: 'present',
      2: 'absent',
      3: 'run-awayed',
      4: 'present',
      6: 'present',
    });
    assert.equal(maps.sent[3], true);
    assert.equal(morningTaken(students, maps.saved), true);
    assert.equal(morningTaken([st(5)], maps.saved), false);
  });

  it('locks absent, unrecorded and inactive students', () => {
    assert.equal(isLocked(st(1), maps.saved), false);
    assert.equal(isLocked(st(2), maps.saved), true);
    assert.equal(isLocked(st(5), maps.saved), true);
    assert.equal(isLocked(students[3]!, maps.saved), true);
    assert.equal(isLocked(st(3), maps.saved), false); // can be un-ticked
  });

  it('records only real changes', () => {
    let e = toggleRunAway({}, maps.saved, st(1), true);
    assert.deepEqual(e, { 1: 'run-awayed' });
    assert.equal(statusOf(e, maps.saved, 1), 'run-awayed');
    e = toggleRunAway(e, maps.saved, st(1), false);
    assert.deepEqual(e, {});
    e = toggleRunAway(e, maps.saved, st(3), false); // came back
    assert.deepEqual(e, { 3: 'present' });
    assert.deepEqual(toggleRunAway(e, maps.saved, st(2), true), e); // absent: ignored
    assert.equal(statusOf({}, maps.saved, 5), 'absent');
  });

  it('counts the stats card like the web page', () => {
    assert.deepEqual(stayStats(students, {}, maps.saved), {
      morningPresent: 3,
      present: 2,
      runAwayed: 1,
      absent: 1,
      notMarked: 1,
    });
    assert.deepEqual(stayStats(students, { 1: 'run-awayed' }, maps.saved), {
      morningPresent: 3,
      present: 1,
      runAwayed: 2,
      absent: 1,
      notMarked: 1,
    });
  });

  it('estimates SMS credits for unsent run-aways with a phone', async () => {
    const { calculateSMSCount } = await import('@school/shared-schemas');
    const seg = (t: string) => calculateSMSCount(t).count;
    assert.equal(smsDate(TODAY), '19/10/2026');
    assert.equal(
      fillSmsTemplate(sms.run_awayed_template, {
        student_name: 'S1',
        login_id: '260801',
        date: '19/10/2026',
        class: 8,
        section: 'A',
        roll: 1,
        school_name: 'Demo High',
      }),
      'S1 (8A-1, 260801) left Demo High on 19/10/2026',
    );
    // Nothing new ticked: student 3 was already texted.
    assert.equal(smsEstimate(students, {}, maps, sms, TODAY, seg), 0);
    // 1 ticked -> one message; 6 ticked has no phone -> free.
    assert.equal(
      smsEstimate(students, { 1: 'run-awayed', 6: 'run-awayed' }, maps, sms, TODAY, seg),
      1,
    );
    assert.equal(
      smsEstimate(
        students,
        { 1: 'run-awayed' },
        maps,
        { ...sms, send_to_run_awayed: false },
        TODAY,
        seg,
      ),
      0,
    );
    assert.equal(smsEstimate(students, { 1: 'run-awayed' }, maps, undefined, TODAY, seg), 0);
  });

  it('saves only the changed rows', () => {
    const sel = { date: TODAY, level: 8, section: 'A', year: 2026 };
    assert.equal(runAwayPayload({}, sel), null);
    const p = runAwayPayload({ 1: 'run-awayed', 3: 'present' }, sel)!;
    assert.deepEqual(p, {
      ...sel,
      records: [
        { studentId: 1, date: TODAY, status: 'run-awayed' },
        { studentId: 3, date: TODAY, status: 'present' },
      ],
    });
    assert.equal('school_id' in p, false);
  });
});
