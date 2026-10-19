/**
 * Fee Receipts, replicating dashboard/src/pages/Admin/Fees/FeeReceipts.tsx: From / To / Class /
 * Receipt no. filters, the receipts table (Receipt, Date, Student + ID, Class, Account(s) + the
 * voucher no., Total, Print / Delete) and the count + integer total under it. Delete is behind a
 * confirm (it also deletes the voucher and makes the fees due again) and can't be sent twice.
 * Live data: GET /api/fee-receipts, GET /api/fee-receipts/:id/pdf, DELETE /api/fee-receipts/:id.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View, Platform } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Printer, Share2, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { formatDay, todayYmd } from '@/features/holidays/model';
import { monthStartYmd } from '@/features/fees/model';
import { MONEY_KEYS, useFinanceKey } from '@/features/finance/queries';
import {
  ClassSelect,
  DateField,
  FilterField,
  Filters,
  Money,
  TotalBar,
} from '@/features/finance/ui';
import type { FeeReceiptListItem } from '@/lib/api';
import { openPdf, sharePdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { formatMoney, sumPaisa, ZERO } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';

const accountLabel = (r: FeeReceiptListItem) =>
  r.accounts.length > 1
    ? `Multiple: ${r.accounts.map((a) => a.name).join(', ')}`
    : (r.accounts[0]?.name ?? '—');

export function FeeReceiptsScreen() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const toast = useToast();
  const flight = useSingleFlight();
  const [from, setFrom] = useState(monthStartYmd());
  const [to, setTo] = useState(todayYmd());
  const [cls, setCls] = useState(0);
  const [receiptNo, setReceiptNo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FeeReceiptListItem | null>(null);
  const filters = {
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
    class: cls || undefined,
    receipt_no: receiptNo ? Number(receiptNo) : undefined,
  };
  const q = useQuery({
    queryKey: key('fee-receipts', filters),
    queryFn: () => fees.receipts(filters),
    staleTime: 15_000,
  });
  const receipts = q.data ?? [];
  const total = sumPaisa(receipts, (r) => r.total);

  const remove = useAdminMutation({
    mutationFn: (id: number) => fees.deleteReceipt(id),
    invalidate: MONEY_KEYS,
    success: 'Receipt deleted.',
    failure: 'Failed to delete the receipt.',
    onSuccess: () => setDeleteTarget(null),
  });

  const print = async (r: FeeReceiptListItem, mode: 'view' | 'share' = 'view') => {
    try {
      const res = await (mode === 'share' ? sharePdf : openPdf)(
        () => fees.receiptPdf(r.id),
        pdfFileName(['receipt', r.receipt_no, r.student?.name]),
      );
      if (res !== 'opened') toast.error('This device cannot open the receipt.');
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to open the receipt'));
    }
  };

  const actions = (r: FeeReceiptListItem) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Printer}
        label={`Print receipt ${r.receipt_no}`}
        tone="blue"
        onPress={() => void print(r)}
      />
      {Platform.OS !== 'web' ? (
        <ActionButton
          icon={Share2}
          label={`Share receipt ${r.receipt_no}`}
          tone="blue"
          onPress={() => void print(r, 'share')}
        />
      ) : null}
      <ActionButton
        icon={Trash2}
        label={`Delete receipt ${r.receipt_no}`}
        tone="red"
        onPress={() => setDeleteTarget(r)}
      />
    </View>
  );
  const columns: Column<FeeReceiptListItem>[] = [
    {
      key: 'no',
      label: 'Receipt',
      className: 'w-24',
      render: (r) => (
        <Text size="sm" weight="medium" tabular>
          #{r.receipt_no}
        </Text>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground">
          {formatDay(r.date)}
        </Text>
      ),
    },
    {
      key: 'student',
      label: 'Student',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <View>
          <Text size="sm" weight="medium" numberOfLines={1}>
            {r.student?.name ?? '—'}
          </Text>
          <Text size="xs" color="mutedForeground">
            ID {r.student?.login_id ?? '—'}
          </Text>
        </View>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      className: 'w-28',
      render: (r) => <Text size="sm">{`${r.class}-${r.section} · ${r.roll}`}</Text>,
    },
    {
      key: 'account',
      label: 'Account',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" color="mutedForeground" numberOfLines={2}>
          {accountLabel(r)}
          <Text size="xs" color="mutedForeground">{`  ${r.voucher_no}`}</Text>
        </Text>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      className: 'w-32',
      align: 'right',
      render: (r) => <Money value={r.total} />,
    },
    { key: 'actions', label: 'Actions', className: 'w-[96px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Fee Receipts"
      description="Every collection, with its voucher in the ledger."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <Filters>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        <ClassSelect value={cls} onChange={setCls} allowAll />
        <FilterField label="Receipt no." className="w-28">
          <Input
            value={receiptNo}
            onChangeText={(t) => setReceiptNo(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            accessibilityLabel="Receipt number"
          />
        </FilterField>
      </Filters>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load receipts"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="fee-receipts"
            rows={receipts}
            columns={columns}
            rowKey={(r) => r.id}
            loading={q.isPending}
            empty="No receipts for these filters."
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    size="sm"
                    weight="medium"
                    numberOfLines={1}
                  >{`#${r.receipt_no} · ${r.student?.name ?? '—'}`}</Text>
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {`${formatDay(r.date)} · ${r.class}-${r.section} · ${r.roll} · ${accountLabel(r)}`}
                  </Text>
                </View>
                <Money value={r.total} weight="semibold" />
                {actions(r)}
              </View>
            )}
          />
          {receipts.length > 0 ? (
            <TotalBar testID="fee-receipts-total">
              <Text size="sm" weight="semibold">
                {plural(receipts.length, 'receipt')}
              </Text>
              <Text size="sm" weight="semibold" tabular>
                {formatMoney(total)}
              </Text>
            </TotalBar>
          ) : null}
          {receipts.length >= 500 ? (
            <Text size="xs" color="mutedForeground">
              Showing the latest 500 receipts. Narrow the dates to see older ones.
            </Text>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Delete receipt #${deleteTarget?.receipt_no ?? ''} (${formatMoney(deleteTarget?.total ?? ZERO)}) and its voucher ${deleteTarget?.voucher_no ?? ''}? The fees become due again.`}
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete receipt'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget)
            void flight.run(() => remove.mutateAsync(deleteTarget.id)).catch(() => {});
        }}
      />
    </PageLayout>
  );
}
