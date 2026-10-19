/**
 * SMS management, replicating dashboard/src/pages/Admin/SmsManagement.tsx: title "SMS" with
 * the credit balance + refresh, and three tabs:
 * - Delivery logs: date · type summary with Sent / Failed / Pending / Total, the 30-day credits
 *   chart, Date / Type / Status filters (default: today, Attendance), the log table with row
 *   selection, pagination, and the bulk bar (Retry failed/pending, Delete).
 * - Bulk SMS: message + estimate, class 6–10 recipients with reachable counts and credits
 *   needed (blocked above the balance), "Send this SMS?" confirmation.
 * - Settings: master switch, Present / Absent / Ran away templates (Send toggle, estimate with a
 *   sample student, preview), required placeholders, test SMS, and the unsaved bar.
 * All endpoints are admin only and tenant scoped on the server. Retry, bulk and test send real
 * messages (credits); each needs an explicit press, bulk a confirmation.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateSMSCount, PHONE_NUMBER } from '@school/shared-schemas';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DateInput } from '@/components/ui/DateInput';
import { Field } from '@/components/ui/Field';
import { Inbox, RefreshCw, RotateCw, Send, Settings, Trash2, XIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { SectionCard } from '@/components/ui/SectionCard';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { pageState, togglePage, toggleId } from '@/features/admin/selection';
import { todayYmd } from '@/features/holidays/model';
import {
  BULK_CLASSES,
  CATEGORY_LABELS,
  ELECTIVE_TOKENS,
  SAMPLE_SMS_VALUES,
  STATUS_LABELS,
  TEMPLATES,
  bulkCost,
  displayDate,
  estimateLine,
  fillSmsTemplate,
  initialRequired,
  logDay,
  retryableIds,
  settingsErrors,
  templateError,
  testSmsErrors,
  typeSummary,
  type SmsCounter,
  type TemplateField,
  listParam,
} from '@/features/sms/model';
import type { SmsCategory, SmsLog, SmsSettings, SmsStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

type Tab = 'logs' | 'bulk' | 'settings';
const counter: SmsCounter = calculateSMSCount;
const STATUS_BADGE = { sent: 'approved', failed: 'rejected', pending: 'pending' } as const;

function Estimate({ text, suffix }: { text: string; suffix?: string }) {
  const line = estimateLine(text, counter, suffix);
  return line ? (
    <Text size="xs" color="mutedForeground" tabular>
      {line}
    </Text>
  ) : null;
}

function Textarea({
  value,
  onChange,
  label,
  rows,
  placeholder,
  disabled,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  rows: number;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Input
      accessibilityLabel={label}
      multiline
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      testID={testID}
    />
  );
}

/** 30-day credits bars (the web's recharts BarChart), plain views. */
function UsageBars({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View className="h-24 flex-row items-end gap-[2px]" accessibilityLabel="Credits per day">
      {data.map((d) => (
        <View
          key={d.date}
          className="bg-primary flex-1 rounded-t-sm"
          style={{ height: `${Math.max(d.count ? 4 : 0, (d.count / max) * 100)}%` }}
          accessibilityLabel={`${d.date}: ${d.count} credits`}
        />
      ))}
    </View>
  );
}

