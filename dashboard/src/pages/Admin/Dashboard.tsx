import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, Bell, CalendarPlus, ChevronRight, MapPin, UserCheck } from 'lucide-react';
import { SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { getFileUrl } from '@/lib/backend';
import {
  ATTENDANCE_RANGES,
  type AttendanceRange,
  type DashboardOverview,
  useDashboardAttendance,
  useDashboardOverview,
} from '@/queries/dashboard.queries';

const SERIES = [
  { key: 'present', label: 'Present', color: 'var(--primary)' },
  { key: 'absent', label: 'Absent', color: '#dc2626' },
  { key: 'run_awayed', label: 'Ran away', color: '#d97706' },
] as const;

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Exam = DashboardOverview['examSchedule'][number];
type ExamStatus = 'Ongoing' | 'Upcoming' | 'Completed';

const examStatus = (exam: Exam, now: Date): ExamStatus => {
  if (new Date(exam.start_date) > now) return 'Upcoming';
  if (new Date(exam.end_date) >= now) return 'Ongoing';
  return 'Completed';
};

const STATUS_STYLE: Record<ExamStatus, string> = {
  Ongoing: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Upcoming: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  Completed: 'bg-muted text-foreground/70',
};
const STATUS_ORDER: Record<ExamStatus, number> = { Ongoing: 0, Upcoming: 1, Completed: 2 };

const ViewAll = ({ to }: { to: string }) => (
  <Link
    to={to}
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2"
  >
    View all <ChevronRight className="h-3.5 w-3.5" />
  </Link>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>
);

function Dashboard() {
  const [attendanceDays, setAttendanceDays] = useState<AttendanceRange>(7);

  const {
    data: dashboardData,
    isPending: overviewPending,
    isError: overviewError,
    error: overviewQueryError,
    refetch: refetchOverview,
  } = useDashboardOverview();

  const {
    data: attendanceData = [],
    isPending: attendancePending,
    isFetching: attendanceFetching,
  } = useDashboardAttendance(attendanceDays);

  if (overviewPending) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="bg-muted h-10 w-56 rounded-lg" />
        <div className="bg-muted h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="bg-muted h-80 rounded-xl lg:col-span-2" />
          <div className="bg-muted h-80 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-muted h-56 rounded-xl" />
          <div className="bg-muted h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <SectionCard className="w-full max-w-md text-center">
          <AlertTriangle className="text-destructive mx-auto mb-3 h-8 w-8" />
          <h2 className="mb-1 text-lg font-semibold">Couldn't load the dashboard</h2>
          <p className="text-muted-foreground mb-5 text-sm">
            {overviewQueryError instanceof Error ? overviewQueryError.message : 'An error occurred'}
          </p>
          <Button type="button" onClick={() => refetchOverview()}>
            Try again
          </Button>
        </SectionCard>
      </div>
    );
  }

  const { quickStats, announcements, events, examSchedule } = dashboardData;
  const now = new Date();

  const latest = attendanceData.at(-1);
  const latestTotal = latest ? latest.present + latest.absent + latest.run_awayed : 0;
  const latestRate =
    latest && latestTotal ? Math.round((latest.present / latestTotal) * 100) : null;

  const kpis = [
    { label: 'Students', value: quickStats.students, to: '/admin/students/student-list' },
    { label: 'Teachers', value: quickStats.teachers, to: '/admin/administration/teacher-list' },
    { label: 'Upcoming events', value: quickStats.events, to: '/admin/events' },
    {
      label: 'Attendance',
      value: latestRate === null ? '—' : `${latestRate}%`,
      hint: latest ? `${latest.present} of ${latestTotal} · ${latest.name}` : 'No records yet',
      to: '/admin/attendance',
    },
  ];

  const exams = examSchedule
    .map((exam) => ({ ...exam, status: examStatus(exam, now) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const hasChartData = attendanceData.length > 0;
  const chartLoading = attendancePending || attendanceFetching;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {now.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · {quickStats.students.toLocaleString()} students ·{' '}
            {quickStats.teachers.toLocaleString()} teachers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/attendance">
              <UserCheck /> Attendance
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/notice">
              <Bell /> Post notice
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/events">
              <CalendarPlus /> Add event
            </Link>
          </Button>
        </div>
      </header>

      <section
        aria-label="Key figures"
        className="bg-card border-border grid grid-cols-2 overflow-hidden rounded-xl border shadow-sm lg:grid-cols-4"
      >
        {kpis.map((kpi, i) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className={`hover:bg-muted/50 focus-visible:ring-ring border-border group px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
              i % 2 === 1 ? 'border-l' : ''
            } ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <p className="text-muted-foreground flex items-center justify-between text-xs font-medium">
              {kpi.label}
              <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </p>
            {kpi.hint && <p className="text-muted-foreground truncate text-xs">{kpi.hint}</p>}
          </Link>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <SectionCard
          title="Attendance"
          className="lg:col-span-2"
          headerAction={
            <div
              role="group"
              aria-label="Date range"
              className="bg-muted/40 flex items-center gap-1 self-start rounded-lg border p-0.5"
            >
              {ATTENDANCE_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  aria-pressed={attendanceDays === range}
                  onClick={() => setAttendanceDays(range)}
                  className={`pointer-coarse:px-3 pointer-coarse:py-2 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    attendanceDays === range
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}d
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-4">
            {SERIES.map((s) => (
              <span key={s.key} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          {hasChartData || attendancePending ? (
            <div
              className={`h-64 w-full transition-opacity ${chartLoading ? 'opacity-60' : 'opacity-100'}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={attendanceData}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    minTickGap={16}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                  />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No attendance recorded in this range.</Empty>
          )}
        </SectionCard>

        <SectionCard title="Exams" headerAction={<ViewAll to="/admin/settings/add-exam" />}>
          {exams.length === 0 ? (
            <Empty>No exams scheduled.</Empty>
          ) : (
            <ul className="divide-border -my-2 divide-y">
              {exams.slice(0, 6).map((exam) => (
                <li
                  key={`${exam.name}-${exam.start_date}`}
                  className="flex items-start gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{exam.name}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {fmtDate(exam.start_date)} – {fmtDate(exam.end_date)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[exam.status]}`}
                  >
                    {exam.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard title="Recent notices" headerAction={<ViewAll to="/admin/notice" />}>
          {announcements.length === 0 ? (
            <Empty>No recent notices.</Empty>
          ) : (
            <ul className="divide-border -my-2 divide-y">
              {announcements.slice(0, 5).map((notice) => (
                <li key={notice.id}>
                  <a
                    href={getFileUrl(notice.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary group flex items-center gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
                      {notice.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {fmtDate(notice.date)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Upcoming events" headerAction={<ViewAll to="/admin/events" />}>
          {events.length === 0 ? (
            <Empty>No upcoming events.</Empty>
          ) : (
            <ul className="divide-border -my-2 divide-y">
              {events.slice(0, 5).map((event) => {
                const date = new Date(event.date);
                return (
                  <li key={event.id} className="flex items-center gap-3 py-2.5">
                    <div className="border-border flex w-11 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                        {date.toLocaleString('en-GB', { month: 'short' })}
                      </span>
                      <span className="text-base font-bold tabular-nums">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      {event.location && (
                        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {event.location}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default Dashboard;
