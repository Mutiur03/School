/**
 * Admin overview, replicating dashboard/src/pages/Admin/Dashboard.tsx: header with date and
 * counts plus quick actions, KPI strip, Attendance chart + Exams, Recent notices + Upcoming
 * events. All figures are MOCK DATA until the admin overview query is wired.
 * `?state=loading|error|empty` previews the page states (used by the screenshot checks).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, CalendarPlus, ChevronRight, MapPin, UserCheck } from '@/components/ui/icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Chip, MockDataBadge, type ChipTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LineChart } from '@/components/ui/LineChart';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  ATTENDANCE_RANGES,
  MOCK_OVERVIEW,
  mockAttendance,
  type AttendanceRange,
  type MockOverview,
} from '@/features/overview/mock-data';
import { useMinWidth } from '@/hooks/useBreakpoint';
import type { NavHref } from '@/navigation/nav-items';
import { useTheme } from '@/theme/ThemeProvider';

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type ExamStatus = 'Ongoing' | 'Upcoming' | 'Completed';
const STATUS_TONE: Record<ExamStatus, ChipTone> = {
  Ongoing: 'emerald',
  Upcoming: 'blue',
  Completed: 'muted',
};
const STATUS_ORDER: Record<ExamStatus, number> = { Ongoing: 0, Upcoming: 1, Completed: 2 };
const examStatus = (e: MockOverview['examSchedule'][number], now: Date): ExamStatus => {
  if (new Date(e.start_date) > now) return 'Upcoming';
  if (new Date(e.end_date) >= now) return 'Ongoing';
  return 'Completed';
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
      style={styles.viewAll}
    >
      <Text size="xs" weight="medium" color={hovered ? 'foreground' : 'mutedForeground'}>
        View all
      </Text>
      <Icon icon={ChevronRight} size={14} color={hovered ? 'foreground' : 'mutedForeground'} />
    </Pressable>
  );
}

function Divided({ children }: { children: ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dividedList}>
      {children.map((child, i) => (
        <View
          key={i}
          style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
        >
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
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  to: NavHref;
  style: object;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate(to)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={`kpi-${label}`}
      style={[styles.kpi, style, hovered && { backgroundColor: `${colors.muted}80` }]}
    >
      <View style={styles.kpiLabel}>
        <Text size="xs" weight="medium" color="mutedForeground">
          {label}
        </Text>
        <View style={{ opacity: hovered ? 1 : 0 }}>
          <Icon icon={ChevronRight} size={14} color="mutedForeground" />
        </View>
      </View>
      <Text size="xl" weight="semibold" tabular style={styles.kpiValue}>
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
  const { colors, radii, shadows } = useTheme();
  return (
    <View
      role="group"
      accessibilityLabel="Date range"
      style={[
        styles.range,
        {
          backgroundColor: `${colors.muted}66`,
          borderColor: colors.border,
          borderRadius: radii.lg,
        },
      ]}
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
            style={[
              styles.rangeBtn,
              {
                borderRadius: radii.md,
                backgroundColor: active ? colors.card : 'transparent',
                boxShadow: active ? shadows.sm : undefined,
              },
            ]}
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

function LoadingSkeleton({ lg }: { lg: boolean }) {
  return (
    <View style={styles.stack} testID="overview-loading">
      <Skeleton width={224} height={40} radius={10.56} />
      <Skeleton height={96} radius={14.56} />
      <View style={[styles.grid, lg && styles.row]}>
        <View style={lg ? styles.col2 : undefined}>
          <Skeleton height={320} radius={14.56} />
        </View>
        <View style={lg ? styles.col1 : undefined}>
          <Skeleton height={320} radius={14.56} />
        </View>
      </View>
      <View style={[styles.grid, lg && styles.row]}>
        <View style={lg ? styles.col1 : undefined}>
          <Skeleton height={224} radius={14.56} />
        </View>
        <View style={lg ? styles.col1 : undefined}>
          <Skeleton height={224} radius={14.56} />
        </View>
      </View>
    </View>
  );
}

export default function OverviewScreen() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const lg = useMinWidth('lg');
  const sm = useMinWidth('sm');
  const [days, setDays] = useState<AttendanceRange>(7);
  const attendance = useMemo(() => (state === 'empty' ? [] : mockAttendance(days)), [days, state]);

  const SERIES = [
    { key: 'present', label: 'Present', color: colors.primary },
    { key: 'absent', label: 'Absent', color: colors.seriesAbsent },
    { key: 'run_awayed', label: 'Ran away', color: colors.seriesRanAway },
  ] as const;

  if (state === 'loading') {
    return (
      <PageLayout title="Dashboard" badge={<MockDataBadge />}>
        <LoadingSkeleton lg={lg} />
      </PageLayout>
    );
  }
  if (state === 'error') {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        message="Preview of the error state (MOCK DATA)."
        onRetry={() => router.setParams({ state: '' })}
      />
    );
  }

  const data: MockOverview =
    state === 'empty'
      ? { ...MOCK_OVERVIEW, announcements: [], events: [], examSchedule: [] }
      : MOCK_OVERVIEW;
  const { quickStats, announcements, events, examSchedule } = data;
  const now = new Date();
  const latest = attendance.at(-1);
  const latestTotal = latest ? latest.present + latest.absent + latest.run_awayed : 0;
  const latestRate =
    latest && latestTotal ? Math.round((latest.present / latestTotal) * 100) : null;

  const kpis: { label: string; value: string; hint?: string; to: NavHref }[] = [
    { label: 'Students', value: quickStats.students.toLocaleString(), to: '/students' },
    { label: 'Teachers', value: quickStats.teachers.toLocaleString(), to: '/soon/teachers' },
    { label: 'Upcoming events', value: quickStats.events.toLocaleString(), to: '/soon/events' },
    {
      label: 'Attendance',
      value: latestRate === null ? '—' : `${latestRate}%`,
      hint: latest ? `${latest.present} of ${latestTotal} · ${latest.name}` : 'No records yet',
      to: '/attendance',
    },
  ];

  const exams = examSchedule
    .map((e) => ({ ...e, status: examStatus(e, now) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const dateLine = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageLayout
      title="Dashboard"
      badge={<MockDataBadge />}
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
            onPress={() => router.navigate('/soon/notice')}
          />
          <Button
            variant="outline"
            size="sm"
            icon={CalendarPlus}
            label="Add event"
            onPress={() => router.navigate('/soon/events')}
          />
        </>
      }
    >
      <View
        accessibilityLabel="Key figures"
        testID="kpi-strip"
        style={[
          styles.kpiStrip,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 14.56,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
          },
        ]}
      >
        {kpis.map((kpi, i) => (
          <Kpi
            key={kpi.label}
            {...kpi}
            style={{
              width: lg ? '25%' : '50%',
              borderColor: colors.border,
              borderLeftWidth: i % 2 === 1 || (lg && i === 2) ? 1 : 0,
              borderTopWidth: !lg && i >= 2 ? 1 : 0,
            }}
          />
        ))}
      </View>

      <View style={[styles.grid, lg && styles.row]}>
        <SectionCard
          title="Attendance"
          style={lg ? styles.col2 : undefined}
          headerAction={<RangeToggle value={days} onChange={setDays} />}
          testID="card-attendance"
        >
          <View style={styles.legend}>
            {SERIES.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text size="xs" color="mutedForeground">
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
          {attendance.length > 0 ? (
            <LineChart data={attendance} series={SERIES} />
          ) : (
            <EmptyState message="No attendance recorded in this range." />
          )}
        </SectionCard>

        <SectionCard
          title="Exams"
          style={lg ? styles.col1 : undefined}
          headerAction={<ViewAll to="/soon/add-exam" />}
          testID="card-exams"
        >
          {exams.length === 0 ? (
            <EmptyState message="No exams scheduled." />
          ) : (
            <Divided>
              {exams.slice(0, 6).map((exam) => (
                <View key={`${exam.name}-${exam.start_date}`} style={styles.listRow}>
                  <View style={styles.flex}>
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

      <View style={[styles.grid, lg && styles.row]}>
        <SectionCard
          title="Recent notices"
          style={lg ? styles.col1 : undefined}
          headerAction={<ViewAll to="/soon/notice" />}
          testID="card-notices"
        >
          {announcements.length === 0 ? (
            <EmptyState message="No recent notices." />
          ) : (
            <Divided>
              {announcements.slice(0, 5).map((n) => (
                <View key={n.id} style={[styles.listRow, styles.center]}>
                  <Text size="sm" weight="medium" numberOfLines={1} style={styles.flex}>
                    {n.title}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {fmtDate(n.date)}
                  </Text>
                </View>
              ))}
            </Divided>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming events"
          style={lg ? styles.col1 : undefined}
          headerAction={<ViewAll to="/soon/events" />}
          testID="card-events"
        >
          {events.length === 0 ? (
            <EmptyState message="No upcoming events." />
          ) : (
            <Divided>
              {events.slice(0, 5).map((e) => {
                const date = new Date(e.date);
                return (
                  <View key={e.id} style={[styles.listRow, styles.center]}>
                    <View
                      style={[styles.dateBox, { borderColor: colors.border, borderRadius: 8.56 }]}
                    >
                      <Text weight="semibold" color="mutedForeground" style={styles.dateMonth}>
                        {date.toLocaleString('en-GB', { month: 'short' }).toUpperCase()}
                      </Text>
                      <Text size="base" weight="bold" tabular style={styles.dateDay}>
                        {date.getDate()}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text size="sm" weight="medium" numberOfLines={1}>
                        {e.title}
                      </Text>
                      {e.location ? (
                        <View style={styles.location}>
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
      {sm ? null : <View style={styles.bottomSpacer} />}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  grid: { gap: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // CSS grid parity (lg:grid-cols-3 gap-6 + col-span-2): basis 24 on the wide column makes it
  // exactly two columns plus one gap.
  col1: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  col2: { flexGrow: 2, flexShrink: 1, flexBasis: 24, minWidth: 0 },
  kpiStrip: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, overflow: 'hidden' },
  kpi: { paddingHorizontal: 20, paddingVertical: 16 },
  kpiLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiValue: { marginTop: 2 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 2, borderWidth: 1 },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dividedList: { marginVertical: -8 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  center: { alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  dateBox: { width: 44, borderWidth: 1, alignItems: 'center', paddingVertical: 4 },
  dateMonth: { fontSize: 10, lineHeight: 12 },
  dateDay: { lineHeight: 18 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottomSpacer: { height: 8 },
});