function LogsTab({
  selected,
  setSelected,
  onLogs,
  category,
  setCategory,
}: {
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
  /** The rows on screen, for the page-level Retry button. */
  onLogs: (logs: SmsLog[]) => void;
  category: SmsCategory[];
  setCategory: (c: SmsCategory[]) => void;
}) {
  const { sms } = useApi();
  const { resolution } = useTenant();
  const [date, setDate] = useState(todayYmd());
  const [status, setStatus] = useState<SmsStatus[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, status, category, limit]);

  const params = {
    page,
    limit,
    date,
    category: listParam(category),
    status: listParam(status),
  };
  const logsQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'sms-logs', params),
    queryFn: ({ signal }) => sms.logs(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const usageQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'sms-usage'),
    queryFn: ({ signal }) => sms.usage(30, signal),
  });
  const logs = useMemo(() => logsQ.data?.logs ?? [], [logsQ.data]);
  useEffect(() => onLogs(logs), [logs, onLogs]);
  const stats = logsQ.data?.stats ?? { sent: 0, failed: 0, pending: 0 };
  const usage = usageQ.data ?? [];
  const usageTotal = usage.reduce((s, d) => s + d.count, 0);
  const ids = logs.map((l) => l.id);
  const head = pageState(selected, ids);
  const filtersActive = status.length > 0 || category.join() !== 'attendance';

  const columns: Column<SmsLog>[] = [
    {
      key: 'select',
      label: ' ',
      className: 'w-10',
      render: (l) => (
        <Checkbox
          checked={selected.has(l.id)}
          onChange={() => setSelected(toggleId(selected, l.id))}
          label=""
          testID={`sms-select-${l.id}`}
        />
      ),
    },
    {
      key: 'recipient',
      label: 'Recipient',
      className: 'w-56',
      render: (l) => <Recipient l={l} />,
    },
    {
      key: 'type',
      label: 'Type',
      className: 'w-32',
      render: (l) => <Text size="sm">{CATEGORY_LABELS[l.category]}</Text>,
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-28',
      render: (l) => <StatusCell l={l} />,
    },
    {
      key: 'message',
      label: 'Message',
      className: 'min-w-0 flex-1',
      render: (l) => (
        <View>
          <Text size="sm" numberOfLines={2}>
            {l.message}
          </Text>
          {l.error_reason ? (
            <Text size="xs" color="destructive" numberOfLines={1}>
              {l.error_reason}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'credits',
      label: 'Credits',
      className: 'w-20',
      align: 'right',
      render: (l) => (
        <Text size="sm" tabular>
          {l.sms_count ?? '—'}
        </Text>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-28',
      render: (l) => (
        <Text size="sm" tabular color="mutedForeground">
          {logDay(l)}
        </Text>
      ),
    },
  ];

  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-4">
        <StatStrip className="min-w-[300px] flex-[3]">
          <View className="w-full">
            <Text size="xs" color="mutedForeground" tabular>
              {displayDate(date)} · {typeSummary(category)}
            </Text>
          </View>
          <Stat label="Sent" value={stats.sent} dot="bg-emerald-500" />
          <Stat label="Failed" value={stats.failed} dot="bg-red-500" />
          <Stat label="Pending" value={stats.pending} dot="bg-amber-500" />
          <Stat label="Total" value={stats.sent + stats.failed + stats.pending} />
        </StatStrip>
        <SectionCard className="min-w-[260px] flex-[2]">
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text size="xs" color="mutedForeground">
                Credits used · last 30 days
              </Text>
              <Text size="lg" weight="semibold" tabular>
                {usageTotal.toLocaleString()}
              </Text>
            </View>
            {usageQ.isPending ? <Skeleton height={96} /> : <UsageBars data={usage} />}
          </View>
        </SectionCard>
      </View>

      <View className="flex-row flex-wrap items-end gap-2">
        <View className="w-44">
          <Field label="Date">
            <DateInput label="Date" value={date} onChange={(v) => v && setDate(v)} />
          </Field>
        </View>
        <MultiSelect
          label="Type"
          allLabel="All types"
          value={category}
          onChange={setCategory}
          options={(Object.keys(CATEGORY_LABELS) as SmsCategory[]).map((c) => ({
            value: c,
            label: CATEGORY_LABELS[c],
          }))}
          className="w-44"
          testID="sms-type"
        />
        <MultiSelect
          label="Status"
          allLabel="All statuses"
          value={status}
          onChange={setStatus}
          options={(Object.keys(STATUS_LABELS) as SmsStatus[]).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
          testID="sms-status"
          className="w-40"
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            icon={XIcon}
            label="Reset"
            onPress={() => {
              setStatus([]);
              setCategory(['attendance']);
            }}
          />
        ) : null}
        <View className="ml-auto">
          <Checkbox
            checked={head.all}
            onChange={() => setSelected(togglePage(selected, ids))}
            label="Select all on this page"
            disabled={ids.length === 0}
            testID="sms-select-all"
          />
        </View>
      </View>

      {logsQ.isError && !logsQ.data ? (
        <ErrorState
          title="Couldn't load SMS logs. Try again in a moment."
          message={logsQ.error.message}
          onRetry={() => void logsQ.refetch()}
        />
      ) : (
        <DataTable
          testID="sms-logs"
          rows={logs}
          columns={columns}
          rowKey={(l) => l.id}
          loading={logsQ.isPending}
          empty={`No messages on ${displayDate(date)}${filtersActive ? ' with these filters' : ''}.`}
          onRowPress={(l) => setSelected(toggleId(selected, l.id))}
          renderMobile={(l) => (
            <View className="flex-row items-start gap-3">
              <Checkbox
                checked={selected.has(l.id)}
                onChange={() => setSelected(toggleId(selected, l.id))}
                label=""
              />
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <Recipient l={l} />
                  </View>
                  <StatusCell l={l} />
                </View>
                <Text size="sm" numberOfLines={2}>
                  {l.message}
                </Text>
                <Text size="xs" color="mutedForeground" tabular>
                  {CATEGORY_LABELS[l.category]} · {l.sms_count ?? '—'} credits · {logDay(l)}
                </Text>
                {l.error_reason ? (
                  <Text size="xs" color="destructive" numberOfLines={1}>
                    {l.error_reason}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Select
          label="Rows per page"
          size="sm"
          value={limit}
          onChange={setLimit}
          options={[25, 50, 100].map((n) => ({ value: n, label: `${n} per page` }))}
        />
        <Pagination
          page={page}
          totalPages={logsQ.data?.totalPages ?? 1}
          onPage={(p) => {
            setPage(p);
            setSelected(new Set());
          }}
          busy={logsQ.isFetching}
        />
      </View>
    </View>
  );
}

function Recipient({ l }: { l: SmsLog }) {
  const e = l.student?.enrollment;
  return (
    <View className="min-w-0">
      <Text size="sm" weight="medium" numberOfLines={1}>
        {l.student?.name || '—'}
      </Text>
      <Text size="xs" color="mutedForeground" tabular numberOfLines={1}>
        {l.phone_number}
        {e ? ` · Class ${e.class} ${e.section} · Roll ${e.roll}` : ''}
      </Text>
    </View>
  );
}

function StatusCell({ l }: { l: SmsLog }) {
  return (
    <View className="items-start gap-0.5">
      <StatusBadge status={STATUS_BADGE[l.status]} label={STATUS_LABELS[l.status]} />
      {l.retry_count > 0 ? (
        <Text size="xs" color="mutedForeground">
          {l.retry_count} {l.retry_count === 1 ? 'retry' : 'retries'}
        </Text>
      ) : null}
    </View>
  );
}

function BulkTab({ balance, onSent }: { balance: number | null; onSent: () => void }) {
  const { sms } = useApi();
  const { resolution } = useTenant();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [classes, setClasses] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const sorted = [...classes].sort((a, b) => a - b);

  const countQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'sms-student-count', sorted),
    queryFn: ({ signal }) => sms.studentCount(sorted, signal),
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
  });
  const count = sorted.length ? countQ.data : undefined;
  const cost = bulkCost(count?.withPhone ?? 0, text, counter, balance);

  const send = useMutation({
    mutationFn: () => sms.sendBulk(sorted, text),
    onSuccess: (r) => {
      toast.success(
        r.failed ? `Bulk SMS sent: ${r.sent} sent, ${r.failed} failed` : 'Bulk SMS sent',
      );
      setConfirm(false);
      setClasses([]);
      setText('');
      for (const k of ['sms-logs', 'sms-balance', 'sms-usage']) {
        void queryClient.invalidateQueries({ queryKey: privateQueryKey(resolution.tenantKey, k) });
      }
      onSent();
    },
    onError: (e) => {
      setConfirm(false);
      toast.error(mutationErrorMessage(e, 'Failed to send bulk SMS'));
    },
  });
  const parents = count?.withPhone ? plural(count.withPhone, 'parent') : 'parents';

  return (
    <View className="flex-row flex-wrap gap-6">
      <SectionCard title="Message" className="min-w-[300px] flex-[3]">
        <View className="gap-2">
          <Text size="sm" color="mutedForeground">
            Sent as-is to one parent number per student (father&apos;s, else mother&apos;s).
            Placeholders aren&apos;t filled in.
          </Text>
          <Textarea
            label="Bulk message"
            placeholder="Type your message…"
            rows={8}
            value={text}
            onChange={setText}
            testID="bulk-message"
          />
          <Estimate text={text} suffix=" per parent" />
        </View>
      </SectionCard>
      <SectionCard title="Recipients" className="min-w-[280px] flex-[2]">
        <View className="gap-4">
          <Text size="sm" color="mutedForeground">
            Choose classes.
          </Text>
          <View className="flex-row flex-wrap gap-2" role="group" aria-label="Classes">
            {BULK_CLASSES.map((c) => {
              const on = classes.includes(c);
              return (
                <Pressable
                  key={c}
                  role="button"
                  aria-pressed={on}
                  accessibilityState={{ selected: on }}
                  onPress={() =>
                    setClasses((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                  className={cn(
                    'h-9 justify-center rounded-lg border px-3',
                    on ? 'bg-primary border-primary' : 'border-border hover:bg-muted',
                  )}
                  testID={`bulk-class-${c}`}
                >
                  <Text size="sm" weight="medium" color={on ? 'primaryForeground' : undefined}>
                    Class {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {sorted.length > 0 ? (
            countQ.isPending && !count ? (
              <Skeleton height={80} />
            ) : count ? (
              <View className="border-border gap-1.5 rounded-lg border p-3">
                {count.classBreakdown.map((b) => (
                  <View key={b.cls} className="flex-row justify-between">
                    <Text size="sm" color="mutedForeground">
                      Class {b.cls}
                    </Text>
                    <Text size="sm" tabular>
                      {b.withPhone} of {b.total} reachable
                    </Text>
                  </View>
                ))}
                <View className="border-border mt-1 flex-row justify-between border-t pt-2">
                  <Text size="sm" weight="medium">
                    Parents to text
                  </Text>
                  <Text size="sm" weight="semibold" tabular>
                    {count.withPhone}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text size="sm" weight="medium">
                    Credits needed
                  </Text>
                  <Text
                    size="sm"
                    weight="semibold"
                    tabular
                    color={cost.tooExpensive ? 'destructive' : undefined}
                  >
                    {text ? cost.credits.toLocaleString() : '—'}
                  </Text>
                </View>
                {cost.tooExpensive ? (
                  <Text size="xs" color="destructive">
                    Not enough balance ({balance?.toLocaleString()} left).
                  </Text>
                ) : null}
              </View>
            ) : null
          ) : null}
          <Button
            icon={Send}
            label={send.isPending ? 'Sending…' : `Send to ${parents}`}
            disabled={sorted.length === 0 || !text.trim() || send.isPending || cost.tooExpensive}
            onPress={() => setConfirm(true)}
            testID="bulk-send"
          />
        </View>
      </SectionCard>
      <ConfirmDialog
        open={confirm}
        title="Send this SMS?"
        message={`Class ${sorted.join(', ')}: ${parents}, ${cost.credits.toLocaleString()} credits. This can't be undone.`}
        confirmLabel="Send SMS"
        tone="default"
        busy={send.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => send.mutate()}
      />
    </View>
  );
}

function SettingsTab({
  draft,
  setDraft,
  required,
  setRequired,
  errors,
  setErrors,
  schoolName,
}: {
  draft: SmsSettings;
  setDraft: (patch: Partial<SmsSettings>) => void;
  required: string[];
  setRequired: (r: string[]) => void;
  errors: Partial<Record<TemplateField, string>>;
  setErrors: (e: Partial<Record<TemplateField, string>>) => void;
  schoolName: string;
}) {
  const { sms } = useApi();
  const { resolution } = useTenant();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState<TemplateField | null>(null);
  const [phone, setPhone] = useState('');
  const [testText, setTestText] = useState('');
  const [testErrors, setTestErrors] = useState<{ phoneNumber?: string; message?: string }>({});

  const test = useMutation({
    mutationFn: (v: { phone: string; message: string }) => sms.sendTest(v.phone, v.message),
    onSuccess: () => {
      toast.success('Test SMS sent');
      setTestText('');
      setTestErrors({});
      for (const k of ['sms-balance', 'sms-usage']) {
        void queryClient.invalidateQueries({ queryKey: privateQueryKey(resolution.tenantKey, k) });
      }
    },
    onError: (e) => toast.error(mutationErrorMessage(e, 'Failed to send test SMS')),
  });
  const sendTest = () => {
    const v = testSmsErrors(phone, testText, PHONE_NUMBER);
    setTestErrors(v.errors);
    if (Object.keys(v.errors).length === 0) test.mutate({ phone: v.phone, message: v.message });
  };

  return (
    <View className="gap-6">
      <SectionCard>
        <Checkbox
          checked={draft.is_active}
          onChange={(on) => {
            setDraft({ is_active: on });
            if (!on) setErrors({});
          }}
          label="Send attendance SMS"
          description="Master switch. When off, no attendance messages are sent, whatever the settings below say."
          testID="sms-master"
        />
      </SectionCard>
      <View className="flex-row flex-wrap gap-6">
        <View className="min-w-[300px] flex-[3] gap-4">
          {TEMPLATES.map((t) => {
            const text = draft[t.field];
            const filled = fillSmsTemplate(text, { ...SAMPLE_SMS_VALUES, school_name: schoolName });
            return (
              <SectionCard key={t.field} testID={`template-${t.field}`}>
                <View className="gap-3">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center gap-2">
                        <View className={cn('h-2 w-2 rounded-full', t.dot)} />
                        <Text size="sm" weight="semibold">
                          {t.title}
                        </Text>
                      </View>
                      <Text size="xs" color="mutedForeground">
                        {t.description}
                      </Text>
                    </View>
                    <Checkbox
                      checked={draft[t.toggle]}
                      onChange={(on) => {
                        setDraft({ [t.toggle]: on });
                        if (!on) setErrors({ ...errors, [t.field]: undefined });
                      }}
                      label="Send"
                    />
                  </View>
                  <Textarea
                    label={`${t.title} message`}
                    rows={5}
                    value={text}
                    disabled={!draft[t.toggle]}
                    onChange={(v) => {
                      setDraft({ [t.field]: v });
                      if (errors[t.field]) {
                        setErrors({
                          ...errors,
                          [t.field]: templateError(t, { ...draft, [t.field]: v }, required),
                        });
                      }
                    }}
                  />
                  {errors[t.field] ? (
                    <Text size="xs" color="destructive">
                      {errors[t.field]}
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Estimate text={filled} suffix=" per student" />
                    {text ? (
                      <Button
                        variant="link"
                        size="sm"
                        label={
                          preview === t.field ? 'Hide preview' : 'Preview with a sample student'
                        }
                        onPress={() => setPreview(preview === t.field ? null : t.field)}
                      />
                    ) : null}
                  </View>
                  {preview === t.field && text ? (
                    <View className="bg-muted/50 rounded-lg p-3">
                      <Text size="sm">{filled}</Text>
                    </View>
                  ) : null}
                </View>
              </SectionCard>
            );
          })}
        </View>
        <SectionCard title="Placeholders" className="min-w-[260px] flex-[2] self-start">
          <View className="gap-3">
            <Text size="sm" color="mutedForeground">
              Ticked placeholders must appear in every message; unticked ones aren&apos;t allowed.
              {' {student_name}'} is always required.
            </Text>
            {ELECTIVE_TOKENS.map((tok) => {
              const on = required.includes(tok.id);
              return (
                <Checkbox
                  key={tok.id}
                  boxed
                  checked={on}
                  onChange={(next) =>
                    setRequired(next ? [...required, tok.id] : required.filter((p) => p !== tok.id))
                  }
                  label={`${tok.label}  ${tok.id}`}
                />
              );
            })}
          </View>
        </SectionCard>
      </View>
      <SectionCard
        title="Send a test SMS"
        description="Uses one real credit. Placeholders aren't filled in."
      >
        <View className="flex-row flex-wrap items-start gap-3">
          <View className="w-48 gap-1">
            <Input
              accessibilityLabel="Phone number"
              keyboardType="phone-pad"
              placeholder="017XXXXXXXX"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                if (testErrors.phoneNumber)
                  setTestErrors({ ...testErrors, phoneNumber: undefined });
              }}
              testID="test-phone"
            />
            {testErrors.phoneNumber ? (
              <Text size="xs" color="destructive">
                {testErrors.phoneNumber}
              </Text>
            ) : null}
          </View>
          <View className="min-w-[220px] flex-1 gap-1">
            <Input
              accessibilityLabel="Test message"
              placeholder="Hello from school"
              value={testText}
              onChangeText={(v) => {
                setTestText(v);
                if (testErrors.message) setTestErrors({ ...testErrors, message: undefined });
              }}
              testID="test-message"
            />
            {testErrors.message ? (
              <Text size="xs" color="destructive">
                {testErrors.message}
              </Text>
            ) : (
              <Estimate text={testText} />
            )}
          </View>
          <Button
            variant="outline"
            icon={Send}
            label={test.isPending ? 'Sending…' : 'Send test'}
            disabled={test.isPending}
            onPress={sendTest}
            testID="test-send"
          />
        </View>
      </SectionCard>
    </View>
  );
}

export function SmsScreen() {
  const { sms, attendance } = useApi();
  const { resolution } = useTenant();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('logs');
  const [category, setCategory] = useState<SmsCategory[]>(['attendance']);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<SmsLog[]>([]);

  const balanceKey = privateQueryKey(resolution.tenantKey, 'sms-balance');
  const balanceQ = useQuery({
    queryKey: balanceKey,
    queryFn: ({ signal }) => sms.balance(signal),
    staleTime: 60_000,
  });
  const balance = balanceQ.data?.estimatedSms ?? null;

  const publicQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'sms-settings-public'),
    queryFn: ({ signal }) => attendance.smsSettings(signal),
    staleTime: 5 * 60_000,
  });
  const schoolName = publicQ.data?.school_name ?? '';

  // Settings draft (null until loaded; reloaded after Discard / Save).
  const settingsQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'sms-settings'),
    queryFn: ({ signal }) => sms.settings(signal),
    enabled: tab === 'settings',
  });
  const [draft, setDraftState] = useState<SmsSettings | null>(null);
  const [required, setRequiredState] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<TemplateField, string>>>({});
  useEffect(() => {
    if (settingsQ.data && !dirty) {
      setDraftState(settingsQ.data);
      setRequiredState(initialRequired(settingsQ.data));
      setErrors({});
    }
  }, [settingsQ.data, dirty]);
  const setDraft = (patch: Partial<SmsSettings>) => {
    setDirty(true);
    setDraftState((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const setRequired = (r: string[]) => {
    setDirty(true);
    setRequiredState(r);
  };

  const invalidate = (...keys: string[]) => {
    for (const k of keys) {
      void queryClient.invalidateQueries({ queryKey: privateQueryKey(resolution.tenantKey, k) });
    }
  };
  const saveSettings = useMutation({
    mutationFn: (v: { s: SmsSettings; required: string[] }) => sms.saveSettings(v.s, v.required),
    onSuccess: () => {
      toast.success('SMS settings saved');
      setDirty(false);
      invalidate('sms-settings', 'sms-settings-public');
    },
    onError: (e) => toast.error(mutationErrorMessage(e, 'Failed to save SMS settings')),
  });
  const submitSettings = () => {
    if (!draft) return;
    const e = settingsErrors(draft, required);
    setErrors(e);
    if (Object.keys(e).length === 0) saveSettings.mutate({ s: draft, required });
  };

  const retry = useMutation({
    mutationFn: (ids: number[]) => sms.retry(ids),
    onSuccess: (msg) => {
      toast.success(msg);
      setSelected(new Set());
      invalidate('sms-logs', 'sms-balance', 'sms-usage');
    },
    onError: (e) => toast.error(mutationErrorMessage(e, 'Failed to retry SMS messages')),
  });
  const remove = useMutation({
    mutationFn: (ids: number[]) => sms.deleteLogs(ids),
    onSuccess: (msg) => {
      toast.success(msg);
      setDeleteOpen(false);
      setSelected(new Set());
      invalidate('sms-logs');
    },
    onError: (e) => {
      setDeleteOpen(false);
      toast.error(mutationErrorMessage(e, 'Failed to delete SMS logs'));
    },
  });

  const retryIds = useMemo(() => retryableIds(visibleLogs, selected), [visibleLogs, selected]);

  const footer =
    tab === 'logs' && selected.size > 0 ? (
      <ActionBar
        label={`${plural(selected.size, 'message')} selected`}
        onClear={() => setSelected(new Set())}
        testID="sms-bulk-bar"
      >
        <Button
          variant="outline"
          size="sm"
          icon={RotateCw}
          label={
            retry.isPending ? 'Retrying…' : `Retry${retryIds.length ? ` ${retryIds.length}` : ''}`
          }
          disabled={retry.isPending || retryIds.length === 0}
          onPress={() => retry.mutate(retryIds)}
          testID="sms-retry"
        />
        <Button
          variant="outline"
          size="sm"
          icon={Trash2}
          label="Delete"
          disabled={remove.isPending}
          onPress={() => setDeleteOpen(true)}
          testID="sms-delete"
        />
      </ActionBar>
    ) : tab === 'settings' && dirty ? (
      <ActionBar label="Unsaved changes" testID="sms-unsaved">
        <Button variant="ghost" size="sm" label="Discard" onPress={() => setDirty(false)} />
        <Button
          size="sm"
          label={saveSettings.isPending ? 'Saving…' : 'Save settings'}
          disabled={saveSettings.isPending}
          onPress={submitSettings}
          testID="sms-save"
        />
      </ActionBar>
    ) : null;

  return (
    <PageLayout
      title="SMS"
      description={
        balanceQ.isPending
          ? 'Loading balance…'
          : balanceQ.isError
            ? 'Balance unavailable'
            : `${balance != null ? `≈ ${balance.toLocaleString()}` : '—'} SMS credits left`
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          label="Refresh balance"
          disabled={balanceQ.isFetching}
          onPress={() => void queryClient.invalidateQueries({ queryKey: balanceKey })}
        />
      }
      footer={footer}
    >
      <Tabs
        tabs={[
          { id: 'logs', label: 'Delivery logs', icon: Inbox },
          { id: 'bulk', label: 'Bulk SMS', icon: Send },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]}
        value={tab}
        onChange={setTab}
        testID="sms-tab"
      />
      {tab === 'logs' ? (
        <LogsTab
          selected={selected}
          setSelected={setSelected}
          onLogs={setVisibleLogs}
          category={category}
          setCategory={setCategory}
        />
      ) : tab === 'bulk' ? (
        <BulkTab
          balance={balance}
          onSent={() => {
            setCategory(['bulk']);
            setTab('logs');
          }}
        />
      ) : draft ? (
        <SettingsTab
          draft={draft}
          setDraft={setDraft}
          required={required}
          setRequired={setRequired}
          errors={errors}
          setErrors={setErrors}
          schoolName={schoolName}
        />
      ) : settingsQ.isError ? (
        <ErrorState
          title="Couldn't load SMS settings. Refresh to try again."
          message={settingsQ.error.message}
          onRetry={() => void settingsQ.refetch()}
        />
      ) : (
        <View className="gap-4">
          <Skeleton height={64} />
          <Skeleton height={160} />
          <Skeleton height={160} />
        </View>
      )}
      <ConfirmDialog
        open={deleteOpen}
        busy={remove.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate([...selected])}
        confirmLabel="Delete logs"
        message={`Delete ${plural(selected.size, 'SMS log')}? This can't be undone.`}
      />
    </PageLayout>
  );
}
