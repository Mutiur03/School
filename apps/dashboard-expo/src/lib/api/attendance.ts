/**
 * Attendance endpoints used by the web dashboard's Attendance page
 * (dashboard/src/queries/attendence.queries.ts), verified against
 * server/src/modules/attendence/attendence.{route,controller,service}.ts and
 * server/src/modules/student/student.{route,service}.ts. All are legacy Express, admin + teacher.
 *
 *   GET  /api/students/attendance-overview  ?year&level&section  -> enrolled students
 *   GET  /api/attendance/getAttendence      ?month(0-11)&year&level&section -> month records
 *   GET  /api/attendance/getStats           ?date&level&section&year -> today's counts + SMS
 *   POST /api/attendance/save-and-send      { records, date, level, section, year }
 *   GET  /api/sms/settings/public            -> SMS on/off, templates, balance (Running away)
 *
 * The school is never sent: the server takes it from the session/host (RLS).
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export type AttendanceStatus = 'present' | 'absent' | 'run-awayed';

export interface AttendanceStudent {
  id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  enrollment_id: number;
  /** Student login id (stringified BigInt), used in SMS templates. */
  login_id: string;
  available: boolean;
  has_phone: boolean;
}

/** GET /api/sms/settings/public (admin + teacher): what an attendance save will text. */
export interface PublicSmsSettings {
  is_active: boolean;
  send_to_present: boolean;
  send_to_absent: boolean;
  send_to_run_awayed: boolean;
  present_template: string;
  absent_template: string;
  run_awayed_template: string;
  /** Estimated SMS credits left. */
  sms_balance: number;
  school_name: string;
}

export interface AttendanceRecordRow {
  id: number;
  student_id: number;
  /** YYYY-MM-DD (school calendar date). */
  date: string;
  status: AttendanceStatus;
  send_msg: boolean;
}

export interface AttendanceDayStats {
  present: number;
  absent: number;
  runAwayed: number;
  sms: { successful: number; failed: number; pending: number };
}

export interface ClassSelection {
  year: number;
  level: number;
  section: string;
}

export interface SaveAttendancePayload extends ClassSelection {
  date: string;
  records: { studentId: number; date: string; status: AttendanceStatus }[];
}

export interface SaveAttendanceResult {
  processed: number;
  present: number;
  absent: number;
  smsError: string | null;
}

export const ATTENDANCE_PATHS = {
  overview: '/api/students/attendance-overview',
  records: '/api/attendance/getAttendence',
  stats: '/api/attendance/getStats',
  saveAndSend: '/api/attendance/save-and-send',
  smsPublic: '/api/sms/settings/public',
  sheetPdf: '/api/attendance/sheet/download',
} as const;

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;
const STATUSES: readonly string[] = ['present', 'absent', 'run-awayed'];

function list(value: unknown, path: string): Record<string, any>[] {
  if (!Array.isArray(value)) {
    throw new ApiError({ kind: 'parse', message: 'Unexpected attendance response.', path });
  }
  return value.filter(isObj);
}

export function parseOverview(value: unknown): AttendanceStudent[] {
  return list(value, ATTENDANCE_PATHS.overview).map((s) => ({
    id: num(s.id),
    name: String(s.name ?? ''),
    class: num(s.class),
    section: String(s.section ?? ''),
    roll: num(s.roll),
    enrollment_id: num(s.enrollment_id),
    login_id: s.login_id == null ? '' : String(s.login_id),
    available: s.available !== false,
    has_phone: s.has_phone !== false,
  }));
}

export function parseRecords(value: unknown): AttendanceRecordRow[] {
  return list(value, ATTENDANCE_PATHS.records)
    .map((r) => ({
      id: num(r.id),
      student_id: num(r.student_id),
      date: String(r.date ?? ''),
      status: String(r.status ?? '').trim() as AttendanceStatus,
      send_msg: !!r.send_msg,
    }))
    .filter((r) => STATUSES.includes(r.status) && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
}

export function parseStats(value: unknown): AttendanceDayStats {
  const v = isObj(value) ? value : {};
  const sms = isObj(v.sms) ? v.sms : {};
  return {
    present: num(v.present),
    absent: num(v.absent),
    runAwayed: num(v.runAwayed),
    sms: { successful: num(sms.successful), failed: num(sms.failed), pending: num(sms.pending) },
  };
}

export function parseSmsPublic(value: unknown): PublicSmsSettings {
  const v = isObj(value) ? value : {};
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  return {
    is_active: !!v.is_active,
    send_to_present: !!v.send_to_present,
    send_to_absent: !!v.send_to_absent,
    send_to_run_awayed: !!v.send_to_run_awayed,
    present_template: str(v.present_template),
    absent_template: str(v.absent_template),
    run_awayed_template: str(v.run_awayed_template),
    sms_balance: num(v.sms_balance),
    school_name: str(v.school_name),
  };
}

export function createAttendanceApi(client: ApiClient) {
  return {
    async students(sel: ClassSelection, signal?: AbortSignal) {
      const data = await client.get<unknown>(ATTENDANCE_PATHS.overview, {
        query: { year: sel.year, level: sel.level, section: sel.section },
        signal,
      });
      return parseOverview(data);
    },
    /** `month` is 0-11, as the server and the web page expect. */
    async records(sel: ClassSelection & { month: number }, signal?: AbortSignal) {
      const data = await client.get<unknown>(ATTENDANCE_PATHS.records, {
        query: { month: sel.month, year: sel.year, level: sel.level, section: sel.section },
        signal,
      });
      return parseRecords(data);
    },
    async stats(sel: ClassSelection & { date: string }, signal?: AbortSignal) {
      const data = await client.get<unknown>(ATTENDANCE_PATHS.stats, {
        query: { date: sel.date, level: sel.level, section: sel.section, year: sel.year },
        signal,
      });
      return parseStats(data);
    },
    /** Monthly attendance sheet PDF of one class and section (month is 0-11). */
    sheetPdf: (p: { year: number; month: number; level: number; section: string }) =>
      client.get<ArrayBuffer>(ATTENDANCE_PATHS.sheetPdf, {
        query: { year: p.year, month: p.month, monthIndex: 1, level: p.level, section: p.section },
        responseType: 'arrayBuffer',
        timeoutMs: 130_000,
      }),
    async smsSettings(signal?: AbortSignal) {
      return parseSmsPublic(await client.get<unknown>(ATTENDANCE_PATHS.smsPublic, { signal }));
    },
    async saveAndSend(payload: SaveAttendancePayload): Promise<SaveAttendanceResult> {
      const data = await client.post<unknown>(ATTENDANCE_PATHS.saveAndSend, payload, {
        timeoutMs: 60_000,
      });
      const v = isObj(data) ? data : {};
      return {
        processed: num(v.processed),
        present: num(v.present),
        absent: num(v.absent),
        smsError: typeof v.smsError === 'string' && v.smsError ? v.smsError : null,
      };
    },
  };
}

export type AttendanceApi = ReturnType<typeof createAttendanceApi>;
