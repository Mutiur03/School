/**
 * Admin overview, replicating dashboard/src/pages/Admin/Dashboard.tsx: header with date and
 * counts plus quick actions, KPI strip, Attendance chart + Exams, Recent notices + Upcoming
 * events. Data comes from the same endpoints as the web page: GET /api/dashboard and
 * GET /api/dashboard/attendance?attendanceDays (see src/lib/api/dashboard.ts).
 */
import { useRouter } from 'expo-router';
import { Bell, CalendarPlus, ChevronRight, MapPin, UserCheck } from '@/components/ui/icons';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { openFileUrl } from '@/lib/files/open-url';
import { PageLayout } from '@/components/layout/PageLayout';
import { Chip, type ChipTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LineChart } from '@/components/ui/LineChart';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useDashboardAttendance, useDashboardOverview } from '@/features/overview/hooks';
import {
  ATTENDANCE_RANGES,
  latestAttendance,
  sortExams,
  type AttendanceRange,
  type ExamStatus,
} from '@/lib/api';
import { appConfig } from '@/config/env';
import { resolveFileUrl } from '@/tenant/branding';
import { cn } from '@/lib/utils';
import type { NavHref } from '@/navigation/nav-items';
import { useTheme } from '@/theme/ThemeProvider';

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_TONE: Record<ExamStatus, ChipTone> = {
  Ongoing: 'emerald',
  Upcoming: 'blue',
  Completed: 'muted',
};
function ViewAll({ to }: { to: NavHref }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate(to)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className="flex-row items-center gap-0.5"
    >
      <Text size="xs" weight="medium" color={hovered ? 'foreground' : 'mutedForeground'}>
        View all
      </Text>
      <Icon icon={ChevronRight} size={14} color={hovered ? 'foreground' : 'mutedForeground'} />
    </Pressable>
  );
}

