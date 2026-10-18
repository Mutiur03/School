/**
 * MOCK DATA. Placeholder content only; nothing here comes from the backend and it must never be
 * shown to users as real school data. Every screen using it renders <MockDataBadge/>.
 *
 * Shapes mirror the web dashboard's types so the screens can switch to real queries later:
 *   DashboardOverview / AttendanceDataPoint  -> dashboard/src/queries/dashboard.queries.ts
 *   student row fields                       -> dashboard/src/pages/Admin/StudentList.tsx
 */

export type AttendanceRange = 7 | 15 | 30;
export const ATTENDANCE_RANGES: readonly AttendanceRange[] = [7, 15, 30];

export interface MockAttendancePoint {
  name: string;
  present: number;
  absent: number;
  run_awayed: number;
}

export interface MockOverview {
  quickStats: { students: number; teachers: number; events: number };
  announcements: { id: number; title: string; date: string }[];
  events: { id: number; title: string; date: string; location?: string }[];
  examSchedule: { name: string; start_date: string; end_date: string }[];
}

export const MOCK_OVERVIEW: MockOverview = {
  quickStats: { students: 1248, teachers: 64, events: 3 },
  announcements: [
    { id: 1, title: 'Half-yearly exam routine published', date: '2026-10-16' },
    { id: 2, title: 'School closed for Durga Puja', date: '2026-10-12' },
    { id: 3, title: 'Parent–teacher meeting, Class 9', date: '2026-10-08' },
    { id: 4, title: 'Class 6 registration deadline extended', date: '2026-10-03' },
  ],
  events: [
    { id: 1, title: 'Annual Science Fair', date: '2026-10-28', location: 'Main auditorium' },
    { id: 2, title: 'Inter-house Football Final', date: '2026-11-05', location: 'School field' },
    { id: 3, title: 'Victory Day Rehearsal', date: '2026-12-10' },
  ],
  examSchedule: [
    { name: 'Half-yearly Examination', start_date: '2026-10-12', end_date: '2026-10-26' },
    { name: 'SSC Test Examination', start_date: '2026-11-20', end_date: '2026-12-02' },
    { name: 'Monthly Test (September)', start_date: '2026-09-14', end_date: '2026-09-18' },
  ],
};

/** Deterministic pseudo-random series so screenshots are stable. */
export function mockAttendance(
  days: AttendanceRange,
  today = new Date('2026-10-18'),
): MockAttendancePoint[] {
  const out: MockAttendancePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (d.getDay() === 5) continue; // Friday: weekend in Bangladesh
    const seed = (d.getDate() * 37 + d.getMonth() * 11) % 17;
    const absent = 60 + seed * 4;
    const run_awayed = 4 + (seed % 5);
    out.push({
      name: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      present: 1248 - absent - run_awayed,
      absent,
      run_awayed,
    });
  }
  return out;
}
