/**
 * Attendance, replicating dashboard/src/pages/Admin/Attendence.tsx (used by both /admin and
 * /teacher on the web): class / section / month / year pickers, "Today" summary card, a
 * SectionCard sheet with a visible-days strip (Today / All), today's column editable as
 * present/absent, past days read-only, legend, an unsaved-changes bar with Discard, and
 * "Save & send SMS" (POST /api/attendance/save-and-send, the same call the web page makes).
 *
 * Desktop: the web table (sticky Roll + Student, one column per visible day, mark-all header).
 * Phones: a list with large Present / Absent toggles for today and the visible past days as
 * small status icons under each name.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateSMSCount } from '@school/shared-schemas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useLeaveGuard } from '@/navigation/LeaveGuard';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { Icon } from '@/components/ui/Icon';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  FileText,
  ChevronRight,
  Loader2,
  Send,
  WifiOff,
  XIcon,
} from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  isApiError,
  type AttendanceRecordRow,
  type AttendanceStatus,
  type AttendanceStudent,
  type SaveAttendancePayload,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useTenantStorage } from '@/tenant/useTenantStorage';
import { confirmDiscard } from './confirm';
import {
  applyToggle,
  attendanceSmsEstimate,
  parseStoredClass,
  ATTENDANCE_CLASSES,
  ATTENDANCE_SECTIONS,
  buildMaps,
  buildSavePayload,
  dayStats,
  daysInMonth,
  isMarkable,
  isoDate,
  MONTHS,
  recordedStatus,
  setAll,
  type LocalEdits,
} from './model';

const CLASS_STORAGE = 'attendance-class';
const segments = (text: string) => calculateSMSCount(text).count;

// Status colours from the web page (Tailwind v4 palette, see tailwind.palette.js).
const C = { present: '#009966', absent: '#fb2c36', ran: '#fe9a00' };

function StatusIcon({ status, size = 16 }: { status: AttendanceStatus | null; size?: number }) {
  if (status === 'present')
    return (
      <View accessibilityLabel="Present">
        <Icon icon={Check} size={size} rawColor={C.present} />
      </View>
    );
  if (status === 'absent')
    return (
      <View accessibilityLabel="Absent">
        <Icon icon={XIcon} size={size} rawColor={C.absent} />
      </View>
    );
  if (status === 'run-awayed')
    return (
      <View accessibilityLabel="Ran away">
        <Icon icon={AlertTriangle} size={size} rawColor={C.ran} />
      </View>
    );
  return (
    <Text size="sm" color="mutedForeground" accessibilityLabel="Not marked">
      —
    </Text>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <View className="min-w-[72px]">
      <View className="flex-row items-center gap-1.5">
        {dot ? <View className={cn('h-1.5 w-1.5 rounded-full', dot)} /> : null}
        <Text size="xs" weight="medium" color="mutedForeground">
          {label}
        </Text>
      </View>
      <Text size="xl" weight="semibold" tabular className="mt-0.5">
        {value.toLocaleString()}
      </Text>
    </View>
  );
}

/** Web <select> stand-in: a row of chips (few options, large touch targets on phones). */
function ChipSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
  disabled,
  big,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  format: (v: T) => string;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cn(
        'border-control flex-row items-center gap-0.5 rounded-md border p-0.5',
        disabled && 'opacity-50',
      )}
    >
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            aria-checked={on}
            accessibilityLabel={format(o)}
            testID={`att-${label.toLowerCase()}-${o}`}
            disabled={disabled}
            onPress={() => onChange(o)}
            className={cn(
              'items-center justify-center rounded-sm px-2.5',
              big ? 'h-10 min-w-10' : 'h-7',
              on ? 'bg-primary' : 'hover:bg-muted active:bg-muted',
            )}
          >
            <Text size="sm" weight="medium" color={on ? 'primaryForeground' : 'foreground'} tabular>
              {format(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Checkbox({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
  testID,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      aria-checked={indeterminate ? 'mixed' : checked}
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      className={cn(
        'h-5 w-5 items-center justify-center rounded border',
        checked || indeterminate ? 'border-primary bg-primary' : 'border-control bg-background',
        disabled && 'opacity-40',
      )}
    >
      {checked ? <Icon icon={Check} size={14} color="primaryForeground" /> : null}
      {!checked && indeterminate ? <View className="bg-primary-foreground h-0.5 w-2.5" /> : null}
    </Pressable>
  );
}

function PresentToggle({
  student,
  status,
  onChange,
}: {
  student: AttendanceStudent;
  status: AttendanceStatus | null;
  onChange: (present: boolean) => void;
}) {
  if (status === 'run-awayed') {
    return (
      <View className="h-11 flex-row items-center gap-1.5 rounded-md bg-amber-100 px-3">
        <Icon icon={AlertTriangle} size={16} rawColor={C.ran} />
        <Text size="sm" weight="medium" className="text-amber-800">
          Ran away
        </Text>
      </View>
    );
  }
  const seg = (present: boolean) => {
    // Unmarked reads as absent, like the web checkbox left unticked (saved as absent).
    const implied = !present && status === null;
    const on = present ? status === 'present' : status === 'absent' || implied;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on, disabled: !student.available }}
        aria-checked={on}
        accessibilityLabel={`${student.name} ${present ? 'present' : 'absent'}`}
        testID={`att-${present ? 'present' : 'absent'}-${student.id}`}
        disabled={!student.available}
        onPress={() => onChange(present)}
        className={cn(
          // Icon-only so the name column gets the width; 44px keeps the touch target.
          'h-11 w-11 items-center justify-center rounded-sm',
          on && (present ? 'bg-emerald-600' : implied ? 'bg-red-100' : 'bg-red-500'),
        )}
      >
        <Icon
          icon={present ? Check : XIcon}
          size={20}
          rawColor={on && !implied ? '#ffffff' : present ? C.present : C.absent}
        />
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      className={cn(
        'border-control flex-row gap-0.5 rounded-md border p-0.5',
        !student.available && 'opacity-40',
      )}
    >
      {seg(true)}
      {seg(false)}
    </View>
  );
}