function Divided({ children }: { children: ReactNode[] }) {
  return (
    <View className="-my-2">
      {children.map((child, i) => (
        <View key={i} className={i > 0 ? 'border-border border-t' : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

function Kpi({
  label,
  value,
  hint,
  to,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  to: NavHref;
  className: string;
}) {
  const router = useRouter();
  // The chevron fades in on hover (`group-hover:opacity-100` on web); tracked in JS here.
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate(to)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={`kpi-${label}`}
      className={cn('border-border hover:bg-muted/50 px-5 py-4', className)}
    >
      <View className="flex-row items-center justify-between">
        <Text size="xs" weight="medium" color="mutedForeground">
          {label}
        </Text>
        <View className={hovered ? 'opacity-100' : 'opacity-0'}>
          <Icon icon={ChevronRight} size={14} color="mutedForeground" />
        </View>
      </View>
      <Text size="xl" weight="semibold" tabular className="mt-0.5">
        {value}
      </Text>
      {hint ? (
        <Text size="xs" color="mutedForeground" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: AttendanceRange;
  onChange: (r: AttendanceRange) => void;
}) {
  const { shadows } = useTheme();
  return (
    <View
      role="group"
      accessibilityLabel="Date range"
      className="border-border bg-muted/40 flex-row items-center gap-1 rounded-lg border p-0.5"
    >
      {ATTENDANCE_RANGES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            accessibilityRole="button"
            aria-selected={active}
            onPress={() => onChange(r)}
            testID={`range-${r}`}
            className={cn('rounded-md px-2.5 py-1', active && 'bg-card')}
            style={active ? { boxShadow: shadows.sm } : undefined}
          >
            <Text size="xs" weight="semibold" color={active ? 'foreground' : 'mutedForeground'}>
              {r}d
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// CSS grid parity (`lg:grid-cols-3 gap-6` + `col-span-2`): basis-6 (24px, one gap) on the wide
// column makes it exactly two columns plus one gap.
const GRID = 'gap-6 lg:flex-row lg:items-start';
const COL1 = 'lg:min-w-0 lg:flex-1';
const COL2 = 'lg:min-w-0 lg:shrink lg:grow-[2] lg:basis-6';

function LoadingSkeleton() {
  return (
    <View className="gap-6" testID="overview-loading">
      <Skeleton width={224} height={40} className="rounded-lg" />
      <Skeleton height={96} className="rounded-xl" />
      <View className={GRID}>
        <View className={COL2}>
          <Skeleton height={320} className="rounded-xl" />
        </View>
        <View className={COL1}>
          <Skeleton height={320} className="rounded-xl" />
        </View>
      </View>
      <View className={GRID}>
        <View className={COL1}>
          <Skeleton height={224} className="rounded-xl" />
        </View>
        <View className={COL1}>
          <Skeleton height={224} className="rounded-xl" />
        </View>
      </View>
    </View>
  );
}

// Full class strings per KPI position: 2x2 below lg, 1x4 from lg (borders between cells).
const KPI_CELL = [
  'w-1/2 lg:w-1/4',
  'w-1/2 border-l lg:w-1/4',
  'w-1/2 border-t lg:w-1/4 lg:border-l lg:border-t-0',
  'w-1/2 border-l border-t lg:w-1/4 lg:border-t-0',
];

export default function OverviewScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const [days, setDays] = useState<AttendanceRange>(7);
  const overview = useDashboardOverview();
  const attendanceQuery = useDashboardAttendance(days);
  const attendance = attendanceQuery.data ?? [];

  // Chart strokes are SVG props (values); legend dots use the matching classes.
  const SERIES = [
    { key: 'present', label: 'Present', color: colors.primary, dot: 'bg-primary' },
    { key: 'absent', label: 'Absent', color: colors.seriesAbsent, dot: 'bg-series-absent' },
    {
      key: 'run_awayed',
      label: 'Ran away',
      color: colors.seriesRanAway,
      dot: 'bg-series-ran-away',
    },
  ] as const;

  if (overview.isPending) {
    return (
      <PageLayout title="Dashboard">
        <LoadingSkeleton />
      </PageLayout>
    );
  }
  if (overview.isError) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        message={overview.error.message}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const { quickStats, announcements, events, examSchedule } = overview.data;
  const now = new Date();
  const kpiAttendance = latestAttendance(attendance);
  const refreshing = overview.isRefetching || attendanceQuery.isRefetching;
  const onRefresh = () => {
    void overview.refetch();
    void attendanceQuery.refetch();
  };

  const kpis: { label: string; value: string; hint?: string; to: NavHref }[] = [
    { label: 'Students', value: quickStats.students.toLocaleString(), to: '/students' },
    { label: 'Teachers', value: quickStats.teachers.toLocaleString(), to: '/teachers' },
    { label: 'Upcoming events', value: quickStats.events.toLocaleString(), to: '/events' },
    {
      label: 'Attendance',
      value: kpiAttendance?.rate == null ? '—' : `${kpiAttendance.rate}%`,
      hint: kpiAttendance
        ? `${kpiAttendance.latest.present} of ${kpiAttendance.total} · ${kpiAttendance.latest.name}`
        : 'No records yet',
      to: '/attendance',
    },
  ];

  const exams = sortExams(examSchedule, now);

  const dateLine = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageLayout
      title="Dashboard"
      onRefresh={onRefresh}
      refreshing={refreshing}
      description={`${dateLine} · ${quickStats.students.toLocaleString()} students · ${quickStats.teachers.toLocaleString()} teachers`}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            icon={UserCheck}
            label="Attendance"
            onPress={() => router.navigate('/attendance')}
          />
          <Button
            variant="outline"
            size="sm"
            icon={Bell}
            label="Post notice"
            onPress={() => router.navigate('/notices')}
          />
          <Button
            variant="outline"
            size="sm"
            icon={CalendarPlus}
            label="Add event"
            onPress={() => router.navigate('/events')}
          />
        </>
      }
    >
      <View
        accessibilityLabel="Key figures"
        testID="kpi-strip"
        className="border-border bg-card flex-row flex-wrap overflow-hidden rounded-xl border"
        style={{ boxShadow: shadows.sm }}
      >
        {kpis.map((kpi, i) => (
          <Kpi key={kpi.label} {...kpi} className={KPI_CELL[i] ?? ''} />
        ))}
      </View>

      <View className={GRID}>
        <SectionCard
          title="Attendance"
          className={COL2}
          headerAction={<RangeToggle value={days} onChange={setDays} />}
          testID="card-attendance"
        >
          <View className="mb-3 flex-row flex-wrap gap-4">
            {SERIES.map((s) => (
              <View key={s.key} className="flex-row items-center gap-1.5">
                <View className={cn('h-2 w-2 rounded-full', s.dot)} />
                <Text size="xs" color="mutedForeground">
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
          {attendanceQuery.isError && !attendanceQuery.data ? (
            <EmptyState message="Couldn't load attendance." />
          ) : attendance.length > 0 || attendanceQuery.isPending ? (
            <View className={attendanceQuery.isFetching ? 'opacity-60' : undefined}>
              {attendance.length > 0 ? (
                <LineChart data={attendance} series={SERIES} />
              ) : (
                <Skeleton height={256} className="rounded-lg" />
              )}
            </View>
          ) : (
            <EmptyState message="No attendance recorded in this range." />
          )}
        </SectionCard>

        <SectionCard
          title="Exams"
          className={COL1}
          headerAction={<ViewAll to="/exams" />}
          testID="card-exams"
        >
          {exams.length === 0 ? (
            <EmptyState message="No exams scheduled." />
          ) : (
            <Divided>
              {exams.slice(0, 6).map((exam) => (
                <View
                  key={`${exam.name}-${exam.start_date}`}
                  className="flex-row items-start gap-3 py-2.5"
                >
                  <View className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {exam.name}
                    </Text>
                    <Text size="xs" color="mutedForeground" tabular>
                      {fmtDate(exam.start_date)} – {fmtDate(exam.end_date)}
                    </Text>
                  </View>
                  <Chip label={exam.status} tone={STATUS_TONE[exam.status]} />
                </View>
              ))}
            </Divided>
          )}
        </SectionCard>
      </View>

      <View className={GRID}>
        <SectionCard
          title="Recent notices"
          className={COL1}
          headerAction={<ViewAll to="/notices" />}
          testID="card-notices"
        >
          {announcements.length === 0 ? (
            <EmptyState message="No recent notices." />
          ) : (
            <Divided>
              {announcements.slice(0, 5).map((n) => (
                <Pressable
                  key={n.id}
                  accessibilityRole="link"
                  disabled={!resolveFileUrl(n.url, appConfig.cdnUrl)}
                  onPress={() => {
                    // Same as the web page: open the notice file (getFileUrl(notice.url)).
                    const url = resolveFileUrl(n.url, appConfig.cdnUrl);
                    if (url) void openFileUrl(url);
                  }}
                  className="flex-row items-center gap-3 py-2.5"
                >
                  <Text size="sm" weight="medium" numberOfLines={1} className="min-w-0 flex-1">
                    {n.title}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {fmtDate(n.date)}
                  </Text>
                </Pressable>
              ))}
            </Divided>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming events"
          className={COL1}
          headerAction={<ViewAll to="/events" />}
          testID="card-events"
        >
          {events.length === 0 ? (
            <EmptyState message="No upcoming events." />
          ) : (
            <Divided>
              {events.slice(0, 5).map((e) => {
                const date = new Date(e.date);
                return (
                  <View key={e.id} className="flex-row items-center gap-3 py-2.5">
                    <View className="border-border w-11 items-center rounded-md border py-1">
                      <Text
                        weight="semibold"
                        color="mutedForeground"
                        className="text-[10px] leading-3"
                      >
                        {date.toLocaleString('en-GB', { month: 'short' }).toUpperCase()}
                      </Text>
                      <Text size="base" weight="bold" tabular className="leading-[18px]">
                        {date.getDate()}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text size="sm" weight="medium" numberOfLines={1}>
                        {e.title}
                      </Text>
                      {e.location ? (
                        <View className="flex-row items-center gap-1">
                          <Icon icon={MapPin} size={12} color="mutedForeground" />
                          <Text size="xs" color="mutedForeground" numberOfLines={1}>
                            {e.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Divided>
          )}
        </SectionCard>
      </View>
      <View className="h-2 sm:hidden" />
    </PageLayout>
  );
}
