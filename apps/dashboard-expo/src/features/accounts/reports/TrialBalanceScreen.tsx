/**
 * Trial Balance, replicating dashboard/src/pages/Admin/Accounts/Reports/TrialBalance.tsx: Year /
 * From / To, Full / Short (every head rolled into its top-level parent and netted, in paisa),
 * Code (only when some head has one), Head (indented), Type, Debit, Credit and the Total row,
 * red with the difference when out of balance. Live data: GET /api/acc-reports/trial-balance.
 * Excel export is not ported.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { TYPE_LABELS, trialBalanceView, type TbRow } from '@/features/accounts/model';
import { ReportYearSelect, ExportCsvButton } from '@/features/accounts/report-ui';
import { useAccHeads, useFinanceKey } from '@/features/finance/queries';
import { DateField, FilterField, Filters, Money, TotalBar } from '@/features/finance/ui';
import { todayYmd } from '@/features/holidays/model';
import { formatMoney, ZERO } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import { trialBalanceSheet } from '@/features/accounts/report-export';
import { useApi } from '@/session/ApiProvider';

export function TrialBalanceScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const heads = useAccHeads();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const [short, setShort] = useState(false);
  const params = {
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
  };
  const q = useQuery({
    queryKey: key('acc-report', 'trial-balance', params),
    queryFn: () => accounts.trialBalance(params),
  });
  const view = trialBalanceView(q.data?.rows ?? [], heads.data ?? [], short, {
    debit: q.data?.total_debit ?? ZERO,
    credit: q.data?.total_credit ?? ZERO,
  });

  const columns: Column<TbRow>[] = [
    ...(view.hasCodes
      ? [
          {
            key: 'code',
            label: 'Code',
            className: 'w-28',
            render: (r: TbRow) => (
              <Text size="sm" color="mutedForeground" tabular>
                {r.code ?? '—'}
              </Text>
            ),
          },
        ]
      : []),
    {
      key: 'head',
      label: 'Head',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" numberOfLines={1} style={{ paddingLeft: r.depth * 20 }}>
          {r.name}
        </Text>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground">
          {TYPE_LABELS[r.type]}
        </Text>
      ),
    },
    {
      key: 'dr',
      label: 'Debit',
      className: 'w-40',
      align: 'right',
      render: (r) => <Money value={r.debit} blankZero />,
    },
    {
      key: 'cr',
      label: 'Credit',
      className: 'w-40',
      align: 'right',
      render: (r) => <Money value={r.credit} blankZero />,
    },
  ];
  const off = view.difference !== 0;

  return (
    <PageLayout
      title="Trial Balance"
      actions={<ExportCsvButton sheet={q.data ? () => trialBalanceSheet(view, from, to) : null} />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <Filters>
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
        <FilterField label="Detail">
          <View
            className="bg-muted flex-row rounded-lg p-1"
            role="group"
            accessibilityLabel="Detail"
          >
            {(['Full', 'Short'] as const).map((label) => {
              const on = short === (label === 'Short');
              return (
                <Pressable
                  key={label}
                  aria-pressed={on}
                  onPress={() => setShort(label === 'Short')}
                  className={cn('rounded-md px-3 py-1', on && 'bg-background')}
                  testID={`tb-${label.toLowerCase()}`}
                >
                  <Text size="sm" weight="medium" color={on ? 'foreground' : 'mutedForeground'}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterField>
      </Filters>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load the trial balance"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="trial-balance"
            rows={view.rows}
            columns={columns}
            rowKey={(r) => r.head_id}
            loading={q.isPending}
            empty="No balances in this period."
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text size="sm" numberOfLines={1} style={{ paddingLeft: r.depth * 12 }}>
                    {r.name}
                  </Text>
                  <Text size="xs" color="mutedForeground">
                    {[r.code, TYPE_LABELS[r.type]].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text size="sm" tabular>
                  {r.debit ? `Dr ${formatMoney(r.debit)}` : `Cr ${formatMoney(r.credit)}`}
                </Text>
              </View>
            )}
          />
          {q.data ? (
            <TotalBar testID="tb-total">
              <Text size="sm" weight="semibold" color={off ? 'destructive' : undefined}>
                {off ? `Total — out of balance by ${formatMoney(view.difference)}` : 'Total'}
              </Text>
              <Text size="sm" weight="semibold" tabular color={off ? 'destructive' : undefined}>
                {`Dr ${formatMoney(view.debit)} · Cr ${formatMoney(view.credit)}`}
              </Text>
            </TotalBar>
          ) : null}
        </>
      )}
    </PageLayout>
  );
}
