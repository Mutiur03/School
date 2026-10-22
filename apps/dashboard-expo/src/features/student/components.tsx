/**
 * Building blocks ported from the web student pages: StatsCard (components/StatsCard.tsx),
 * the profile hero (pages/Students/StudentDashboard.tsx), the attendance calendar
 * (components/students/StudentAttendanceView.tsx) and the marks table
 * (pages/Students/MarkSheetDisplay.tsx).
 */
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { openFileUrl } from '@/lib/files/open-url';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Paperclip,
  TrendingUp,
  XCircle,
} from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { appConfig } from '@/config/env';
import type {
  Notice,
  StudentAttendance,
  StudentAttendanceDay,
  StudentProfile,
  SubjectMark,
} from '@/lib/api';
import { totalMarks } from '@/lib/api';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/tenant/branding';
import { useTheme } from '@/theme/ThemeProvider';
import { calendarCells, formatDate, MONTHS, WEEKDAYS } from './format';

type StatColor = 'default' | 'amber' | 'emerald' | 'red' | 'blue' | 'indigo';
// Web: label always muted; the colour goes on the value and the icon tile.
const STAT: Record<StatColor, { value: string; icon?: string }> = {
  default: { value: 'text-foreground' },
  amber: { value: 'text-amber-600', icon: '#fe9a00' },
  emerald: { value: 'text-emerald-600', icon: '#00bc7d' },
  red: { value: 'text-red-600', icon: '#fb2c36' },
  blue: { value: 'text-primary' },
  indigo: { value: 'text-primary', icon: '#615fff' },
};

export function StatsCard({
  label,
  value,
  color = 'default',
  icon,
  loading,
  testID,
}: {
  label: string;
  value: string | number;
  color?: StatColor;
  icon?: LucideIcon;
  loading?: boolean;
  testID?: string;
}) {
  const { shadows } = useTheme();
  const c = STAT[color];
  return (
    <View
      testID={testID}
      className="border-border bg-card min-w-[140px] flex-1 basis-full flex-row items-start justify-between rounded-xl border p-6 sm:basis-[45%] lg:basis-[22%]"
      style={{ boxShadow: shadows.sm }}
    >
      <View className="shrink">
        <Text size="sm" weight="medium" color="mutedForeground" className="mb-1">
          {label}
        </Text>
        {loading ? (
          <View className="mt-1">
            <Skeleton height={32} width={60} />
          </View>
        ) : (
          <Text size="2xl" weight="bold" tabular className={c.value}>
            {value}
          </Text>
        )}
      </View>
      {icon ? (
        <View className="bg-muted/50 rounded-lg p-2">
          <Icon
            icon={icon}
            size={20}
            color={color === 'blue' ? 'primary' : 'mutedForeground'}
            rawColor={c.icon}
          />
        </View>
      ) : null}
    </View>
  );
}

export function Photo({
  name,
  url,
  width = 96,
}: {
  name: string;
  url: string | null;
  width?: number;
}) {
  const style = { width, height: (width * 9) / 7 };
  return url ? (
    <Image
      source={{ uri: url }}
      accessibilityLabel={name}
      style={style}
      className="border-border rounded-md border"
    />
  ) : (
    <View
      style={style}
      className="border-border bg-muted items-center justify-center rounded-md border"
    >
      <Text weight="bold" color="mutedForeground" className="text-3xl">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export const fileUrl = (key: string | null | undefined) => resolveFileUrl(key, appConfig.cdnUrl);

export function ProfileBadges({ profile, extra }: { profile: StudentProfile; extra?: ReactNode }) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      <Badge variant="secondary" label={`Class ${profile.class}`} />
      <Badge variant="secondary" label={`Section ${profile.section}`} />
      <Badge variant="secondary" label={`Roll ${profile.roll}`} />
      {profile.group ? <Badge variant="outline" label={profile.group} /> : null}
      {extra}
    </View>
  );
}

/** `rounded-2xl border bg-muted/30 p-6` panel used for the hero blocks on the web pages. */
export function Hero({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="border-border bg-muted/30 rounded-2xl border p-5 sm:p-8">
      {children}
    </View>
  );
}

const DAY_META: Record<
  StudentAttendanceDay['status'],
  { label: string; short: string; cell: string; text: string }
