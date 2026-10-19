/**
 * Cost Center Report, replicating dashboard/src/pages/Admin/Accounts/Reports/CostCenterReport.tsx:
 * From / To, Cost center, Income, Expense, Net and the integer Total row.
 * Live data: GET /api/acc-reports/cost-center?from&to. Excel export is not ported.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { costCenterTotals } from '@/features/accounts/model';
import { useFinanceKey } from '@/features/finance/queries';
import { DateField, Filters, Money, TotalBar } from '@/features/finance/ui';
import { todayYmd } from '@/features/holidays/model';
import type { CostCenterReportRow } from '@/lib/api';
import { formatMoney } from '@/lib/money/money';
import { ExportCsvButton } from '@/features/accounts/report-ui';
import { costCenterSheet } from '@/features/accounts/report-export';
import { useApi } from '@/session/ApiProvider';

export function CostCenterReportScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const params = {
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
  };
  const q = useQuery({
    queryKey: key('acc-report', 'cost-center', params),
    queryFn: () => accounts.costCenterReport(params),
  });
  const rows = q.data ?? [];
  const t = costCenterTotals(rows);
  const columns: Column<CostCenterReportRow>[] = [
    {
      key: 'name',
      label: 'Cost center',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" numberOfLines={1}>
          {r.cost_center_name}
        </Text>
      ),
    },
    {
      key: 'income',
      label: 'Income',
      className: 'w-40',
      align: 'right',
      render: (r) => <Money value={r.income} />,
    },
    {
      key: 'expense',
      label: 'Expense',
      className: 'w-40',
      align: 'right',
      render: (r) => <Money value={r.expense} />,
    },
    {
      key: 'net',
      label: 'Net',
      className: 'w-40',
      align: 'right',
      render: (r) => <Money value={r.net} />,
    },
  ];
  return (
    <PageLayout
      title="Cost Center Report"
      actions={<ExportCsvButton sheet={q.data ? () => costCenterSheet(rows, from, to) : null} />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <Filters>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </Filters>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load the report"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="cc-report"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.cost_center_id}
            loading={q.isPending}
            empty="No cost-center activity in this period."
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {r.cost_center_name}
                  </Text>
                  <Text
                    size="xs"
                    color="mutedForeground"
                    tabular
                  >{`Income ${formatMoney(r.income)} · Expense ${formatMoney(r.expense)}`}</Text>
                </View>
                <Money value={r.net} weight="semibold" />
              </View>
            )}
          />
          {rows.length > 0 ? (
            <TotalBar testID="cc-total">
              <Text size="sm" weight="semibold">
                Total
              </Text>
              <Text
                size="sm"
                weight="semibold"
                tabular
                color={t.net < 0 ? 'destructive' : undefined}
              >
                {`Income ${formatMoney(t.income)} · Expense ${formatMoney(t.expense)} · Net ${formatMoney(t.net)}`}
              </Text>
            </TotalBar>
          ) : null}
        </>
      )}
    </PageLayout>
  );
}
