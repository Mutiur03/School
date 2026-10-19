/**
 * Vouchers, replicating dashboard/src/pages/Admin/Accounts/Vouchers.tsx: New voucher, Type / Year
 * / From / To filters, the table (Voucher, Date, Type, Narration + Ref, Total, actions) where
 * fee-receipt, opening, closing and closed-year vouchers show a lock label instead of actions
 * (the server refuses to change them too), the voucher form, and delete behind a confirm.
 * Live data: GET/DELETE /api/vouchers, GET /api/acc-years (admin, this school).
 */
import type { VoucherType } from '@school/shared-schemas';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { VOUCHER_LABEL, VOUCHER_MODES, lockHint, voucherLock } from '@/features/accounts/model';
import { ReportYearSelect } from '@/features/accounts/report-ui';
import { VoucherForm } from '@/features/accounts/VoucherForm';
import { MONEY_KEYS, useAccYears, useFinanceKey } from '@/features/finance/queries';
import { DateField, Filters, LabeledSelect, Money, Pill } from '@/features/finance/ui';
import { formatDay, todayYmd } from '@/features/holidays/model';
import type { Voucher } from '@/lib/api';
import { formatMoney, ZERO } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';

const TYPE_TONE: Record<VoucherType, 'emerald' | 'red' | 'sky' | 'violet'> = {
  receipt: 'emerald',
  payment: 'red',
  contra: 'sky',
  journal: 'violet',
};

export function VouchersScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const flight = useSingleFlight();
  const [type, setType] = useState<VoucherType | ''>('');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const filters = {
    type: type || undefined,
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
  };
  const q = useQuery({
    queryKey: key('vouchers', filters),
    queryFn: () => accounts.vouchers(filters),
  });
  const years = useAccYears();
  const closedYears = new Set((years.data ?? []).filter((y) => y.closed).map((y) => y.year));
  // undefined = closed, null = new
  const [form, setForm] = useState<Voucher | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
  const remove = useAdminMutation({
    mutationFn: (id: number) => accounts.deleteVoucher(id),
    invalidate: MONEY_KEYS,
    success: 'Voucher deleted.',
    failure: 'Failed to delete the voucher.',
    onSuccess: () => setDeleteTarget(null),
  });

  const actions = (v: Voucher) => {
    const lock = voucherLock(v, closedYears);
    if (lock)
      return (
        <View accessibilityHint={lockHint(lock)}>
          <Badge label={lock} variant="outline" />
        </View>
      );
    return (
      <View className="flex-row gap-0.5">
        <ActionButton
          icon={Pencil}
          label={`Edit ${v.voucher_no}`}
          tone="emerald"
          onPress={() => setForm(v)}
        />
        <ActionButton
          icon={Trash2}
          label={`Delete ${v.voucher_no}`}
          tone="red"
          onPress={() => setDeleteTarget(v)}
        />
      </View>
    );
  };
  const columns: Column<Voucher>[] = [
    {
      key: 'no',
      label: 'Voucher',
      className: 'w-28',
      render: (v) =>
        voucherLock(v, closedYears) ? (
          <Text size="sm" weight="medium" tabular>
            {v.voucher_no}
          </Text>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => setForm(v)}>
            <Text size="sm" weight="medium" tabular className="hover:underline">
              {v.voucher_no}
            </Text>
          </Pressable>
        ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-32',
      render: (v) => (
        <Text size="sm" color="mutedForeground">
          {formatDay(v.date)}
        </Text>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      className: 'w-28',
      render: (v) => <Pill label={VOUCHER_LABEL[v.type]} tone={TYPE_TONE[v.type]} />,
    },
    {
      key: 'narration',
      label: 'Narration',
      className: 'min-w-0 flex-1',
      render: (v) => (
        <View>
          <Text size="sm" numberOfLines={1} color={v.narration ? undefined : 'mutedForeground'}>
            {v.narration || '—'}
          </Text>
          {v.reference ? (
            <Text size="xs" color="mutedForeground">
              Ref: {v.reference}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      className: 'w-36',
      align: 'right',
      render: (v) => <Money value={v.total} />,
    },
    { key: 'actions', label: 'Actions', className: 'w-[150px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Vouchers"
      description="Receipts, payments, transfers and journals."
      actions={
        <Button
          icon={Plus}
          label="New voucher"
          onPress={() => setForm(null)}
          testID="new-voucher"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <Filters>
        <LabeledSelect
          label="Type"
          value={type}
          onChange={setType}
          className="w-40"
          options={[
            { value: '', label: 'All types' },
            ...VOUCHER_MODES.map((m) => ({ value: m.type, label: m.label })),
          ]}
        />
        <ReportYearSelect
          from={from}
          to={to}
          onPick={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </Filters>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load vouchers"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="vouchers"
          rows={q.data ?? []}
          columns={columns}
          rowKey={(v) => v.id}
          loading={q.isPending}
          empty="No vouchers for these filters."
          renderMobile={(v) => (
            <View className="gap-1.5">
              <View className="flex-row items-center gap-2">
                <Text size="sm" weight="semibold" tabular>
                  {v.voucher_no}
                </Text>
                <Pill label={VOUCHER_LABEL[v.type]} tone={TYPE_TONE[v.type]} />
                <Text size="xs" color="mutedForeground" className="ml-auto">
                  {formatDay(v.date)}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text
                  size="sm"
                  className="min-w-0 flex-1"
                  numberOfLines={1}
                  color={v.narration ? undefined : 'mutedForeground'}
                >
                  {v.narration || '—'}
                </Text>
                <Money value={v.total} weight="semibold" />
              </View>
              <View className="flex-row justify-end">{actions(v)}</View>
            </View>
          )}
        />
      )}
      {form !== undefined ? (
        <VoucherForm key={form?.id ?? 'new'} voucher={form} onClose={() => setForm(undefined)} />
      ) : null}
      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Delete voucher ${deleteTarget?.voucher_no ?? ''} (${formatMoney(deleteTarget?.total ?? ZERO)})? This cannot be undone.`}
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete voucher'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && void flight.run(() => remove.mutateAsync(deleteTarget.id)).catch(() => {})
        }
      />
    </PageLayout>
  );
}
