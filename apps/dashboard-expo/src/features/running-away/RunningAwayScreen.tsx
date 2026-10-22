/**
 * Running away, replicating dashboard/src/pages/Admin/StayCheck.tsx (admin /attendance-double and
 * teacher /teacher/attendance-double): Class / Section pickers with "Today, <date>", the stats
 * card (Present this morning · Still here · Ran away · Absent · Not marked yet), a Roll ·
 * Student · Ran away list where students absent this morning (or inactive) can't be ticked, the
 * SMS credit estimate, an unsaved bar with Discard, and "Save & send SMS" that saves only the
 * changed rows.
 *
 * Live data (legacy Express, admin + teacher): GET /api/students/attendance-overview,
 * /api/attendance/getAttendence, /api/sms-settings/public; POST /api/attendance/save-and-send.
 * The attendance routes don't scope teachers to their classes (see docs/web-parity.md), and
 * neither does the web page, so every class is offered to both roles, as on the web.
 */
import { calculateSMSCount } from '@school/shared-schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatusBadge } from '@/components/ui/Badge';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { Check, Send } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { ATTENDANCE_CLASSES, ATTENDANCE_SECTIONS, isoDate } from '@/features/attendance/model';
import { mutationErrorMessage } from '@/features/admin/errors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useTenantStorage } from '@/tenant/useTenantStorage';
import { useLeaveGuard } from '@/navigation/LeaveGuard';
import { parseStoredClass } from '@/features/attendance/model';
import { tw } from '@/theme/tokens';
import {
  isLocked,
  morningTaken,
  runAwayPayload,
  smsEstimate,
  statusOf,
  stayStats,
  todayMaps,
  toggleRunAway,
  type RunAwayEdits,
} from './model';

const AMBER = '#fe9a00';
const segments = (text: string) => calculateSMSCount(text).count;

function TickBox({
  checked,
  disabled,
  label,
  onChange,
  testID,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      testID={testID}
      className={cn('h-11 w-11 items-center justify-center', disabled && 'opacity-40')}
    >
      <View
        className={cn('h-5 w-5 items-center justify-center rounded border')}
        style={
          checked
            ? { backgroundColor: AMBER, borderColor: AMBER }
            : { backgroundColor: tw.white, borderColor: '#d1d5db' }
        }
      >
        {checked ? <Icon icon={Check} size={14} rawColor={tw.white} /> : null}
      </View>
    </Pressable>
  );
}