> = {
  present: {
    label: 'Present',
    short: 'P',
    cell: 'bg-emerald-500/15 border-emerald-200/50',
    text: 'text-emerald-700',
  },
  absent: {
    label: 'Absent',
    short: 'A',
    cell: 'bg-red-500/15 border-red-200/50',
    text: 'text-red-700',
  },
  'run-awayed': {
    label: 'Run awayed',
    short: 'R',
    cell: 'bg-amber-500/15 border-amber-200/50',
    text: 'text-amber-700',
  },
  unknown: {
    label: 'Unknown',
    short: '?',
    cell: 'bg-muted border-border',
    text: 'text-muted-foreground',
  },
};

export function AttendanceStats({
  data,
  loading,
  rateOnly,
}: {
  data: StudentAttendance | undefined;
  loading: boolean;
  /** Home card: Present / Absent / Marked days / Rate (StudentDashboard.tsx). */
  rateOnly?: boolean;
}) {
  const s = data?.stats;
  const rate = s?.attendanceRate != null ? `${s.attendanceRate}%` : '—';
  return (
    <View className="flex-row flex-wrap gap-3" testID="attendance-stats">
      <StatsCard
        label="Present"
        value={s?.present ?? 0}
        color="emerald"
        icon={CheckCircle2}
        loading={loading}
        testID="stat-present"
      />
      <StatsCard
        label="Absent"
        value={s?.absent ?? 0}
        color="red"
        icon={XCircle}
        loading={loading}
        testID="stat-absent"
      />
      {rateOnly ? (
        <StatsCard
          label="Marked days"
          value={s?.total ?? 0}
          color="blue"
          icon={CalendarDays}
          loading={loading}
          testID="stat-total"
        />
      ) : (
        <StatsCard
          label="Run awayed"
          value={s?.runAwayed ?? 0}
          color="amber"
          icon={AlertTriangle}
          loading={loading}
          testID="stat-ran"
        />
      )}
      <StatsCard
        label="Attendance rate"
        value={rate}
        color={rateOnly ? 'indigo' : 'blue'}
        icon={TrendingUp}
        loading={loading}
        testID="stat-rate"
      />
    </View>
  );
}

export function MonthStepper({
  month,
  year,
  onStep,
  noFuture,
}: {
  month: number;
  year: number;
  onStep: (delta: number) => void;
  /** Attendance history: the current month is the last one. */
  noFuture?: boolean;
}) {
  const now = new Date();
  const atLatest =
    !!noFuture &&
    (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth()));
  return (
    <View className="border-border flex-row items-center gap-1 rounded-lg border p-1">
      <Button
        variant="ghost"
        size="icon-sm"
        icon={ChevronLeft}
        accessibilityLabel="Previous month"
        onPress={() => onStep(-1)}
      />
      <Text
        size="sm"
        weight="medium"
        tabular
        className="min-w-[144px] text-center"
        testID="month-label"
      >
        {MONTHS[month]} {year}
      </Text>
      <Button
        variant="ghost"
        size="icon-sm"
        icon={ChevronRight}
        accessibilityLabel="Next month"
        disabled={atLatest}
        onPress={() => onStep(1)}
      />
    </View>
  );
}

