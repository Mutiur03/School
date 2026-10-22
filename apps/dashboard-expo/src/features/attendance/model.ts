/**
 * Pure attendance-sheet logic, ported from dashboard/src/pages/Admin/Attendence.tsx so the
 * rules match the web page exactly:
 * - only today (current month) is editable; past days are read-only;
 * - this page toggles present/absent only; "run-awayed" (set from Running Away) is never
 *   overwritten and cannot be toggled here;
 * - unmarked counts as absent when saving, but as "not marked" in the stats;
 * - saving sends every student of the class/section for today (save-and-send, like the web).
 */
import type {
  AttendanceRecordRow,
  AttendanceStatus,
  AttendanceStudent,
  PublicSmsSettings,
  SaveAttendancePayload,
} from '@/lib/api/attendance';
import { fillSmsTemplate, smsDate } from '@/features/running-away/model';

/** Same lists as dashboard/src/lib/attendanceClass.ts. */
export const ATTENDANCE_CLASSES = [6, 7, 8, 9, 10] as const;
export const ATTENDANCE_SECTIONS = ['A', 'B'] as const;
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type LocalEdits = Record<string, AttendanceStatus>;
export const cellKey = (studentId: number, day: number) => `${studentId}-${day}`;
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;
export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export function buildMaps(records: readonly AttendanceRecordRow[], year: number, month: number) {
  const attendance: Record<string, AttendanceStatus> = {};
  const sent: Record<string, boolean> = {};
  const prefix = `${year}-${pad(month + 1)}`;
  for (const r of records) {
    if (!r.date.startsWith(prefix)) continue;
    const key = cellKey(r.student_id, parseInt(r.date.split('-')[2]!, 10));
    attendance[key] = r.status;
    sent[key] = r.send_msg;
  }
  return { attendance, sent };
}

export const recordedStatus = (
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  studentId: number,
  day: number,
): AttendanceStatus | null =>
  edits[cellKey(studentId, day)] ?? saved[cellKey(studentId, day)] ?? null;

/** Toggle present/absent; an edit equal to the saved value (unmarked = absent) is dropped. */
export function applyToggle(
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  studentId: number,
  day: number,
  present: boolean,
): LocalEdits {
  const key = cellKey(studentId, day);
  if (saved[key] === 'run-awayed') return edits;
  const next: AttendanceStatus = present ? 'present' : 'absent';
  const current = saved[key] ?? 'absent';
  if (next === current) {
    const { [key]: _removed, ...rest } = edits;
    return rest;
  }
  return { ...edits, [key]: next };
}

export const isMarkable = (
  s: AttendanceStudent,
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  day: number,
) => s.available && recordedStatus(edits, saved, s.id, day) !== 'run-awayed';

export function setAll(
  students: readonly AttendanceStudent[],
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  day: number,
  present: boolean,
): LocalEdits {
  return students
    .filter((s) => isMarkable(s, edits, saved, day))
    .reduce((acc, s) => applyToggle(acc, saved, s.id, day, present), edits);
}

export function dayStats(
  students: readonly AttendanceStudent[],
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  day: number,
) {
  const out = { total: 0, present: 0, absent: 0, runAwayed: 0, notMarked: 0 };
  for (const s of students) {
    if (!s.available) continue;
    out.total++;
    const st = recordedStatus(edits, saved, s.id, day);
    if (!st) out.notMarked++;
    else if (st === 'present') out.present++;
    else if (st === 'run-awayed') out.runAwayed++;
    else out.absent++;
  }
  return out;
}

export function buildSavePayload(
  students: readonly AttendanceStudent[],
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  sel: { year: number; month: number; day: number; level: number; section: string },
): SaveAttendancePayload {
  const date = isoDate(sel.year, sel.month, sel.day);
  return {
    date,
    level: sel.level,
    section: sel.section,
    year: sel.year,
    records: students.map((s) => ({
      studentId: s.id,
      date,
      status: recordedStatus(edits, saved, s.id, sel.day) ?? 'absent',
    })),
  };
}

/**
 * SMS credits a save would spend (web Attendence.tsx smsEstimate): today's status of every
 * active student with a guardian phone who was not texted yet, for the statuses the school
 * texts. Only the current month sends. `segments` measures one message.
 */
export function attendanceSmsEstimate(
  students: readonly AttendanceStudent[],
  edits: LocalEdits,
  saved: Record<string, AttendanceStatus>,
  sent: Record<string, boolean>,
  settings: PublicSmsSettings | undefined,
  todayIso: string,
  day: number,
  segments: (text: string) => number,
): { count: number; cost: number } {
  if (!settings?.is_active || students.length === 0) return { count: 0, cost: 0 };
  let count = 0;
  let cost = 0;
  for (const s of students) {
    // Unmarked saves as absent.
    const status = recordedStatus(edits, saved, s.id, day) ?? 'absent';
    const wanted =
      (status === 'present' && settings.send_to_present) ||
      (status === 'absent' && settings.send_to_absent) ||
      (status === 'run-awayed' && settings.send_to_run_awayed);
    if (!wanted || sent[cellKey(s.id, day)] || !s.available || !s.has_phone) continue;
    const template =
      status === 'present'
        ? settings.present_template
        : status === 'absent'
          ? settings.absent_template
          : settings.run_awayed_template;
    if (!template) continue;
    cost += segments(
      fillSmsTemplate(template, {
        student_name: s.name,
        login_id: s.login_id,
        date: smsDate(todayIso),
        class: s.class,
        section: s.section,
        roll: s.roll,
        school_name: settings.school_name,
      }),
    );
    count++;
  }
  return { count, cost };
}

/** The class remembered on this device (shared by Attendance and Running Away); null when unset/invalid. */
export const parseStoredClass = (raw: string | null | undefined): number | null => {
  const n = Number(raw);
  return (ATTENDANCE_CLASSES as readonly number[]).includes(n) ? n : null;
};
