/**
 * Ledger, replicating dashboard/src/pages/Admin/Accounts/Reports/Ledger.tsx: Account head (grouped
 * by type), From / To, then Opening balance, every movement (Date, Voucher, Particulars + note,
 * Debit, Credit, running Balance Dr/Cr) and Closing balance. Amounts are the server's, in paisa.
 * Live data: GET /api/acc-reports/ledger?head_id&from&to. Excel export is not ported.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { TYPE_LABELS, headOptions } from '@/features/accounts/model';
import { useAccHeads, useFinanceKey } from '@/features/finance/queries';
import { DateField, Filters, LabeledSelect, Money } from '@/features/finance/ui';
import { formatDay, todayYmd } from '@/features/holidays/model';
import type { LedgerRow } from '@/lib/api';
import { drCr, formatMoney } from '@/lib/money/money';
import { ExportCsvButton } from '@/features/accounts/report-ui';
import { ledgerSheet } from '@/features/accounts/report-export';
import { useApi } from '@/session/ApiProvider';

export function LedgerScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const heads = useAccHeads();
  const [headId, setHeadId] = useState(0);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const params = {
    head_id: headId,
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
  };
  const q = useQuery({
    queryKey: key('acc-report', 'ledger', params),
    queryFn: () => accounts.ledger(params),
    enabled: headId > 0,
  });
  const d = q.data;

  const columns: Column<LedgerRow>[] = [
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
      key: 'no',
      label: 'Voucher',
      className: 'w-28',
      render: (r) => (
        <Text size="sm" tabular>
          {r.voucher_no}
        </Text>
      ),
    },
    {
      key: 'part',
      label: 'Particulars',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <View>
          <Text size="sm" numberOfLines={2}>
            {r.narration || '—'}
          </Text>
          {r.note ? (
            <Text size="xs" color="mutedForeground">
              {r.note}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'dr',
      label: 'Debit',
      className: 'w-36',
      align: 'right',
      render: (r) => <Money value={r.debit} blankZero />,
    },
    {
      key: 'cr',
      label: 'Credit',
      className: 'w-36',
      align: 'right',
      render: (r) => <Money value={r.credit} blankZero />,
    },
    {
      key: 'bal',
      label: 'Balance',
      className: 'w-40',
      align: 'right',
      render: (r) => (
        <Text size="sm" tabular>
          {drCr(r.balance)}
        </Text>
      ),
    },
  ];
  const balanceLine = (label: string, value: string, testID: string, strong?: boolean) => (
    <SectionCard testID={testID}>
      <View className="flex-row items-center justify-between">
        <Text size="sm" weight={strong ? 'semibold' : 'medium'}>
          {label}
        </Text>
        <Text size="sm" weight={strong ? 'semibold' : 'medium'} tabular>
          {value}
        </Text>
      </View>
    </SectionCard>
  );

  return (
    <PageLayout
      title="Ledger"
      actions={<ExportCsvButton sheet={d ? () => ledgerSheet(d, from, to) : null} />}
      description={
        d
          ? `${d.head.name} · ${TYPE_LABELS[d.head.type]}`
          : 'Pick an account head to see its movements.'
      }
      onRefresh={headId ? () => void q.refetch() : undefined}
      refreshing={q.isRefetching}
    >
      <Filters>
        <LabeledSelect
          label="Account head"
          value={headId}
          onChange={setHeadId}
          className="w-64 max-w-full"
          options={[{ value: 0, label: 'Select head…' }, ...headOptions(heads.data ?? [])]}
          testID="ledger-head"
        />
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </Filters>
      {!headId ? (
        <EmptyState message="Select an account head." />
      ) : q.isError && !d ? (
        <ErrorState
          title="Couldn't load the ledger"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          {d ? balanceLine('Opening balance', drCr(d.opening), 'ledger-opening') : null}
          <DataTable
            testID="ledger"
            rows={d?.rows ?? []}
            columns={columns}
            rowKey={(r) => `${r.voucher_id}-${r.date}-${r.debit}-${r.credit}-${r.balance}`}
            loading={q.isPending}
            empty="No transactions in this period."
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    size="sm"
                    weight="medium"
                    numberOfLines={1}
                  >{`${r.voucher_no} · ${r.narration || '—'}`}</Text>
                  <Text size="xs" color="mutedForeground">
                    {formatDay(r.date)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text size="sm" tabular>
                    {r.debit ? `Dr ${formatMoney(r.debit)}` : `Cr ${formatMoney(r.credit)}`}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {drCr(r.balance)}
                  </Text>
                </View>
              </View>
            )}
          />
          {d ? balanceLine('Closing balance', drCr(d.closing), 'ledger-closing', true) : null}
        </>
      )}
    </PageLayout>
  );
}