export function AttendanceCalendar({
  year,
  month,
  data,
  loading,
  fetching,
}: {
  year: number;
  month: number;
  data: StudentAttendance | undefined;
  loading: boolean;
  fetching: boolean;
}) {
  const byDate = new Map((data?.records ?? []).map((r) => [r.date, r]));
  const cells = calendarCells(year, month);
  return (
    <View className="border-border overflow-hidden rounded-xl border" testID="attendance-calendar">
      <View className="border-border bg-muted/40 flex-row border-b">
        {WEEKDAYS.map((d) => (
          <View key={d} className="flex-1 items-center py-2">
            <Text size="xs" weight="semibold" caps color="mutedForeground" className="text-[11px]">
              {d}
            </Text>
          </View>
        ))}
      </View>
      <View className={cn('flex-row flex-wrap p-2', fetching && 'opacity-70')}>
        {loading
          ? Array.from({ length: 35 }, (_, i) => (
              <View key={i} className="w-[14.2857%] p-0.5">
                <Skeleton height={56} className="rounded-md" />
              </View>
            ))
          : cells.map((cell, i) => {
              if (!cell) return <View key={`e${i}`} className="h-14 w-[14.2857%]" />;
              const rec = byDate.get(cell.date);
              const meta = rec ? DAY_META[rec.status] : null;
              return (
                <View key={cell.date} className="w-[14.2857%] p-0.5">
                  <View
                    testID={`cal-${cell.day}`}
                    accessibilityLabel={`${cell.day} ${MONTHS[month]}${meta ? `: ${meta.label}` : ''}`}
                    className={cn(
                      'h-14 items-center justify-center gap-0.5 rounded-md border',
                      meta ? meta.cell : 'border-border/60 bg-background',
                    )}
                  >
                    <Text
                      size="xs"
                      weight="semibold"
                      className={meta ? meta.text : 'text-muted-foreground'}
                    >
                      {cell.day}
                    </Text>
                    {meta ? (
                      <Text weight="bold" caps className={cn('text-[10px]', meta.text)}>
                        {meta.short}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
      </View>
    </View>
  );
}

export function RecentDays({ data }: { data: StudentAttendance | undefined }) {
  const recent = [...(data?.records ?? [])].reverse().slice(0, 8);
  if (!recent.length) return null;
  return (
    <SectionCard title="Recent marked days" noPadding>
      {recent.map((r, i) => (
        <View
          key={r.id || r.date}
          className={cn(
            'flex-row items-center justify-between px-5 py-3',
            i > 0 && 'border-border border-t',
          )}
        >
          <Text size="sm">{formatDate(r.date)}</Text>
          <Text size="sm" weight="medium" className={DAY_META[r.status].text}>
            {DAY_META[r.status].label}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}

export function MarksTable({ rows }: { rows: readonly SubjectMark[] }) {
  return (
    <View testID="marks-table">
      <View className="bg-muted/40 border-border flex-row border-b">
        <Text size="sm" weight="semibold" className="flex-1 px-5 py-3.5">
          Subject
        </Text>
        <Text size="sm" weight="semibold" className="w-32 px-5 py-3.5 text-center">
          Marks
        </Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={`${r.subject}-${i}`}
          testID="mark-row"
          className={cn('flex-row items-center', i > 0 && 'border-border border-t')}
        >
          <Text size="sm" weight="medium" className="flex-1 px-5 py-3.5">
            {r.subject}
          </Text>
          <Text
            size="sm"
            weight="semibold"
            color="primary"
            tabular
            className="w-32 px-5 py-3.5 text-center"
          >
            {r.marks ?? '—'}
          </Text>
        </View>
      ))}
      <View className="bg-muted/20 border-border flex-row border-t">
        <Text size="sm" weight="semibold" className="flex-1 px-5 py-3.5">
          Total
        </Text>
        <Text
          size="sm"
          weight="semibold"
          color="primary"
          tabular
          className="w-32 px-5 py-3.5 text-center"
          testID="marks-total"
        >
          {totalMarks(rows)}
        </Text>
      </View>
    </View>
  );
}

/** Same as the admin Notice page: open the public CDN file (getFileUrl(notice.file)); native PDFs use the viewer. */
export async function openNoticeFile(notice: Notice) {
  const url = fileUrl(notice.file) ?? notice.download_url;
  if (!url) return false;
  return openFileUrl(url);
}

/**
 * One notice. A notice is a title, a date and an optional attachment, so there is no page to
 * open: tapping a row with an attachment opens the file itself.
 */
export function NoticeRow({ notice, first }: { notice: Notice; first?: boolean }) {
  const toast = useToast();
  const hasFile = !!(notice.file || notice.download_url);
  const open = () =>
    void openNoticeFile(notice).then(
      (ok) => ok || toast.error('This attachment is not available.'),
      () => toast.error("Couldn't open the attachment."),
    );
  const content = (
    <>
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="medium" numberOfLines={2}>
          {notice.title}
        </Text>
        <Text size="xs" color="mutedForeground" className="mt-0.5">
          {formatDate(notice.created_at)}
        </Text>
      </View>
      {hasFile ? <Icon icon={Paperclip} size={16} color="mutedForeground" /> : null}
      {hasFile ? <Icon icon={ExternalLink} size={16} color="mutedForeground" /> : null}
    </>
  );
  const box = cn(
    'min-h-[56px] flex-row items-center gap-3 px-5 py-3',
    !first && 'border-border border-t',
  );
  return hasFile ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open attachment of ${notice.title}`}
      testID={`notice-${notice.id}`}
      onPress={open}
      className={cn(box, 'hover:bg-muted/40 active:bg-muted/40')}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={`notice-${notice.id}`} className={box}>
      {content}
    </View>
  );
}
