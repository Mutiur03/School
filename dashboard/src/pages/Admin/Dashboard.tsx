import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users, UserCheck, Calendar, Bell, GraduationCap, ClipboardList } from 'lucide-react';
import { PageHeader, SectionCard, StatsCard } from '@/components';
import { getFileUrl } from '@/lib/backend';
import {
  ATTENDANCE_RANGES,
  type AttendanceRange,
  useDashboardAttendance,
  useDashboardOverview,
} from '@/queries/dashboard.queries';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const COLORS = {
  present: '#3b82f6', // Blue
  absent: '#ef4444', // Red
  run_awayed: '#f59e0b', // Amber
};

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>('overview');
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

  const quickStats = dashboardData?.quickStats ?? {
    students: 0,
    teachers: 0,
    events: 0,
  };
  const announcements = dashboardData?.announcements ?? [];
  const events = dashboardData?.events ?? [];
  const examSchedule = dashboardData?.examSchedule ?? [];

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <UserCheck className="h-4 w-4" />,
    },
    {
      id: 'announcements',
      label: 'Notices',
      icon: <Bell className="h-4 w-4" />,
    },
    { id: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    {
      id: 'exams',
      label: 'Exams',
      icon: <ClipboardList className="h-4 w-4" />,
    },
  ];

  if (overviewPending) {
    return (
      <div className="min-h-screen animate-pulse p-4 text-gray-500 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="bg-muted h-12 w-64 rounded-lg"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-32 rounded-xl"></div>
            ))}
          </div>
          <div className="bg-muted h-10 w-full max-w-md rounded-lg"></div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="bg-muted h-96 rounded-xl"></div>
            <div className="bg-muted h-96 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (overviewError) {
    const errorMessage =
      overviewQueryError instanceof Error ? overviewQueryError.message : 'An error occurred';

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <SectionCard className="w-full max-w-md p-8 text-center">
          <div className="text-destructive mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <button
            onClick={() => refetchOverview()}
            className="bg-primary rounded-lg px-6 py-2 text-white transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-lg"
          >
            Try Again
          </button>
        </SectionCard>
      </div>
    );
  }

  const renderAttendanceSection = (title: string) => {
    const hasData = attendanceData.length > 0;
    const chartInitialLoad = attendancePending && !hasData;
    const chartRefreshing = attendanceFetching && hasData;

    const rangeSelector = (
      <div className="bg-muted/30 flex items-center gap-1 rounded-lg border p-1">
        {ATTENDANCE_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => setAttendanceDays(range)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              attendanceDays === range
                ? 'bg-card text-primary border-border border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {range}d
          </button>
        ))}
      </div>
    );

    return (
      <SectionCard title={title} headerAction={rangeSelector} className="w-full">
        {hasData || chartInitialLoad ? (
          <div className="flex flex-col">
            <div
              className={`h-64 w-full transition-opacity sm:h-72 ${
                chartRefreshing || chartInitialLoad ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={attendanceData}
                  margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="mt-6 flex justify-center gap-6">
                          {payload?.map((entry: any, index: number) => (
                            <div key={`item-${index}`} className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full border-2 bg-white shadow-sm"
                                style={{ borderColor: entry.color }}
                              />
                              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                {entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="present"
                    stroke={COLORS.present}
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#fff',
                      stroke: COLORS.present,
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: COLORS.present,
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    name="Present"
                  />
                  <Line
                    type="monotone"
                    dataKey="run_awayed"
                    stroke={COLORS.run_awayed}
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#fff',
                      stroke: COLORS.run_awayed,
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: COLORS.run_awayed,
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    name="Ran Away"
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    stroke={COLORS.absent}
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#fff',
                      stroke: COLORS.absent,
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: COLORS.absent,
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    name="Absent"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
            <GraduationCap className="mb-4 h-16 w-16 opacity-20" />
            <p>No attendance data recorded yet.</p>
          </div>
        )}
      </SectionCard>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-6 lg:space-y-8">
              {renderAttendanceSection('Attendance Overview')}
              <SectionCard title="Quick Summary">
                <div className="space-y-4">
                  {[
                    {
                      label: 'Total Students',
                      value: quickStats.students,
                      icon: <Users className="h-4 w-4 text-blue-500" />,
                    },
                    {
                      label: 'Active Teachers',
                      value: quickStats.teachers,
                      icon: <UserCheck className="h-4 w-4 text-green-500" />,
                    },
                    {
                      label: 'Upcoming Events',
                      value: quickStats.events,
                      icon: <Calendar className="h-4 w-4 text-yellow-500" />,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-background border-border rounded-full border p-2 shadow-sm">
                          {stat.icon}
                        </div>
                        <span className="text-sm font-medium sm:text-base">{stat.label}</span>
                      </div>
                      <span className="text-lg font-bold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
            <div className="space-y-6 lg:space-y-8">
              <SectionCard
                title="Recent Notices"
                headerAction={
                  <Link
                    to="/admin/notice"
                    className="text-primary focus-visible:ring-primary rounded text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    View All
                  </Link>
                }
              >
                <div className="space-y-4">
                  {announcements.length > 0 ? (
                    announcements.slice(0, 3).map((notice) => (
                      <a
                        href={getFileUrl(notice.url)}
                        target="_blank"
                        key={notice.id}
                        className="border-primary bg-muted/30 group hover:bg-muted/50 block cursor-pointer rounded-r-lg border-l-4 p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <h4 className="group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors sm:text-base">
                            {notice.title}
                          </h4>
                          <span className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
                            {new Date(notice.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-8 text-center">No recent notices.</p>
                  )}
                </div>
              </SectionCard>
              <SectionCard
                title="Upcoming Events"
                headerAction={
                  <Link
                    to="/admin/events"
                    className="text-primary focus-visible:ring-primary rounded text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    View All
                  </Link>
                }
              >
                <div className="space-y-4">
                  {events.length > 0 ? (
                    events.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="hover:bg-muted/30 hover:border-border flex gap-4 rounded-lg border border-transparent p-3 transition-colors"
                      >
                        <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg">
                          <span className="text-xs font-bold uppercase">
                            {new Date(event.date).toLocaleString('en-GB', {
                              month: 'short',
                            })}
                          </span>
                          <span className="text-lg leading-tight font-bold">
                            {new Date(event.date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="line-clamp-1 text-sm font-semibold sm:text-base">
                            {event.title}
                          </h4>
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {event.location}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-8 text-center">No upcoming events.</p>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        );
      case 'attendance':
        return renderAttendanceSection('Attendance Trend Analysis');
      case 'announcements':
        return (
          <SectionCard title="Notices & Announcements">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {announcements.map((notice) => (
                <a
                  href={getFileUrl(notice.url)}
                  target="_blank"
                  key={notice.id}
                  className="border-border hover:border-primary/50 bg-card block rounded-xl border p-5 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="bg-primary/10 text-primary rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                      Notice
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(notice.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="group-hover:text-primary mb-2 font-bold transition-colors">
                    {notice.title}
                  </h4>
                </a>
              ))}
            </div>
          </SectionCard>
        );
      case 'events':
        return (
          <SectionCard title="Scheduled Events">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="group border-border bg-card overflow-hidden rounded-xl border transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:shadow-lg"
                >
                  <div className="bg-primary/5 border-border group-hover:bg-primary/10 flex h-32 items-center justify-center border-b transition-colors">
                    <Calendar className="text-primary h-12 w-12 opacity-20" />
                  </div>
                  <div className="p-5">
                    <h4 className="mb-3 line-clamp-2 font-bold">{event.title}</h4>
                    <div className="space-y-2">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Users className="h-3.5 w-3.5" />
                        {event.location}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case 'exams':
        return (
          <SectionCard title="Examination Schedule">
            <div className="max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[640px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="bg-muted/50 border-border/50 sticky left-0 z-20 border-r px-6 py-4 text-left text-xs font-bold tracking-wider uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      Exam Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold tracking-wider uppercase">
                      Start Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold tracking-wider uppercase">
                      End Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold tracking-wider uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {examSchedule.map((exam, index) => {
                    const now = new Date();
                    const start = new Date(exam.start_date);
                    const end = new Date(exam.end_date);
                    const isUpcoming = start > now;
                    const isOngoing = now >= start && now <= end;

                    return (
                      <tr key={index} className="hover:bg-muted/20 transition-colors">
                        <td className="bg-card border-border/50 sticky left-0 z-10 border-r px-6 py-4 text-sm font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                          {exam.name}
                        </td>
                        <td className="text-muted-foreground px-6 py-4 text-sm">
                          {start.toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground px-6 py-4 text-sm">
                          {end.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${isOngoing ? 'bg-green-500/10 text-green-500' : isUpcoming ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}
                          >
                            {isOngoing ? 'Ongoing' : isUpcoming ? 'Upcoming' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {examSchedule.length === 0 && (
                <div className="text-muted-foreground py-12 text-center">No exams scheduled.</div>
              )}
            </div>
          </SectionCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-muted/10 min-h-screen p-4 sm:p-6 lg:p-10 dark:bg-zinc-950/20">
      <div className="mx-auto max-w-7xl space-y-8 lg:space-y-10">
        <PageHeader
          title="Campus Dashboard"
          description={`Welcome back, Administrator. Last updated: ${new Date().toLocaleTimeString()}.`}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            label="Total Students"
            value={quickStats.students}
            icon={<Users className="h-6 w-6" />}
            color="blue"
            loading={false}
          />
          <StatsCard
            label="Active Faculty"
            value={quickStats.teachers}
            icon={<UserCheck className="h-6 w-6" />}
            color="emerald"
            loading={false}
          />
          <StatsCard
            label="Scheduled Events"
            value={quickStats.events}
            icon={<Calendar className="h-6 w-6" />}
            color="amber"
            loading={false}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-muted/50 scrollbar-hide flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-[color,background-color,border-color,box-shadow,opacity,transform] sm:px-6 ${
                  activeTab === tab.id
                    ? 'bg-card text-primary border-border border shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div key={activeTab} className="animate-fade-in-up">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
