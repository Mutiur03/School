/**
 * Year-End Promotion, replicating dashboard/src/pages/Admin/GenerateResult.tsx (+ the promotion and
 * graduation preview dialogs): session year, the three steps (pass / fail with pass rules, merit &
 * promotion with Assign retained, class 10 graduation), the missing year-end alert, and the
 * students table (merit position, status override or Held, fails / allowed, next section · roll,
 * session marksheet PDF, hold / release) with class / section / group filters and paging.
 * Live data: /api/promotions/:year/*, /api/graduations/:year/*, /api/students, /api/exams/getExams,
 * /api/marksheets/students/:id/session, /api/marksheets/session. Every promotion step is a dry
 * run first; nothing is committed without the confirm button.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import type { TableSort } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GraduationCap,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Undo2,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { SectionCard } from '@/components/ui/SectionCard';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState, LoadingState, Notice } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { CorrectionsDialog } from '@/features/promotion/CorrectionsDialog';
import { PromotionBadges, PromotionStatus } from '@/features/promotion/PromotionStatus';
import { SkippedStudents } from '@/features/promotion/SkippedStudents';
import {
  failsText,
  generateConfirmText,
  generateMessages,
  graduateMessage,
  graduationDetail,
  holdConfirm,
  meritOrder,
  nextSecRoll,
  passRulesSummary,
  placementText,
  promoteMessages,
  promotionDetail,
  promotionYears,
  rulesByClass,
  stepState,
  calculatedConfirm,
  yearSummary,
} from '@/features/promotion/model';
import { GROUPS } from '@/features/results/filters';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  ENROLLMENT_STATUS_OPTIONS,
  PASS_RULE_CLASSES,
  clampMaxFailed,
  examsOfYear,
  yearEndGaps,
  type EnrollmentStatus,
  type GraduationPlan,
  type PassRule,
  type Placement,
  type PromotionPlan,
  type StudentRow,
  type StudentSortKey,
} from '@/lib/api';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { tw } from '@/theme/tokens';

const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZES = [25, 50, 100, 200] as const;
const INVALIDATE = [['students'], ['promotion-stats'], ['dashboard']] as const;

function meritClass(m: number) {
  if (m === 1) return 'bg-amber-500';
  if (m === 2) return 'bg-zinc-400';
  if (m === 3) return 'bg-amber-700';
  return 'bg-muted';
}

function Merit({ merit }: { merit: number }) {
  return (
    <View className={cn('h-7 w-7 items-center justify-center rounded-full', meritClass(merit))}>
      <Text
        size="xs"
        weight="bold"
        tabular
        className={merit >= 1 && merit <= 3 ? 'text-white' : undefined}
      >
        {merit || '—'}
      </Text>
    </View>
  );
}

function ResultBadge({ status }: { status: string }) {
  return (
    <Badge
      label={status || '—'}
      variant={status === 'Passed' ? 'default' : status === 'Failed' ? 'destructive' : 'secondary'}
    />
  );
}

function Step({
  n,
  title,
  done,
  detail,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  detail: string;
  children: ReactNode;
}) {
  return (
    <View className="min-w-[260px] flex-1 gap-3 p-4">
      <View className="gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text size="sm" weight="semibold">
            {n} · {title}
          </Text>
          <CheckCircle2
            size={14}
            color={done ? tw.emerald700 : tw.gray400}
            accessibilityLabel={done ? 'Done' : 'Not done'}
          />
        </View>
        <Text size="xs" color="mutedForeground">
          {detail}
        </Text>
      </View>
      <View className="mt-auto flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function PreviewTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <View className="border-border overflow-hidden rounded-lg border">
      <View className="bg-muted border-border flex-row border-b px-3 py-2">
        {head.map((h, i) => (
          <Text
            key={h}
            size="xs"
            weight="semibold"
            className={cn('uppercase text-gray-700', i === 0 ? 'flex-[2]' : 'flex-1')}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((cells, r) => (
        <View key={r} className="border-border flex-row items-center border-b px-3 py-2">
          {cells.map((c, i) => (
            <View key={i} className={i === 0 ? 'flex-[2] pr-2' : 'flex-1'}>
              {typeof c === 'string' || typeof c === 'number' ? (
                <Text size="sm" tabular numberOfLines={1} weight={i === 0 ? 'medium' : 'regular'}>
                  {c}
                </Text>
              ) : (
                c
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function PromotionScreen() {
  const { promotions, students, exams } = useApi();
  const router = useRouter();
  const { resolution } = useTenant();
  const toast = useToast();
  const mobile = useBreakpoint() === 'mobile';
  const key = (...p: unknown[]) => privateQueryKey(resolution.tenantKey, ...p);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [cls, setCls] = useState<number[]>([]);
  const [section, setSection] = useState<string[]>([]);
  const [group, setGroup] = useState<string[]>([]);
  const [sort, setSort] = useState<TableSort<StudentSortKey> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(50);
  const [rulesDraft, setRulesDraft] = useState<PassRule[] | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [holdTarget, setHoldTarget] = useState<StudentRow | null>(null);
  const [plan, setPlan] = useState<PromotionPlan | 'loading' | null>(null);
  const [gradPlan, setGradPlan] = useState<GraduationPlan | 'loading' | null>(null);
  const [overriding, setOverriding] = useState<number | null>(null);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [statusChange, setStatusChange] = useState<{
    row: StudentRow;
    status: EnrollmentStatus;
    text: string;
  } | null>(null);
  const [calcTarget, setCalcTarget] = useState<StudentRow | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const pdfLock = useRef(false);

  const examsQ = useQuery({
    queryKey: key('exams'),
    queryFn: ({ signal }) => exams.list(signal),
    staleTime: 60_000,
  });
  const statsQ = useQuery({
    queryKey: key('promotion-stats', year),
    queryFn: ({ signal }) => promotions.stats(year, signal),
  });
  const rulesQ = useQuery({
    queryKey: key('pass-rules', year),
    queryFn: ({ signal }) => promotions.passRules(year, signal),
  });
  const params = {
    year,
    page,
    limit,
    activeOnly: true, // inactive (TC'd) students are never part of results or promotion
    levels: cls.length ? cls : undefined,
    sections: section.length ? section : undefined,
    groups: group.length ? group : undefined,
    sort: sort?.key,
    order: sort?.order,
  };
  const studentsQ = useQuery({
    queryKey: key('students', 'promotion', params),
    queryFn: ({ signal }) => students.list(params, signal),
    placeholderData: (prev) => prev,
  });

  const gaps = useMemo(
    () => yearEndGaps(examsOfYear(examsQ.data ?? [], year)),
    [examsQ.data, year],
  );
  const ready = gaps.length === 0;
  const rules = rulesQ.data ?? PASS_RULE_CLASSES.map((c) => ({ class: c, max_failed: 0 }));
  const allowed = rulesByClass(rules);
  const st = stepState(statsQ.data);
  const rows = meritOrder(studentsQ.data?.rows ?? []);
  const meta = studentsQ.data?.meta;

  const blockIfNotReady = () => {
    if (ready) return false;
    toast.error(`Missing year-end exams for class ${gaps.join(', ')}`);
    return true;
  };
  const showMessages = (m: { success: string; errors: string[] }) => {
    toast.success(m.success);
    for (const e of m.errors) toast.error(e);
  };

  const generate = useAdminMutation({
    mutationFn: (_: void) => promotions.generateResults(year),
    invalidate: INVALIDATE,
    success: (o) => {
      showMessages(generateMessages(o));
      return null;
    },
    failure: 'Failed to generate result',
    onSuccess: () => setConfirmGenerate(false),
  });
  const saveRules = useAdminMutation({
    mutationFn: (r: PassRule[]) => promotions.savePassRules(year, r),
    invalidate: [['pass-rules'], ['students']],
    success: 'Pass rules saved',
    failure: 'Could not save pass rules',
    onSuccess: () => setRulesDraft(null),
  });
  const override = useAdminMutation({
    mutationFn: (v: { row: StudentRow; status: EnrollmentStatus }) =>
      promotions.overrideStatus(year, v.row.enrollment_id!, v.status),
    invalidate: INVALIDATE,
    success: () => null,
    failure: 'Could not update status',
    onSuccess: (p, v) => {
      toast.success(`${v.row.name}: ${v.status}`);
      const line = p && placementText(p, year + 1);
      if (line) toast.success(line);
      setStatusChange(null);
    },
  });
  const clearOverride = useAdminMutation({
    mutationFn: (row: StudentRow) => promotions.clearOverride(year, row.enrollment_id!),
    invalidate: INVALIDATE,
    success: () => null,
    failure: 'Could not clear the manual result',
    onSuccess: (p) => {
      toast.success(`${p.name}: calculated result is ${p.status}.`);
      const line = placementText(p, year + 1);
      if (line) toast.success(line);
      setCalcTarget(null);
    },
  });
  // Ask the server where the change puts the student next year; confirm only when it moves them.
  const checkPlacement = useMutation({
    mutationFn: (v: { row: StudentRow; status: EnrollmentStatus }) =>
      promotions.placement(year, v.row.enrollment_id!, v.status),
  });
  const holdM = useAdminMutation({
    mutationFn: (row: StudentRow) =>
      row.result_held
        ? promotions.release(year, [row.enrollment_id!])
        : promotions.hold(year, [row.enrollment_id!]),
    invalidate: INVALIDATE,
    success: () => null,
    failure: 'Could not update results',
    onSuccess: (_r, row) => {
      toast.success(row.result_held ? 'Results released' : 'Results held');
      setHoldTarget(null);
    },
  });
  const promote = useAdminMutation({
    mutationFn: (_: void) => promotions.promote(year),
    invalidate: INVALIDATE,
    success: (r) => {
      showMessages(promoteMessages(r));
      return null;
    },
    failure: 'Failed to promote students',
    onSuccess: () => setPlan(null),
  });
  const retained = useAdminMutation({
    mutationFn: (_: void) => promotions.assignRetained(year),
    invalidate: INVALIDATE,
    success: (r) => `${r.assigned} retained class-6 students numbered in ${r.newYear}`,
    failure: 'Failed to assign retained students',
  });
  const retainClass10 = useAdminMutation({
    mutationFn: (_: void) => promotions.retainClass10(year),
    invalidate: INVALIDATE,
    success: (r) => `${r.retained} failed class-10 students added to class 10 in ${r.newYear}`,
    failure: 'Failed to retain class 10 students',
  });
  const graduate = useAdminMutation({
    mutationFn: (_: void) => promotions.graduate(year),
    invalidate: INVALIDATE,
    success: graduateMessage,
    failure: 'Failed to graduate class 10',
    onSuccess: () => setGradPlan(null),
  });
  const loadPlan = useMutation({
    mutationFn: () => promotions.plan(year),
    onSuccess: (p) => {
      if (p.summary.total === 0) {
        toast.error(`No students in classes 6–9 for ${year}.`);
        setPlan(null);
      } else setPlan(p);
    },
    onError: (e) => {
      toast.error(mutationErrorMessage(e, 'Could not build promotion preview'));
      setPlan(null);
    },
  });
  const loadGradPlan = useMutation({
    mutationFn: () => promotions.graduationPlan(year),
    onSuccess: (p) => {
      if (p.summary.total === 0) {
        toast.error(`No active class-10 students for ${year}.`);
        setGradPlan(null);
      } else setGradPlan(p);
    },
    onError: (e) => {
      toast.error(mutationErrorMessage(e, 'Could not build graduation preview'));
      setGradPlan(null);
    },
  });

  const pdf = async (
    label: string,
    load: () => Promise<ArrayBuffer>,
    name: string,
    fail: string,
  ) => {
    if (pdfLock.current) return;
    pdfLock.current = true;
    setPdfBusy(label);
    try {
      const r = await openPdf(load, name);
      if (r === 'unavailable') toast.error("This device can't open the PDF.");
    } catch (e) {
      toast.error(mutationErrorMessage(e, fail));
    } finally {
      pdfLock.current = false;
      setPdfBusy(null);
    }
  };
  const sessionPdf = (row: StudentRow) =>
    void pdf(
      `s-${row.id}`,
      () => promotions.sessionPdf(row.id, year),
      pdfFileName(['session-marksheet', row.name, year]),
      'Failed to download session marksheet',
    );

  const setStatus = (row: StudentRow, status: EnrollmentStatus) => {
    if (!row.enrollment_id || row.status === status) return;
    setOverriding(row.enrollment_id);
    checkPlacement.mutate(
      { row, status },
      {
        onSuccess: (p: Placement) => {
          const text = placementText(p, year + 1);
          if (text) {
            setStatusChange({ row, status, text });
            setOverriding(null);
          } else {
            override.mutate({ row, status }, { onSettled: () => setOverriding(null) });
          }
        },
        onError: (e) => {
          toast.error(mutationErrorMessage(e, 'Could not check next-year placement'));
          setOverriding(null);
        },
      },
    );
  };

  const statusCell = (row: StudentRow) =>
    row.result_held ? (
      <View className="self-start rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5">
        <Text size="xs" weight="medium" className="text-amber-800">
          Held
        </Text>
      </View>
    ) : row.enrollment_id &&
      (ENROLLMENT_STATUS_OPTIONS as readonly string[]).includes(row.status || 'Pending') ? (
      <Select
        label={`Status of ${row.name}`}
        size="sm"
        value={(row.status || 'Pending') as EnrollmentStatus}
        disabled={overriding === row.enrollment_id}
        options={ENROLLMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        onChange={(s) => setStatus(row, s)}
      />
    ) : (
      <ResultBadge status={row.status} />
    );
  const actions = (row: StudentRow) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Eye}
        label={`Preview session marksheet of ${row.name}`}
        tone="blue"
        onPress={() =>
          router.push({
            pathname: '/marksheet/[studentId]/[year]',
            params: { studentId: String(row.id), year: String(year) },
          })
        }
      />
      <ActionButton
        icon={FileText}
        label={`Session marksheet PDF for ${row.name}`}
        tone="blue"
        onPress={() => sessionPdf(row)}
      />
      {row.result_manual && !row.result_held && row.enrollment_id ? (
        <ActionButton
          icon={RotateCcw}
          label={`Use calculated result for ${row.name}`}
          tone="blue"
          onPress={() => setCalcTarget(row)}
        />
      ) : null}
      {row.status !== 'Graduated' && row.enrollment_id ? (
        <ActionButton
          icon={row.result_held ? PlayCircle : PauseCircle}
          label={row.result_held ? `Release result of ${row.name}` : `Hold result of ${row.name}`}
          tone="emerald"
          onPress={() => setHoldTarget(row)}
        />
      ) : null}
    </View>
  );

  const columns: Column<StudentRow>[] = [
    {
      key: 'merit',
      label: 'Position',
      className: 'w-24',
      render: (r) => <Merit merit={r.final_merit} />,
    },
    {
      key: 'name',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" weight="medium" numberOfLines={1} className="uppercase">
          {r.name || '—'}
        </Text>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      sortKey: 'class',
      className: 'w-20',
      render: (r) => (
        <Text size="sm" tabular>
          {r.class}
        </Text>
      ),
    },
    {
      key: 'sec',
      label: 'Sec',
      sortKey: 'section',
      className: 'w-16',
      render: (r) => <Text size="sm">{r.section || '—'}</Text>,
    },
    {
      key: 'group',
      label: 'Group',
      sortKey: 'group',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color={r.group ? 'foreground' : 'mutedForeground'}>
          {r.group || '—'}
        </Text>
      ),
    },
    {
      key: 'roll',
      label: 'Roll',
      sortKey: 'roll',
      className: 'w-20',
      render: (r) => (
        <Text size="sm" tabular>
          {r.roll || '—'}
        </Text>
      ),
    },
    { key: 'status', label: 'Status', className: 'w-36', render: statusCell },
    {
      key: 'fails',
      label: 'Fails',
      className: 'w-20',
      render: (r) => (
        <Text size="xs" color="mutedForeground" tabular>
          {failsText(r, allowed)}
        </Text>
      ),
    },
    {
      key: 'next',
      label: 'Next sec · roll',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" weight="semibold" color="primary" tabular>
          {nextSecRoll(r)}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-40', align: 'right', render: actions },
  ];

  const sections = meta?.availableSections?.length ? meta.availableSections : ['A', 'B'];
  const promoteBusy = loadPlan.isPending || promote.isPending;
  const gradBusy = loadGradPlan.isPending || graduate.isPending;
  const hold = holdTarget ? holdConfirm(holdTarget.name, holdTarget.result_held, year) : null;
  const planData = plan && plan !== 'loading' ? plan : null;
  const gradData = gradPlan && gradPlan !== 'loading' ? gradPlan : null;

  return (
    <PageLayout
      title="Year-End Promotion"
      titleAccessory={
        <View className="flex-row flex-wrap items-center gap-2">
          <Select
            label="Session year"
            size="sm"
            value={year}
            options={promotionYears(CURRENT_YEAR).map((y) => ({ value: y, label: `Session ${y}` }))}
            onChange={(y) => {
              setYear(y);
              setPage(1);
            }}
          />
          <PromotionBadges stats={statsQ.data} />
        </View>
      }
      description={yearSummary(statsQ.data, year)}
      actions={
        <>
          <Button
            variant="outline"
            icon={Undo2}
            label="Correct mistakes"
            onPress={() => setCorrectionsOpen(true)}
            testID="correct-mistakes"
          />
          <Button
            variant="outline"
            icon={Download}
            label={pdfBusy === 'all' ? 'Preparing…' : 'All session PDFs'}
            disabled={(meta?.filtered ?? 0) === 0 || pdfBusy !== null}
            onPress={() =>
              void pdf(
                'all',
                () => promotions.allSessionPdf(year),
                pdfFileName(['session-marksheets', year]),
                'Failed to download all marksheets',
              )
            }
          />
        </>
      }
      onRefresh={() => {
        void statsQ.refetch();
        void studentsQ.refetch();
      }}
      refreshing={statsQ.isRefetching || studentsQ.isRefetching}
    >
      {!ready && examsQ.data ? (
        <Notice title="Missing year-end exam">
          {`No year-end exam for class ${gaps.join(', ')}. Pass/fail and promotion need one covering each class — create them in Exams.`}
        </Notice>
      ) : null}

      <PromotionStatus stats={statsQ.data} />

      <SectionCard noPadding>
        <View
          className={cn(
            'flex-row flex-wrap',
            mobile ? 'divide-border divide-y' : 'divide-border divide-x',
          )}
        >
          <Step
            n={1}
            title="Pass / fail"
            done={st.passFailGenerated}
            detail={`Allowed failed subjects by class — ${passRulesSummary(rules)}. Override single students in the table.`}
          >
            <Button
              size="sm"
              icon={RefreshCw}
              label={generate.isPending ? 'Generating…' : 'Generate pass/fail'}
              disabled={generate.isPending || !ready}
              onPress={() => !blockIfNotReady() && setConfirmGenerate(true)}
              testID="generate-pass-fail"
            />
            <Button
              size="sm"
              variant="outline"
              icon={SlidersHorizontal}
              label="Pass rules"
              onPress={() => setRulesDraft(rules.map((r) => ({ ...r })))}
            />
          </Step>
          <Step
            n={2}
            title="Merit & promotion"
            done={st.promoted}
            detail={promotionDetail(statsQ.data, year)}
          >
            <Button
              size="sm"
              variant="outline"
              icon={Trophy}
              label={promoteBusy ? 'Working…' : 'Review & promote'}
              disabled={promoteBusy || !ready || !st.passFailGenerated}
              onPress={() => {
                if (blockIfNotReady()) return;
                setPlan('loading');
                loadPlan.mutate();
              }}
            />
            {st.awaitingRoll > 0 ? (
              <Button
                size="sm"
                label={retained.isPending ? 'Assigning…' : `Assign retained (${st.awaitingRoll})`}
                disabled={retained.isPending}
                onPress={() => retained.mutate()}
              />
            ) : null}
          </Step>
          <Step
            n={3}
            title="Class 10 graduation"
            done={st.class10Done}
            detail={graduationDetail(statsQ.data)}
          >
            <Button
              size="sm"
              variant="outline"
              icon={GraduationCap}
              label={gradBusy ? 'Working…' : 'Review & graduate'}
              disabled={gradBusy || !ready || !st.passFailGenerated}
              onPress={() => {
                if (blockIfNotReady()) return;
                setGradPlan('loading');
                loadGradPlan.mutate();
              }}
            />
            {st.class10Done && st.awaitingRetain > 0 ? (
              <Button
                size="sm"
                label={
                  retainClass10.isPending ? 'Retaining…' : `Retain failed (${st.awaitingRetain})`
                }
                disabled={retainClass10.isPending}
                onPress={() => retainClass10.mutate()}
              />
            ) : null}
          </Step>
        </View>
      </SectionCard>

      <View className="flex-row flex-wrap items-center gap-2">
        <MultiSelect
          label="Class"
          allLabel="All classes"
          size="sm"
          value={cls}
          options={(meta?.availableClasses?.length ? meta.availableClasses : [6, 7, 8, 9, 10]).map(
            (c) => ({ value: c, label: `Class ${c}` }),
          )}
          testID="promotion-class"
          onChange={(c) => {
            setCls(c);
            setPage(1);
          }}
        />
        <MultiSelect
          label="Section"
          allLabel="All sections"
          size="sm"
          value={section}
          options={sections.map((s) => ({ value: s, label: `Section ${s}` }))}
          onChange={(s) => {
            setSection(s);
            setPage(1);
          }}
        />
        <MultiSelect
          label="Group"
          allLabel="All groups"
          size="sm"
          value={group}
          options={GROUPS.map((g) => ({ value: g as string, label: g }))}
          onChange={(g) => {
            setGroup(g);
            setPage(1);
          }}
        />
        <Select
          label="Rows per page"
          size="sm"
          value={limit}
          options={PAGE_SIZES.map((n) => ({ value: n, label: `${n} / page` }))}
          onChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
        {meta ? (
          <Text size="sm" color="mutedForeground" tabular className="ml-auto">
            {meta.filtered.toLocaleString()} students
          </Text>
        ) : null}
      </View>

      {studentsQ.isError && !studentsQ.data ? (
        <ErrorState
          title="Couldn't load students"
          message={studentsQ.error.message}
          onRetry={() => void studentsQ.refetch()}
        />
      ) : (
        <View className={cn(studentsQ.isFetching && !studentsQ.isPending && 'opacity-60')}>
          <DataTable
            sort={sort}
            onSort={(next) => {
              setSort(next as TableSort<StudentSortKey> | null);
              setPage(1);
            }}
            testID="promotion-students"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.enrollment_id ?? r.id}
            loading={studentsQ.isPending}
            empty="No students match these filters."
            renderMobile={(r) => (
              <View className="gap-2">
                <View className="flex-row items-center gap-3">
                  <Merit merit={r.final_merit} />
                  <View className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" numberOfLines={1} className="uppercase">
                      {r.name}
                    </Text>
                    <Text size="xs" color="mutedForeground" tabular>
                      Class {r.class}
                      {r.section ? ` · ${r.section}` : ''} · Roll {r.roll || '—'}
                      {r.group ? ` · ${r.group}` : ''} · Fails {failsText(r, allowed)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  {statusCell(r)}
                  <Text size="xs" color="primary" weight="semibold" tabular>
                    Next {nextSecRoll(r)}
                  </Text>
                  {actions(r)}
                </View>
              </View>
            )}
          />
        </View>
      )}
      <Pagination
        page={page}
        totalPages={meta?.totalPages ?? 0}
        onPage={setPage}
        busy={studentsQ.isFetching}
      />

      <ConfirmDialog
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        busy={generate.isPending}
        tone="default"
        title="Generate pass/fail?"
        message={generateConfirmText(year, rules)}
        confirmLabel="Generate"
        onConfirm={() => generate.mutate()}
      />
      <ConfirmDialog
        open={holdTarget !== null}
        onClose={() => setHoldTarget(null)}
        busy={holdM.isPending}
        tone="default"
        title={hold?.title}
        message={hold?.message ?? ''}
        confirmLabel={hold?.confirmLabel ?? 'OK'}
        onConfirm={() => holdTarget && holdM.mutate(holdTarget)}
      />

      <ConfirmDialog
        open={statusChange !== null}
        onClose={() => setStatusChange(null)}
        busy={override.isPending}
        tone="default"
        title={statusChange ? `Set ${statusChange.row.name} to ${statusChange.status}?` : undefined}
        message={
          statusChange
            ? `Promotion for ${year + 1} already ran.

${statusChange.text}`
            : ''
        }
        confirmLabel="Save"
        onConfirm={() => statusChange && override.mutate(statusChange)}
      />
      <ConfirmDialog
        open={calcTarget !== null}
        onClose={() => setCalcTarget(null)}
        busy={clearOverride.isPending}
        tone="default"
        title={
          calcTarget ? calculatedConfirm(calcTarget.name, calcTarget.status, year).title : undefined
        }
        message={
          calcTarget ? calculatedConfirm(calcTarget.name, calcTarget.status, year).message : ''
        }
        confirmLabel="Use calculated result"
        onConfirm={() => calcTarget && clearOverride.mutate(calcTarget)}
      />
      <CorrectionsDialog
        year={year}
        open={correctionsOpen}
        onClose={() => setCorrectionsOpen(false)}
      />

      <Dialog
        open={rulesDraft !== null}
        onClose={() => (saveRules.isPending ? undefined : setRulesDraft(null))}
        title={`Pass rules · ${year}`}
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setRulesDraft(null)}
              disabled={saveRules.isPending}
            />
            <Button
              label={saveRules.isPending ? 'Saving…' : 'Save rules'}
              disabled={saveRules.isPending}
              onPress={() => rulesDraft && saveRules.mutate(rulesDraft)}
            />
          </>
        }
      >
        <Text size="sm" color="mutedForeground">
          Allowed failed subjects per class. 0 = strict (any failed subject fails). A student passes
          when failed subjects ≤ this limit.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {rulesDraft?.map((rule) => (
            <View
              key={rule.class}
              className="border-border min-w-[140px] flex-1 flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
            >
              <Text size="sm" weight="medium">
                Class {rule.class}
              </Text>
              <Input
                value={String(rule.max_failed)}
                inputMode="numeric"
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={2}
                accessibilityLabel={`Allowed failed subjects for class ${rule.class}`}
                size="sm"
                stateIcon={false}
                className="w-14 text-center"
                onChangeText={(t) =>
                  setRulesDraft(
                    (prev) =>
                      prev?.map((r) =>
                        r.class === rule.class ? { ...r, max_failed: clampMaxFailed(t) } : r,
                      ) ?? null,
                  )
                }
              />
            </View>
          ))}
        </View>
      </Dialog>

      <Dialog
        open={plan !== null}
        onClose={() => (promote.isPending ? undefined : setPlan(null))}
        title={`Promotion preview · ${planData?.year ?? year} → ${planData?.newYear ?? year + 1}`}
        description="Dry run — nothing is saved until you confirm. Odd merit → section A, even → B."
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setPlan(null)}
              disabled={promote.isPending}
            />
            <Button
              variant="destructive"
              label={
                promote.isPending
                  ? 'Promoting…'
                  : `Confirm promote to ${planData?.newYear ?? 'next year'}`
              }
              disabled={!planData || promote.isPending}
              onPress={() => promote.mutate()}
              testID="confirm-promote"
            />
          </>
        }
      >
        {!planData ? (
          <LoadingState label="Calculating assignments…" />
        ) : (
          <>
            <StatStrip>
              <Stat label="Students" value={planData.summary.total} />
              <Stat
                label="Promoted"
                value={planData.summary.passed_promoted}
                dot="bg-emerald-500"
              />
              <Stat label="Retained" value={planData.summary.failed_retained} dot="bg-red-500" />
              <Stat
                label="Sec A / B"
                value={`${planData.summary.section_a} / ${planData.summary.section_b}`}
              />
            </StatStrip>
            <SkippedStudents students={planData.skipped_students} action="promoted" />
            {planData.summary.awaiting_roll > 0 ? (
              <Notice title={`No new class-6 admissions found for ${planData.newYear}`}>
                {`${planData.summary.awaiting_roll} failed class-6 student${planData.summary.awaiting_roll === 1 ? '' : 's'} will stay in class 6 without a roll for now, so the admissions get the first rolls. After importing the admissions, tap Assign retained to number them after the admitted students.`}
              </Notice>
            ) : null}
            {planData.summary.existing_next_year_enrollments > 0 ? (
              <Notice title="Existing enrollments">
                {`${planData.summary.existing_next_year_enrollments} enrollment${planData.summary.existing_next_year_enrollments === 1 ? '' : 's'} in ${planData.newYear} already exist. Auto-promoted students are renumbered by merit; failed, manually set and late-released students keep their order after them. Only students moving to another class lose their old row.`}
              </Notice>
            ) : null}
            {planData.summary.subjects_will_clone ? (
              <Notice tone="info" title="Subjects">
                {`No subjects found for ${planData.newYear} — they will be cloned from ${planData.year} on confirm.`}
              </Notice>
            ) : null}
            <PreviewTable
              head={['Student', 'From', 'Status', 'Merit', '→ Next year']}
              rows={planData.students.map((r) => [
                r.name,
                `${r.class}${r.section}·${r.roll}`,
                <ResultBadge key="s" status={r.status} />,
                r.final_merit || '—',
                `${
                  r.new_roll === null
                    ? `Cl ${r.new_class} · roll after admissions`
                    : `Cl ${r.new_class} · ${r.new_section}${r.new_roll}`
                }${r.locked ? ' · kept order' : ''}`,
              ])}
            />
          </>
        )}
      </Dialog>

      <Dialog
        open={gradPlan !== null}
        onClose={() => (graduate.isPending ? undefined : setGradPlan(null))}
        title={`Class 10 graduation · ${gradData?.year ?? year} (SSC ${gradData?.sscBatch ?? '…'})`}
        description={`Passed students are marked alumni (batch ${gradData?.sscBatch ?? '…'}, inactive). Failed students stay in class 10 for ${gradData?.newYear ?? year + 1} with new rolls.`}
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setGradPlan(null)}
              disabled={graduate.isPending}
            />
            <Button
              label={
                graduate.isPending
                  ? 'Graduating…'
                  : `Confirm graduation (SSC ${gradData?.sscBatch ?? ''})`
              }
              disabled={!gradData || graduate.isPending}
              onPress={() => graduate.mutate()}
              testID="confirm-graduate"
            />
          </>
        }
      >
        {!gradData ? (
          <LoadingState label="Calculating graduation…" />
        ) : (
          <>
            <StatStrip>
              <Stat label="Class 10" value={gradData.summary.total} />
              <Stat label="Graduate" value={gradData.summary.graduates} dot="bg-sky-500" />
              <Stat label="Hold" value={gradData.summary.held} dot="bg-amber-500" />
            </StatStrip>
            <SkippedStudents students={gradData.skipped_students} action="graduated" />
            {gradData.summary.held > 0 ? (
              <Notice title="Held">
                {`${gradData.summary.held} student${gradData.summary.held === 1 ? '' : 's'} not passed stay in ${gradData.year} with no ${gradData.newYear} class-10 place. Pass more of them if needed, then use Retain failed.`}
              </Notice>
            ) : null}
            <PreviewTable
              head={['Student', 'From', 'Result', 'Merit', 'Outcome']}
              rows={gradData.students.map((r) => [
                r.name,
                `10${r.section}·${r.roll}`,
                <ResultBadge key="s" status={r.status} />,
                r.final_merit || '—',
                <View key="o" className="gap-0.5">
                  <Badge
                    label={r.action === 'graduate' ? 'Graduate' : 'Hold'}
                    variant={r.action === 'graduate' ? 'default' : 'secondary'}
                  />
                  {r.action === 'graduate' && r.ssc_batch ? (
                    <Text size="xs" color="mutedForeground" tabular>
                      {`SSC batch ${r.ssc_batch}`}
                    </Text>
                  ) : null}
                </View>,
              ])}
            />
          </>
        )}
      </Dialog>
    </PageLayout>
  );
}
