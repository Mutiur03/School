/**
 * Running away (web: dashboard/src/pages/Admin/StayCheck.tsx, /admin|/teacher/attendance-double).
 * Today's morning attendance is the baseline; the user ticks students who left without
 * permission (present -> run-awayed) and only the changed rows are saved, through the same
 * POST /api/attendance/save-and-send the Attendance page uses (it also texts guardians when the
 * school's "run-awayed" SMS is on).
 */
import type {
  AttendanceRecordRow,
  AttendanceStatus,
  AttendanceStudent,
  PublicSmsSettings,
  SaveAttendancePayload,
} from '@/lib/api/attendance';

/** studentId -> status edited here (only differences from the saved status). */
export type RunAwayEdits = Record<number, AttendanceStatus>;

export interface TodayMaps {
  saved: Record<number, AttendanceStatus>;
  sent: Record<number, boolean>;
}

export function todayMaps(records: readonly AttendanceRecordRow[], todayIso: string): TodayMaps {
  const saved: Record<number, AttendanceStatus> = {};
  const sent: Record<number, boolean> = {};
  for (const r of records) {
    if (r.date !== todayIso) continue;
    saved[r.student_id] = r.status;
    sent[r.student_id] = r.send_msg;
  }
  return { saved, sent };
}

/** Effective status (no record = absent, like the web page). */
export const statusOf = (edits: RunAwayEdits, saved: TodayMaps['saved'], id: number) =>
  edits[id] ?? saved[id] ?? 'absent';

/** Morning attendance exists for at least one student of the class. */
export const morningTaken = (students: readonly AttendanceStudent[], saved: TodayMaps['saved']) =>
  students.some((s) => saved[s.id] !== undefined);

/** Absent this morning (or no record) or inactive: can't be ticked. */
export const isLocked = (s: AttendanceStudent, saved: TodayMaps['saved']) =>
  !s.available || (saved[s.id] ?? 'absent') === 'absent';

/** Tick / untick; returning to the saved status drops the edit. Locked rows are ignored. */
export function toggleRunAway(
  edits: RunAwayEdits,
  saved: TodayMaps['saved'],
  s: AttendanceStudent,
  ranAway: boolean,
): RunAwayEdits {
  if (isLocked(s, saved)) return edits;
  const next: AttendanceStatus = ranAway ? 'run-awayed' : 'present';
  const persisted = saved[s.id] ?? 'present';
  if (next === persisted) {
    const { [s.id]: _removed, ...rest } = edits;
    return rest;
  }
  return { ...edits, [s.id]: next };
}

export function stayStats(
  students: readonly AttendanceStudent[],
  edits: RunAwayEdits,
  saved: TodayMaps['saved'],
) {
  const out = { morningPresent: 0, present: 0, runAwayed: 0, absent: 0, notMarked: 0 };
  for (const s of students) {
    if (!s.available) continue;
    const st = edits[s.id] ?? saved[s.id];
    if (!st) out.notMarked++;
    else if (st === 'present') out.present++;
    else if (st === 'absent') out.absent++;
    else out.runAwayed++;
    if (saved[s.id] === 'present' || saved[s.id] === 'run-awayed') out.morningPresent++;
  }
  return out;
}

/** Same placeholders as the server's interpolate() (attendence.service.ts) and web lib/sms.ts. */
export function fillSmsTemplate(
  template: string,
  v: {
    student_name: string;
    login_id: string;
    date: string;
    class: number;
    section: string;
    roll: number;
    school_name: string;
  },
) {
  return template
    .replace(/{student_name}/g, v.student_name)
    .replace(/{login_id}/g, v.login_id)
    .replace(/{date}/g, v.date)
    .replace(/{class}/g, String(v.class))
    .replace(/{section}/g, v.section)
    .replace(/{roll}/g, String(v.roll))
    .replace(/{school_name}/g, v.school_name);
}

/** "2026-10-04" -> "04/10/2026", the {date} format the server sends. */
export const smsDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * SMS credits a save would spend: run-awayed, active, has a guardian phone, not texted yet.
 * `segments` measures one message (calculateSMSCount from @school/shared-schemas in the app).
 */
export function smsEstimate(
  students: readonly AttendanceStudent[],
  edits: RunAwayEdits,
  maps: TodayMaps,
  settings: PublicSmsSettings | undefined,
  todayIso: string,
  segments: (text: string) => number,
): number {
  if (!settings?.is_active || !settings.send_to_run_awayed) return 0;
  let total = 0;
  for (const s of students) {
    if (maps.sent[s.id] || !s.available || !s.has_phone) continue;
    if (statusOf(edits, maps.saved, s.id) !== 'run-awayed') continue;
    total += segments(
      fillSmsTemplate(settings.run_awayed_template, {
        student_name: s.name,
        login_id: s.login_id,
        date: smsDate(todayIso),
        class: s.class,
        section: s.section,
        roll: s.roll,
        school_name: settings.school_name,
      }),
    );
  }
  return total;
}

/** Only the rows changed here, so a stale page can't overwrite other statuses. */
export function runAwayPayload(
  edits: RunAwayEdits,
  sel: { date: string; level: number; section: string; year: number },
): SaveAttendancePayload | null {
  const ids = Object.keys(edits).map(Number);
  if (ids.length === 0) return null;
  return {
    date: sel.date,
    level: sel.level,
    section: sel.section,
    year: sel.year,
    records: ids.map((studentId) => ({ studentId, date: sel.date, status: edits[studentId]! })),
  };
}
