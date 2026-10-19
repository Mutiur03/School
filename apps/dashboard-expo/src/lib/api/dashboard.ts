/**
 * Admin overview endpoints, exactly as the web admin dashboard calls them
 * (dashboard/src/queries/dashboard.queries.ts, pages/Admin/Dashboard.tsx), verified against
 * server/src/modules/dashboard (admin only, school from the host):
 *
 *   GET /api/dashboard                          quickStats, announcements, events, examSchedule
 *   GET /api/dashboard/attendance?attendanceDays daily present/absent/run_awayed series
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export type AttendanceRange = 7 | 15 | 30;
export const ATTENDANCE_RANGES: readonly AttendanceRange[] = [7, 15, 30];

export interface AttendancePoint {
  name: string;
  present: number;
  absent: number;
  run_awayed: number;
  sort_date: string;
}

export interface DashboardOverview {
  quickStats: { students: number; teachers: number; events: number };
  announcements: { id: number; title: string; date: string; url: string | null }[];
  events: { id: number; title: string; date: string; location: string | null }[];
  examSchedule: { name: string; start_date: string; end_date: string }[];
}

export const DASHBOARD_PATHS = {
  overview: '/api/dashboard',
  attendance: '/api/dashboard/attendance',
} as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const optStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const parseError = (path: string) =>
  new ApiError({ kind: 'parse', message: 'Unexpected dashboard response.', path });

export function parseDashboardOverview(value: unknown): DashboardOverview {
  if (!isRec(value) || !isRec(value.quickStats)) throw parseError(DASHBOARD_PATHS.overview);
  const q = value.quickStats;
  return {
    quickStats: { students: num(q.students), teachers: num(q.teachers), events: num(q.events) },
    announcements: recs(value.announcements).map((a) => ({
      id: num(a.id),
      title: str(a.title),
      date: str(a.date),
      url: optStr(a.url),
    })),
    events: recs(value.events).map((e) => ({
      id: num(e.id),
      title: str(e.title),
      date: str(e.date),
      location: optStr(e.location),
    })),
    examSchedule: recs(value.examSchedule).map((e) => ({
      name: str(e.name),
      start_date: str(e.start_date),
      end_date: str(e.end_date),
    })),
  };
}

export function parseAttendanceSeries(value: unknown): AttendancePoint[] {
  if (!Array.isArray(value)) throw parseError(DASHBOARD_PATHS.attendance);
  return recs(value).map((p) => ({
    name: str(p.name),
    present: num(p.present),
    absent: num(p.absent),
    run_awayed: num(p.run_awayed),
    sort_date: str(p.sort_date),
  }));
}

export type ExamStatus = 'Ongoing' | 'Upcoming' | 'Completed';
const STATUS_ORDER: Record<ExamStatus, number> = { Ongoing: 0, Upcoming: 1, Completed: 2 };

export function examStatus(e: { start_date: string; end_date: string }, now: Date): ExamStatus {
  if (new Date(e.start_date) > now) return 'Upcoming';
  if (new Date(e.end_date) >= now) return 'Ongoing';
  return 'Completed';
}

/** Same ordering as the web page: Ongoing, Upcoming, Completed (stable within a group). */
export function sortExams<T extends { start_date: string; end_date: string }>(
  exams: T[],
  now: Date,
) {
  return exams
    .map((e) => ({ ...e, status: examStatus(e, now) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/** Latest day's attendance rate, as the web KPI: null when there is no data. */
export function latestAttendance(series: AttendancePoint[]) {
  const latest = series.at(-1);
  if (!latest) return null;
  const total = latest.present + latest.absent + latest.run_awayed;
  return {
    latest,
    total,
    rate: total ? Math.round((latest.present / total) * 100) : null,
  };
}

export function createDashboardApi(client: ApiClient) {
  return {
    async overview(signal?: AbortSignal) {
      return parseDashboardOverview(
        await client.get<unknown>(DASHBOARD_PATHS.overview, { signal }),
      );
    },
    async attendance(days: AttendanceRange, signal?: AbortSignal) {
      return parseAttendanceSeries(
        await client.get<unknown>(DASHBOARD_PATHS.attendance, {
          query: { attendanceDays: days },
          signal,
        }),
      );
    },
  };
}

export type DashboardApi = ReturnType<typeof createDashboardApi>;