export function AttendanceScreen() {
  const mobile = useBreakpoint() === 'mobile';
  const { attendance } = useApi();
  const { resolution } = useTenant();
  const storage = useTenantStorage();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const todayDay = now.getDate();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [level, setLevel] = useState<number | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [visibleDays, setVisibleDays] = useState<number[]>([todayDay]);
  const [edits, setEdits] = useState<LocalEdits>({});
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(
    null,
  );
  // Same as web: remember the last class on this device and start on its section A.
  useEffect(() => {
    let alive = true;
    void storage
      .get(CLASS_STORAGE)
      .then((raw) => {
        const c = parseStoredClass(raw);
        if (alive && c) {
          setLevel((cur) => cur ?? c);
          setSection((cur) => cur ?? ATTENDANCE_SECTIONS[0]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storage]);
  const saving = useRef(false);
  const dayStrip = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const todayIso = isoDate(now.getFullYear(), now.getMonth(), todayDay);
  const sel = level && section ? { year, level, section } : null;
  const key = (...parts: unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'attendance', ...parts);

  const studentsQ = useQuery({
    queryKey: key('students', sel),
    queryFn: ({ signal }) => attendance.students(sel!, signal),
    enabled: !!sel,
    staleTime: 30_000,
  });
  const recordsQ = useQuery({
    queryKey: key('records', sel, month),
    queryFn: ({ signal }) => attendance.records({ ...sel!, month }, signal),
    enabled: !!sel,
  });
  const statsQ = useQuery({
    queryKey: key('stats', sel, todayIso),
    queryFn: ({ signal }) => attendance.stats({ ...sel!, date: todayIso }, signal),
    enabled: !!sel,
  });

  const smsQ = useQuery({
    queryKey: key('sms-public'),
    queryFn: ({ signal }) => attendance.smsSettings(signal),
    enabled: !!sel,
    staleTime: 5_000,
  });

  const save = useMutation({
    mutationFn: (vars: { payload: SaveAttendancePayload; month: number }) =>
      attendance.saveAndSend(vars.payload),
    onSuccess: (res, { payload, month: m }) => {
      // Write the saved day into the cached month right away, so the sheet never shows stale
      // data (and a second Save can't resend it) while the refetch below is in flight.
      const sel0 = { year: payload.year, level: payload.level, section: payload.section };
      queryClient.setQueryData<AttendanceRecordRow[]>(key('records', sel0, m), (prev = []) => {
        const byStudent = new Map(payload.records.map((r) => [r.studentId, r.status]));
        const kept = prev.filter((r) => !(r.date === payload.date && byStudent.has(r.student_id)));
        return [
          ...kept,
          ...payload.records.map((r) => ({
            id: 0,
            student_id: r.studentId,
            date: payload.date,
            status: r.status,
            send_msg: false,
          })),
        ];
      });
      setEdits({});
      setNotice(
        res.smsError
          ? { tone: 'warn', text: `Attendance saved, but SMS failed: ${res.smsError}` }
          : {
              tone: 'ok',
              text: `Attendance saved (${res.present} present, ${res.absent} absent).`,
            },
      );
    },
    onError: (e) => {
      const offline = isApiError(e) && (e.kind === 'network' || e.kind === 'timeout');
      setNotice({
        tone: 'error',
        text: offline
          ? "Couldn't reach the server. Your changes are kept; check the connection and save again."
          : `${e.message || 'Failed to save attendance'}. Your changes are kept.`,
      });
    },
    onSettled: async () => {
      // Refresh every attendance query of this school (sheet, students, today's stats/SMS),
      // and keep Save locked until that is done.
      await queryClient.invalidateQueries({ queryKey: key() }).catch(() => {});
      saving.current = false;
      setRefreshing(false);
    },
  });

  const students = useMemo(() => studentsQ.data ?? [], [studentsQ.data]);
  const { attendance: saved } = useMemo(
    () => buildMaps(recordsQ.data ?? [], year, month),
    [recordsQ.data, year, month],
  );
  const unsaved = Object.keys(edits).length;
  const status = (id: number, day: number) => recordedStatus(edits, saved, id, day);
  const sentMap = useMemo(
    () => buildMaps(recordsQ.data ?? [], year, month).sent,
    [recordsQ.data, year, month],
  );
  const smsCost = isCurrentMonth
    ? attendanceSmsEstimate(
        students,
        edits,
        saved,
        sentMap,
        smsQ.data,
        todayIso,
        todayDay,
        segments,
      ).cost
    : 0;
  const lowBalance = smsCost > 0 && (smsQ.data?.sms_balance ?? 0) < smsCost;

  // In-app guard: the sidebar, tab bar, menus and Android back ask before dropping ticks.
  useLeaveGuard(unsaved > 0, {
    title: 'Leave without saving?',
    message: `${unsaved} unsaved attendance ${unsaved === 1 ? 'change is' : 'changes are'} lost if you leave this page now.`,
  });

  // Web: beforeunload guard while there are unsaved ticks.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || unsaved === 0) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [unsaved]);

  const okToDiscard = async (what: string) => {
    if (unsaved === 0) return true;
    const ok = await confirmDiscard(
      `You have unsaved attendance. Changing the ${what} will discard it.`,
    );
    if (ok) setEdits({});
    return ok;
  };
  const changeLevel = async (v: number) => {
    if (v === level || !(await okToDiscard('class'))) return;
    setLevel(v);
    setSection(ATTENDANCE_SECTIONS[0]);
    setNotice(null);
    void storage.set(CLASS_STORAGE, String(v)).catch(() => {});
  };
  const changeSection = async (v: string) => {
    if (v !== section && (await okToDiscard('section'))) setSection(v);
  };
  const changeYear = async (y: number) => {
    if (y !== year && (await okToDiscard('year'))) setYear(y);
  };
  const exportPdf = async () => {
    if (!sel || exporting) return;
    if (unsaved > 0) {
      const ok = await confirmDiscard(
        'You have unsaved attendance changes. Export uses saved data only. Continue?',
        { title: 'Unsaved changes', confirmLabel: 'Export anyway' },
      );
      if (!ok) return;
    }
    setExporting(true);
    try {
      const r = await openPdf(
        () => attendance.sheetPdf({ year, month, level: sel.level, section: sel.section }),
        pdfFileName(['attendance', `class-${sel.level}`, sel.section, MONTHS[month], year]),
      );
      if (r === 'unavailable') toast.error("This device can't open the PDF.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to export attendance sheet');
    } finally {
      setExporting(false);
    }
  };
  const stepMonth = async (delta: number) => {
    if (!(await okToDiscard('month'))) return;
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const markable = students.filter((s) => isMarkable(s, edits, saved, todayDay));
  const markedPresent = markable.filter((s) => status(s.id, todayDay) === 'present').length;
  const today = isCurrentMonth
    ? dayStats(students, edits, saved, todayDay)
    : {
        total:
          (statsQ.data?.present ?? 0) + (statsQ.data?.absent ?? 0) + (statsQ.data?.runAwayed ?? 0),
        present: statsQ.data?.present ?? 0,
        absent: statsQ.data?.absent ?? 0,
        runAwayed: statsQ.data?.runAwayed ?? 0,
        notMarked: 0,
      };
  const sms = statsQ.data?.sms;

  const toggle = (id: number, present: boolean) =>
    setEdits((e) => applyToggle(e, saved, id, todayDay, present));

  const loading = !!sel && (studentsQ.isPending || recordsQ.isPending);
  const loadError = studentsQ.error ?? recordsQ.error;
  const canSave =
    !save.isPending &&
    !refreshing &&
    !!sel &&
    isCurrentMonth &&
    students.length > 0 &&
    !loading &&
    !loadError;

  const onSave = () => {
    if (!sel || !canSave || unsaved === 0 || saving.current) return; // double-submit guard
    saving.current = true;
    setNotice(null);
    setRefreshing(true);
    save.mutate({
      payload: buildSavePayload(students, edits, saved, { ...sel, month, day: todayDay }),
      month,
    });
  };

  const saveButton = (testID: string, className?: string) => (
    <Button
      testID={testID}
      className={className}
      label={save.isPending ? 'Saving…' : 'Save & send SMS'}
      icon={save.isPending ? Loader2 : Send}
      disabled={!canSave || unsaved === 0}
      onPress={onSave}
      size={mobile ? 'lg' : 'default'}
    />
  );

  const nDays = daysInMonth(year, month);
  const allDays = Array.from({ length: nDays }, (_, i) => i + 1);
  const days = visibleDays.filter((d) => d <= nDays);
  const isToday = (d: number) => isCurrentMonth && d === todayDay;
  const pastDays = days.filter((d) => !isToday(d));
  const activeCount = students.filter((s) => s.available).length;

  const body = !sel ? (
    <EmptyState message="Pick a class and section to take attendance." />
  ) : loadError && !studentsQ.data ? (
    <ErrorState
      title="Couldn't load attendance"
      message={loadError.message}
      onRetry={() => {
        void studentsQ.refetch();
        void recordsQ.refetch();
      }}
    />
  ) : !loading && students.length === 0 ? (
    <EmptyState message="No students in this class." />
  ) : mobile ? (
    <View testID="att-list">
      {loading
        ? Array.from({ length: 6 }, (_, i) => (
            <View key={i} className={cn('px-4 py-3', i > 0 && 'border-border border-t')}>
              <Skeleton height={44} />
            </View>
          ))
        : students.map((s, i) => (
            <View
              key={s.id}
              testID={`att-row-${s.id}`}
              className={cn('px-4 py-2.5', i > 0 && 'border-border border-t')}
            >
              <View className="flex-row items-center gap-3">
                <Text size="sm" tabular color="mutedForeground" className="w-7">
                  {s.roll}
                </Text>
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <Text size="sm" weight="medium" numberOfLines={2} className="shrink">
                    {s.name}
                  </Text>
                  {s.available ? null : <StatusBadge status="inactive" />}
                </View>
                {isCurrentMonth && days.includes(todayDay) ? (
                  <PresentToggle
                    student={s}
                    status={status(s.id, todayDay)}
                    onChange={(p) => toggle(s.id, p)}
                  />
                ) : null}
              </View>
              {/* Full row width (under the toggle too), so many days don't wrap 3 per line. */}
              {pastDays.length ? (
                <View className="ml-10 mt-1 flex-row flex-wrap gap-y-1">
                  {pastDays.map((d) => (
                    <View key={d} className="w-8 flex-row items-center gap-0.5">
                      <Text size="xs" color="mutedForeground" tabular>
                        {d}
                      </Text>
                      <StatusIcon status={status(s.id, d)} size={12} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
    </View>
  ) : (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }} testID="att-table">
      <View className="min-w-full">
        <View className="bg-muted border-border flex-row border-b">
          <View className="w-16 px-3 py-2.5">
            <Text size="xs" weight="semibold" caps className="text-foreground/70">
              Roll
            </Text>
          </View>
          <View className="w-56 px-3 py-2.5">
            <Text size="xs" weight="semibold" caps className="text-foreground/70">
              Student
            </Text>
          </View>
          {days.map((d) => (
            <View
              key={d}
              className={cn(
                'w-12 items-center justify-center gap-1 px-1 py-2',
                isToday(d) && 'bg-primary/5',
              )}
            >
              <Text
                size="xs"
                weight="semibold"
                tabular
                color={isToday(d) ? 'primary' : undefined}
                className={isToday(d) ? undefined : 'text-foreground/70'}
              >
                {d}
              </Text>
              {isToday(d) ? (
                <Checkbox
                  testID="att-mark-all"
                  label="Mark everyone present today"
                  disabled={markable.length === 0}
                  checked={markable.length > 0 && markedPresent === markable.length}
                  indeterminate={markedPresent > 0 && markedPresent < markable.length}
                  onChange={(v) => setEdits((e) => setAll(students, e, saved, todayDay, v))}
                />
              ) : null}
            </View>
          ))}
          <View className="flex-1" />
        </View>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <View key={i} className="border-border border-t px-4 py-2">
                <Skeleton height={32} />
              </View>
            ))
          : students.map((s, i) => (
              <View
                key={s.id}
                testID={`att-row-${s.id}`}
                className={cn(
                  'bg-card hover:bg-muted/60 flex-row items-center',
                  i > 0 && 'border-border border-t',
                )}
              >
                <View className="w-16 px-3 py-2">
                  <Text size="sm" tabular color={s.available ? undefined : 'mutedForeground'}>
                    {s.roll}
                  </Text>
                </View>
                <View className="w-56 flex-row items-center gap-2 px-3 py-2">
                  <Text
                    size="sm"
                    weight="medium"
                    numberOfLines={1}
                    className="shrink"
                    color={s.available ? undefined : 'mutedForeground'}
                  >
                    {s.name}
                  </Text>
                  {s.available ? null : <StatusBadge status="inactive" />}
                </View>
                {days.map((d) => {
                  const st = status(s.id, d);
                  return (
                    <View
                      key={d}
                      className={cn(
                        'h-10 w-12 items-center justify-center',
                        isToday(d) && 'bg-primary/5',
                      )}
                    >
                      {isToday(d) && st !== 'run-awayed' ? (
                        <Checkbox
                          testID={`att-check-${s.id}`}
                          label={`${s.name} present today`}
                          checked={st === 'present'}
                          disabled={!s.available}
                          onChange={(v) => toggle(s.id, v)}
                        />
                      ) : (
                        <StatusIcon status={st} />
                      )}
                    </View>
                  );
                })}
                <View className="flex-1" />
              </View>
            ))}
      </View>
    </ScrollView>
  );

  const noticeBox = notice ? (
    <View
      testID="att-notice"
      accessibilityRole="alert"
      className={cn(
        'flex-row items-start gap-3 rounded-md border px-4 py-3',
        notice.tone === 'ok' && 'border-emerald-200 bg-emerald-50',
        notice.tone === 'warn' && 'border-amber-200 bg-amber-50',
        notice.tone === 'error' && 'border-destructive/40 bg-destructive/10',
      )}
    >
      <Icon
        icon={notice.tone === 'ok' ? Check : notice.tone === 'warn' ? AlertTriangle : WifiOff}
        size={16}
        rawColor={notice.tone === 'ok' ? C.present : notice.tone === 'warn' ? C.ran : C.absent}
      />
      <Text size="sm" className="flex-1">
        {notice.text}
      </Text>
      {notice.tone === 'error' && unsaved > 0 ? (
        <Button size="sm" variant="outline" label="Retry" onPress={onSave} disabled={!canSave} />
      ) : null}
    </View>
  ) : null;

  return (
    <View className="flex-1" testID="attendance-screen">
      <PageLayout
        title="Attendance"
        actions={
          <>
            <Button
              variant="outline"
              icon={FileText}
              label={exporting ? 'Preparing…' : 'Export PDF'}
              disabled={!sel || exporting}
              onPress={() => void exportPdf()}
              testID="att-export"
            />
            {mobile ? null : saveButton('att-save')}
          </>
        }
      >
        <View className="-mt-4 flex-row flex-wrap items-center gap-2">
          <ChipSelect
            label="Class"
            options={ATTENDANCE_CLASSES}
            value={level}
            onChange={(v) => void changeLevel(v)}
            format={(c) => (mobile ? String(c) : `Class ${c}`)}
            big={mobile}
          />
          <ChipSelect
            label="Section"
            options={ATTENDANCE_SECTIONS}
            value={section}
            onChange={(v) => void changeSection(v)}
            format={(s) => (mobile ? s : `Section ${s}`)}
            disabled={!level}
            big={mobile}
          />
          <View
            accessibilityLabel="Month"
            className="border-control flex-row items-center rounded-md border"
          >
            <Button
              variant="ghost"
              size={mobile ? 'icon' : 'icon-sm'}
              icon={ChevronLeft}
              accessibilityLabel="Previous month"
              onPress={() => void stepMonth(-1)}
            />
            <Text
              size="sm"
              weight="medium"
              tabular
              className="min-w-[116px] text-center"
              testID="att-month"
            >
              {MONTHS[month]}
            </Text>
            <Button
              variant="ghost"
              size={mobile ? 'icon' : 'icon-sm'}
              icon={ChevronRight}
              accessibilityLabel="Next month"
              onPress={() => void stepMonth(1)}
            />
          </View>
          <Select
            label="Year"
            size="sm"
            value={year}
            options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => ({
              value: y,
              label: String(y),
            }))}
            onChange={(y) => void changeYear(y)}
          />
        </View>
        {smsCost > 0 ? (
          <Text
            size="xs"
            tabular
            color={lowBalance ? 'destructive' : 'mutedForeground'}
            weight={lowBalance ? 'medium' : 'regular'}
            testID="att-sms-estimate"
          >
            {`≈ ${smsCost} SMS credits${lowBalance ? ` · balance ${smsQ.data?.sms_balance} is not enough` : ''}`}
          </Text>
        ) : null}

        {noticeBox}

        <View
          testID="att-today"
          className="border-border bg-card flex-row flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-5 py-4"
        >
          <Text
            size="xs"
            weight="semibold"
            caps
            color="mutedForeground"
            className={mobile ? 'w-full' : undefined}
          >
            Today
          </Text>
          <Stat label="Students" value={today.total} />
          <Stat label="Present" value={today.present} dot="bg-emerald-500" />
          <Stat label="Absent" value={today.absent} dot="bg-red-500" />
          <Stat label="Ran away" value={today.runAwayed} dot="bg-amber-500" />
          {today.notMarked > 0 ? <Stat label="Not marked yet" value={today.notMarked} /> : null}
          <View className={cn(!mobile && 'border-border ml-auto border-l pl-8')}>
            <Text size="xs" weight="medium" color="mutedForeground">
              SMS
            </Text>
            <Text size="sm" color="mutedForeground" tabular className="mt-0.5">
              <Text size="sm" weight="semibold">
                {(sms?.successful ?? 0).toLocaleString()}
              </Text>{' '}
              sent
              {sms?.failed ? (
                <Text size="sm" color="destructive">
                  {' '}
                  · {sms.failed} failed
                </Text>
              ) : null}
              {sms?.pending ? ` · ${sms.pending} pending` : null}
            </Text>
          </View>
        </View>

        <SectionCard noPadding>
          <View className="border-border gap-3 border-b px-4 py-3">
            <Text size="sm" weight="semibold" testID="att-class-label">
              {sel ? `Class ${sel.level} ${sel.section}` : 'No class selected'}
              <Text size="sm" color="mutedForeground">
                {' '}
                · {activeCount.toLocaleString()} students · {MONTHS[month]} {year}
              </Text>
            </Text>
            <View className="flex-row items-center gap-2">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                ref={dayStrip}
                onContentSizeChange={() => {
                  // Start with today in view (the strip begins at day 1).
                  const step = (mobile ? 40 : 28) + 4;
                  dayStrip.current?.scrollTo({
                    x: Math.max(0, (todayDay - 4) * step),
                    animated: false,
                  });
                }}
                className="flex-1"
                accessibilityLabel="Visible days"
              >
                <View className="flex-row gap-1">
                  {allDays.map((d) => {
                    const on = days.includes(d);
                    return (
                      <Pressable
                        key={d}
                        testID={`att-day-${d}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Show day ${d}`}
                        accessibilityState={{ selected: on }}
                        aria-pressed={on}
                        onPress={() =>
                          setVisibleDays((p) =>
                            p.includes(d)
                              ? p.filter((x) => x !== d)
                              : [...p, d].sort((a, b) => a - b),
                          )
                        }
                        className={cn(
                          'items-center justify-center rounded-md',
                          mobile ? 'h-10 min-w-10' : 'h-7 min-w-7',
                          on ? 'bg-primary' : 'hover:bg-muted',
                          isToday(d) && !on && 'border-primary/40 border',
                        )}
                      >
                        <Text
                          size="xs"
                          weight="medium"
                          tabular
                          color={on ? 'primaryForeground' : 'mutedForeground'}
                        >
                          {d}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <Button
                variant="ghost"
                size="sm"
                label="Today"
                onPress={() => setVisibleDays([todayDay])}
              />
              <Button
                variant="ghost"
                size="sm"
                label="All"
                onPress={() => setVisibleDays(allDays)}
              />
            </View>
          </View>
          {body}
          <View className="border-border flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5">
            <View className="flex-row items-center gap-1">
              <Icon icon={Check} size={14} rawColor={C.present} />
              <Text size="xs" color="mutedForeground">
                Present
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Icon icon={XIcon} size={14} rawColor={C.absent} />
              <Text size="xs" color="mutedForeground">
                Absent
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Icon icon={AlertTriangle} size={14} rawColor={C.ran} />
              <Text size="xs" color="mutedForeground">
                Ran away (set from Running Away)
              </Text>
            </View>
            <Text size="xs" color="mutedForeground">
              — Not marked
            </Text>
          </View>
        </SectionCard>
        {!isCurrentMonth && sel ? (
          <Text size="xs" color="mutedForeground" className="text-center">
            Attendance can only be taken for today.
          </Text>
        ) : null}
        {/* Room for the floating bar. */}
        {unsaved > 0 || mobile ? (
          <View className={mobile && unsaved > 0 ? 'h-32' : 'h-20'} />
        ) : null}
      </PageLayout>

      {unsaved > 0 || (mobile && canSave) ? (
        <View
          pointerEvents="box-none"
          className="absolute bottom-4 left-0 right-0 items-center px-4"
        >
          <View
            testID="att-unsaved"
            accessibilityLabel="Unsaved attendance"
            className={cn(
              'bg-card border-border w-full max-w-xl rounded-xl border shadow-lg',
              mobile && unsaved > 0
                ? 'gap-2 p-3'
                : 'flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2',
            )}
          >
            <Text size="sm" weight="medium" tabular>
              {unsaved === 0
                ? 'No changes yet'
                : `${unsaved} unsaved ${unsaved === 1 ? 'change' : 'changes'}`}
            </Text>
            <View className="flex-row gap-2">
              {unsaved > 0 ? (
                <Button
                  variant={mobile ? 'outline' : 'ghost'}
                  size={mobile ? 'lg' : 'sm'}
                  label="Discard"
                  onPress={() => setEdits({})}
                  disabled={save.isPending}
                />
              ) : null}
              {saveButton(
                mobile ? 'att-save' : 'att-save-bar',
                mobile && unsaved > 0 ? 'flex-1' : undefined,
              )}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
