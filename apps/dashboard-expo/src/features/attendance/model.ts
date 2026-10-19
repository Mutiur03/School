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
  SaveAttendancePayload,
} from '@/lib/api/attendance';

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