export function RunningAwayScreen() {
  const { attendance } = useApi();
  const { resolution } = useTenant();
  const storage = useTenantStorage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mobile = useBreakpoint() === 'mobile';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayIso = isoDate(year, month, now.getDate());
  const todayLabel = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

  const [level, setLevel] = useState<number>(0);
  const [section, setSection] = useState('');
  const [edits, setEdits] = useState<RunAwayEdits>({});
  // Same as web: start on the class last used here or in Attendance (section A).
  useEffect(() => {
    let alive = true;
    void storage
      .get('attendance-class')
      .then((raw) => {
        const c = parseStoredClass(raw);
        if (alive && c) {
          setLevel((cur) => cur || c);
          setSection((cur) => cur || ATTENDANCE_SECTIONS[0]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storage]);
  const [pending, setPending] = useState<{ what: string; apply: () => void } | null>(null);

  // Same cache keys as the Attendance screen, so both stay in step.
  const key = (...parts: unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'attendance', ...parts);
  const sel = level && section ? { year, level, section } : null;

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
  const smsQ = useQuery({
    queryKey: key('sms-public'),
    queryFn: ({ signal }) => attendance.smsSettings(signal),
    enabled: !!sel,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const students = useMemo(() => studentsQ.data ?? [], [studentsQ.data]);
  const maps = useMemo(() => todayMaps(recordsQ.data ?? [], todayIso), [recordsQ.data, todayIso]);
  const taken = morningTaken(students, maps.saved);
  const stats = stayStats(students, edits, maps.saved);
  const unsaved = Object.keys(edits).length;
  const credits = smsEstimate(students, edits, maps, smsQ.data, todayIso, segments);
  const lowBalance = credits > 0 && (smsQ.data?.sms_balance ?? 0) < credits;

  // In-app guard: the sidebar, tab bar, menus and Android back ask before dropping ticks.
  useLeaveGuard(unsaved > 0, {
    title: 'Leave without saving?',
    message: `${unsaved} unsaved ${unsaved === 1 ? 'change is' : 'changes are'} lost if you leave this page now.`,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || unsaved === 0 || typeof window === 'undefined') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  const save = useMutation({
    mutationFn: () => {
      const payload = sel ? runAwayPayload(edits, { ...sel, date: todayIso }) : null;
      if (!payload) throw new Error('No changes to save');
      return attendance.saveAndSend(payload);
    },
    onSuccess: async (res) => {
      setEdits({});
      if (res.smsError) toast.error(`Attendance saved, but SMS failed: ${res.smsError}`);
      else toast.success('Attendance saved and SMS process completed');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key('records') }),
        queryClient.invalidateQueries({ queryKey: key('stats') }),
        queryClient.invalidateQueries({ queryKey: key('sms-public') }),
      ]);
    },
    onError: (e) =>
      toast.error(`${mutationErrorMessage(e, 'Failed to save')}. Your ticks are kept.`),
  });

  const guarded = (what: string, apply: () => void) => {
    if (unsaved === 0) apply();
    else setPending({ what, apply });
  };

  const loading = !!sel && (studentsQ.isPending || recordsQ.isPending);
  const error = studentsQ.error ?? recordsQ.error;

  const saveButton = (
    <Button
      icon={Send}
      label={save.isPending ? 'Saving…' : 'Save & send SMS'}
      disabled={save.isPending || !sel || unsaved === 0}
      onPress={() => save.mutate()}
      testID="save-running-away"
    />
  );
  const smsLine =
    credits > 0 ? (
      <Text
        size="xs"
        tabular
        weight={lowBalance ? 'medium' : undefined}
        color={lowBalance ? 'destructive' : 'mutedForeground'}
      >
        ≈ {credits} SMS credits
        {lowBalance ? ` · balance ${smsQ.data?.sms_balance ?? 0} is not enough` : ''}
      </Text>
    ) : null;

  const emptyText = !sel
    ? 'Pick a class and section.'
    : students.length === 0
      ? 'No students in this class.'
      : "Morning attendance hasn't been saved for this class yet. Take it on the Attendance page first.";

  return (
    <PageLayout
      title="Running away"
      description={`Today, ${todayLabel}`}
      actions={
        unsaved === 0 ? (
          <View className="items-end gap-1">
            {saveButton}
            {smsLine}
          </View>
        ) : undefined
      }
      onRefresh={() => {
        void studentsQ.refetch();
        void recordsQ.refetch();
      }}
      refreshing={studentsQ.isRefetching || recordsQ.isRefetching}
      footer={
        unsaved > 0 ? (
          <ActionBar
            label={`${unsaved} unsaved ${unsaved === 1 ? 'change' : 'changes'}`}
            detail={smsLine}
          >
            <Button variant="ghost" size="sm" label="Discard" onPress={() => setEdits({})} />
            {saveButton}
          </ActionBar>
        ) : null
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Select
          label="Class"
          size="sm"
          value={level}
          options={[
            ...(level ? [] : [{ value: 0, label: 'Select class' }]),
            ...ATTENDANCE_CLASSES.map((c) => ({ value: c, label: `Class ${c}` })),
          ]}
          onChange={(c) =>
            guarded('class', () => {
              setLevel(c);
              setSection(c ? ATTENDANCE_SECTIONS[0] : '');
              setEdits({});
              if (c) void storage.set('attendance-class', String(c)).catch(() => {});
            })
          }
          testID="ra-class"
        />
        <Select
          label="Section"
          size="sm"
          value={section}
          disabled={!level}
          options={[
            ...(section ? [] : [{ value: '', label: 'Section' }]),
            ...ATTENDANCE_SECTIONS.map((s) => ({ value: s, label: `Section ${s}` })),
          ]}
          onChange={(s) =>
            guarded('section', () => {
              setSection(s);
              setEdits({});
            })
          }
          testID="ra-section"
        />
      </View>

      <StatStrip>
        <Stat label="Present this morning" value={stats.morningPresent} />
        <Stat label="Still here" value={stats.present} dot="bg-emerald-500" />
        <Stat label="Ran away" value={stats.runAwayed} dot="bg-amber-500" />
        <Stat label="Absent" value={stats.absent} dot="bg-red-500" />
        {stats.notMarked > 0 ? <Stat label="Not marked yet" value={stats.notMarked} /> : null}
      </StatStrip>

      {error && !studentsQ.data ? (
        <ErrorState
          title="Couldn't load the class"
          message={error.message}
          onRetry={() => {
            void studentsQ.refetch();
            void recordsQ.refetch();
          }}
        />
      ) : (
        <SectionCard noPadding>
          <View className="border-border border-b px-4 py-3">
            <Text size="sm" weight="semibold">
              {sel ? `Class ${level} ${section}` : 'No class selected'}
            </Text>
            <Text size="sm" color="mutedForeground">
              Tick students who left without permission. Students absent this morning can&apos;t be
              ticked.
            </Text>
          </View>
          <View className="bg-muted border-border flex-row items-center border-b px-4 py-2.5">
            <Text size="xs" weight="semibold" className="w-14 uppercase text-gray-700">
              Roll
            </Text>
            <Text size="xs" weight="semibold" className="min-w-0 flex-1 uppercase text-gray-700">
              Student
            </Text>
            <Text
              size="xs"
              weight="semibold"
              className={cn('text-center uppercase text-gray-700', mobile ? 'w-20' : 'w-28')}
            >
              Ran away
            </Text>
          </View>
          {loading ? (
            <View className="gap-2 p-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </View>
          ) : !sel || students.length === 0 || !taken ? (
            <Text size="sm" color="mutedForeground" className="px-4 py-12 text-center">
              {emptyText}
            </Text>
          ) : (
            students.map((s) => {
              const ranAway = statusOf(edits, maps.saved, s.id) === 'run-awayed';
              const locked = isLocked(s, maps.saved);
              const absentMorning = (maps.saved[s.id] ?? 'absent') === 'absent';
              return (
                <View
                  key={s.id}
                  testID={`ra-row-${s.id}`}
                  className={cn(
                    'border-border flex-row items-center border-b px-4',
                    ranAway ? 'bg-amber-500/10' : 'bg-card',
                  )}
                >
                  <Text
                    size="sm"
                    tabular
                    color={locked ? 'mutedForeground' : undefined}
                    className="w-14"
                  >
                    {s.roll}
                  </Text>
                  <Pressable
                    disabled={locked}
                    onPress={() => setEdits((e) => toggleRunAway(e, maps.saved, s, !ranAway))}
                    className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2 py-2"
                  >
                    <Text
                      size="sm"
                      weight="medium"
                      color={locked ? 'mutedForeground' : undefined}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    {!s.available ? (
                      <StatusBadge status="inactive" />
                    ) : absentMorning ? (
                      <StatusBadge status="rejected" label="Absent this morning" />
                    ) : null}
                  </Pressable>
                  <View className={cn('items-center', mobile ? 'w-20' : 'w-28')}>
                    <TickBox
                      checked={ranAway}
                      disabled={locked}
                      label={`${s.name} ran away`}
                      onChange={(next) => setEdits((e) => toggleRunAway(e, maps.saved, s, next))}
                      testID={`ra-tick-${s.id}`}
                    />
                  </View>
                </View>
              );
            })
          )}
        </SectionCard>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Discard unsaved changes?"
        message={`You have unsaved changes. Changing the ${pending?.what ?? 'class'} will discard them.`}
        confirmLabel="Discard & continue"
        onClose={() => setPending(null)}
        onConfirm={() => {
          pending?.apply();
          setEdits({});
          setPending(null);
        }}
      />
    </PageLayout>
  );
}
