/**
 * Collect Fees, replicating dashboard/src/pages/Admin/Fees/FeeCollection.tsx: session + student
 * picker, the student card (Paid / Waived / Due), the installment table with ticks, "Select all
 * due", date, "Received in" (only when a picked fee has no fixed account), remarks, "Money goes
 * to", and Collect. The receipt PDF opens after collecting.
 *
 * Money safety:
 * - totals are integer paisa from the server's own payable values; the request carries only the
 *   installments (fee_head_id + month): the server prices them again and rejects paid, waived or
 *   duplicate items, a closed year, and (via a unique index) a second collection of the same one;
 * - Collect opens a confirm with the amount and destinations; the confirm and Collect buttons are
 *   disabled while saving and a synchronous single-flight guard drops double taps;
 * - after any outcome the statement is re-read, so a request that timed out but was saved shows
 *   as paid instead of being collected twice.
 * Live data: GET /api/fee-receipts/statement, GET /api/acc-heads, POST /api/fee-receipts,
 * GET /api/fee-receipts/:id/pdf (admin only, this school from the token).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Banknote, Printer } from '@/components/ui/icons';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { todayYmd } from '@/features/holidays/model';
import {
  collectConfirmMessage,
  collectionSummary,
  dueKey,
  isYmd,
  monthLabel,
  receiptInput,
  retainDue,
  toggleAllDue,
  toggleKey,
  type PickerStudent,
} from '@/features/fees/model';
import { StudentPicker } from '@/features/fees/StudentPicker';
import { MONEY_KEYS, useAccHeads, useFinanceKey } from '@/features/finance/queries';
import {
  DateField,
  FilterField,
  LabeledSelect,
  Money,
  Pill,
  TotalBar,
  YearSelect,
} from '@/features/finance/ui';
import { isApiError, type DueRow } from '@/lib/api';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { formatMoney } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';

const STATUS_TONE = { paid: 'emerald', waived: 'sky', due: 'amber' } as const;

export function CollectFeesScreen() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const qc = useQueryClient();
  const toast = useToast();
  const flight = useSingleFlight();
  const [year, setYear] = useState(new Date().getFullYear());
  const [student, setStudent] = useState<PickerStudent | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [payHeadId, setPayHeadId] = useState(0);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const heads = useAccHeads();
  const cashBank = (heads.data ?? []).filter((h) => h.is_cash_bank && h.is_active);
  const statement = useQuery({
    queryKey: key('fee-statement', student?.id ?? 0, year),
    queryFn: () => fees.statement(student!.id, year),
    enabled: !!student,
  });
  const rows = useMemo(() => statement.data?.rows ?? [], [statement.data]);
  // a reload (after collecting, or someone else collecting) drops picks that are no longer due
  useEffect(() => setPicked((p) => retainDue(p, rows)), [rows]);

  const payHead = cashBank.find((h) => h.id === payHeadId) ?? null;
  const summary = collectionSummary(rows, picked, payHead);
  const dueCount = rows.filter((r) => r.status === 'due').length;
  const allPicked = picked.size === dueCount && dueCount > 0;

  const refreshMoney = () => {
    for (const parts of MONEY_KEYS) void qc.invalidateQueries({ queryKey: key(...parts) });
  };
  const collect = useMutation({ mutationFn: fees.collect });
  const busy = collect.isPending || flight.busy;

  const reset = (s: PickerStudent | null) => {
    setStudent(s);
    setPicked(new Set());
  };

  const ask = () => {
    if (!student || !statement.data) return;
    if (summary.issue) return toast.error(summary.issue);
    if (!isYmd(date)) return toast.error('Enter the collection date');
    setConfirming(true);
  };

  const confirm = async () => {
    if (!student || !statement.data || summary.issue) return;
    const input = receiptInput({
      studentId: student.id,
      year,
      date,
      payHeadId: payHead?.id ?? null,
      note,
      collection: summary,
    });
    try {
      const receipt = await flight.run(() => collect.mutateAsync(input));
      if (!receipt) return; // a second tap while the first was saving
      setPicked(new Set());
      setNote('');
      setConfirming(false);
      toast.success(
        receipt.receipt_no ? `Receipt #${receipt.receipt_no} saved.` : 'Fees collected.',
      );
      const opened = await openPdf(
        () => fees.receiptPdf(receipt.id),
        pdfFileName(['receipt', receipt.receipt_no ?? receipt.id, statement.data.student.name]),
      ).catch(() => 'unavailable' as const);
      if (opened !== 'opened') toast.error('Saved. Print the receipt from Fee Receipts.');
    } catch (e) {
      setConfirming(false);
      toast.error(
        isApiError(e) && e.isTransport
          ? 'No reply from the server. The fees may have been collected: check the list below (it has been reloaded) or Fee Receipts before trying again.'
          : mutationErrorMessage(e, 'Failed to collect fees.'),
      );
    } finally {
      refreshMoney();
    }
  };

  const columns: Column<DueRow>[] = [
    {
      key: 'pick',
      label: ' ',
      className: 'w-10',
      render: (r) => (
        <Checkbox
          checked={picked.has(dueKey(r))}
          disabled={r.status !== 'due' || busy}
          onChange={() => setPicked((p) => toggleKey(p, dueKey(r)))}
          label=""
          accessibilityLabel={`${r.fee_head} ${monthLabel(r.month)}`}
        />
      ),
    },
    {
      key: 'fee',
      label: 'Fee',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" numberOfLines={1}>
          {r.fee_head}
          {r.deposit ? (
            <Text size="xs" color="mutedForeground">
              {`  → ${r.deposit.name}`}
            </Text>
          ) : null}
        </Text>
      ),
    },
    {
      key: 'month',
      label: 'Month',
      className: 'w-24',
      render: (r) => (
        <Text size="sm" color="mutedForeground">
          {monthLabel(r.month)}
        </Text>
      ),
    },
    {
      key: 'charge',
      label: 'Charge',
      className: 'w-28',
      align: 'right',
      render: (r) => <Money value={r.charge} />,
    },
    {
      key: 'waiver',
      label: 'Waiver',
      className: 'w-28',
      align: 'right',
      render: (r) =>
        r.waiver ? (
          <Money value={r.waiver} />
        ) : (
          <Text size="sm" color="mutedForeground">
            —
          </Text>
        ),
    },
    {
      key: 'payable',
      label: 'Payable',
      className: 'w-28',
      align: 'right',
      render: (r) => <Money value={r.payable} />,
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-32',
      render: (r) => (
        <View className="flex-row items-center gap-2">
          <Pill label={r.status} tone={STATUS_TONE[r.status]} />
          {r.receipt_no ? (
            <Text size="xs" color="mutedForeground">
              #{r.receipt_no}
            </Text>
          ) : null}
        </View>
      ),
    },
  ];

  const st = statement.data;
  return (
    <PageLayout
      title="Collect Fees"
      description="Pick a student, tick the installments being paid, collect."
      onRefresh={student ? () => void statement.refetch() : undefined}
      refreshing={statement.isRefetching}
    >
      <View className="flex-row flex-wrap items-end gap-3">
        <YearSelect
          value={year}
          onChange={(y) => {
            setYear(y);
            reset(null);
          }}
        />
        <StudentPicker key={year} year={year} value={student?.id ?? null} onChange={reset} />
      </View>

      {!student ? (
        <EmptyState message="Select a student to see their fees." />
      ) : statement.isError && !st ? (
        <ErrorState
          title="Couldn't load the fees"
          message={statement.error.message}
          onRetry={() => void statement.refetch()}
        />
      ) : (
        <>
          {st ? (
            <SectionCard testID="fee-student">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View className="min-w-0 shrink">
                  <Text size="lg" weight="semibold">
                    {st.student.name}
                  </Text>
                  <Text size="sm" color="mutedForeground">
                    {`ID ${st.student.login_id} · Class ${st.enrollment.class}-${st.enrollment.section} · Roll ${st.enrollment.roll}`}
                    {st.student.father_name ? ` · Father: ${st.student.father_name}` : ''}
                  </Text>
                </View>
                <View className="flex-row gap-6">
                  {(
                    [
                      ['Paid', st.totals.paid, undefined],
                      ['Waived', st.totals.waiver, undefined],
                      ['Due', st.totals.due, 'text-destructive'],
                    ] as const
                  ).map(([label, v, cls]) => (
                    <View key={label}>
                      <Text size="sm" color="mutedForeground">
                        {label}
                      </Text>
                      <Money value={v} weight="semibold" className={cls} />
                    </View>
                  ))}
                </View>
              </View>
            </SectionCard>
          ) : null}

          <DataTable
            testID="fee-dues"
            rows={rows}
            columns={columns}
            rowKey={dueKey}
            loading={statement.isPending}
            empty="No fees are set for this class. Add them under Fee Structure."
            onRowPress={(r) =>
              r.status === 'due' && !busy ? setPicked((p) => toggleKey(p, dueKey(r))) : undefined
            }
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <Checkbox
                  checked={picked.has(dueKey(r))}
                  disabled={r.status !== 'due' || busy}
                  onChange={() => setPicked((p) => toggleKey(p, dueKey(r)))}
                  label=""
                  accessibilityLabel={`${r.fee_head} ${monthLabel(r.month)}`}
                />
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {`${r.fee_head} · ${monthLabel(r.month)}`}
                  </Text>
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {`Charge ${formatMoney(r.charge)}${r.waiver ? ` · Waiver ${formatMoney(r.waiver)}` : ''}${r.deposit ? ` · → ${r.deposit.name}` : ''}`}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Money value={r.payable} weight="semibold" />
                  <Pill label={r.status} tone={STATUS_TONE[r.status]} />
                </View>
              </View>
            )}
          />
          {rows.length > 0 ? (
            <TotalBar testID="fee-total">
              <Button
                variant="link"
                size="sm"
                label={allPicked ? 'Clear selection' : 'Select all due'}
                disabled={dueCount === 0 || busy}
                onPress={() => setPicked((p) => toggleAllDue(p, rows))}
                testID="fee-select-all"
              />
              <Text size="sm" weight="semibold" tabular>
                {`Total ${formatMoney(summary.total)}`}
              </Text>
            </TotalBar>
          ) : null}

          <View className="flex-row flex-wrap items-end gap-3">
            <DateField label="Date" value={date} onChange={setDate} testID="fee-date" />
            {summary.needsPayHead || picked.size === 0 ? (
              <LabeledSelect
                label="Received in"
                value={payHeadId}
                onChange={setPayHeadId}
                className="w-56"
                options={[
                  { value: 0, label: 'Select cash / bank' },
                  ...cashBank.map((h) => ({ value: h.id, label: h.name })),
                ]}
                testID="fee-pay-head"
              />
            ) : null}
            <FilterField label="Remarks" className="w-64 max-w-full">
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                maxLength={255}
                accessibilityLabel="Remarks"
              />
            </FilterField>
            <Button
              icon={Banknote}
              label={`Collect ${formatMoney(summary.total)}`}
              disabled={picked.size === 0 || busy}
              onPress={ask}
              testID="fee-collect"
            />
          </View>
          {summary.destinations.length > 0 ? (
            <Text size="sm" testID="fee-destinations">
              <Text size="sm" color="mutedForeground">
                Money goes to:{' '}
              </Text>
              {summary.destinations.map((d, i) => (
                <Text key={`${d.id}`} size="sm">
                  {i > 0 ? ' · ' : ''}
                  <Text size="sm" weight="semibold">
                    {d.name}
                  </Text>{' '}
                  {formatMoney(d.amount)}
                </Text>
              ))}
            </Text>
          ) : null}
          {heads.isSuccess && cashBank.length === 0 ? (
            <Text size="sm" color="mutedForeground">
              No cash/bank account yet. Mark an asset head as cash/bank under Accounts → Account
              Heads.
            </Text>
          ) : null}
          <View className="flex-row items-center gap-1">
            <Icon icon={Printer} size={14} color="mutedForeground" />
            <Text size="xs" color="mutedForeground">
              The receipt opens after collecting.
            </Text>
          </View>
        </>
      )}

      <ConfirmDialog
        open={confirming && !!st}
        title="Collect fees?"
        tone="default"
        message={st ? collectConfirmMessage(st, summary, date) : ''}
        confirmLabel={busy ? 'Collecting…' : `Collect ${formatMoney(summary.total)}`}
        busy={busy}
        onClose={() => (busy ? undefined : setConfirming(false))}
        onConfirm={() => void confirm()}
      />
    </PageLayout>
  );
}
