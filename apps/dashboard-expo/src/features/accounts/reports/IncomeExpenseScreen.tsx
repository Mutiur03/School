/**
 * Income vs Expense, replicating dashboard/src/pages/Admin/Accounts/Reports/IncomeExpense.tsx:
 * Year / From / To, the "Net surplus / deficit" strip and the Income and Expense tables grouped
 * under parent heads with integer subtotals. Live data: GET /api/acc-reports/income-expense.
 * Excel export is not ported.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { AmountTable, ReportYearSelect, ExportCsvButton } from '@/features/accounts/report-ui';
import { useAccHeads, useFinanceKey } from '@/features/finance/queries';
import { DateField, Filters } from '@/features/finance/ui';
import { todayYmd } from '@/features/holidays/model';
import { absPaisa, formatMoney } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import { incomeExpenseSheet } from '@/features/accounts/report-export';
import { useApi } from '@/session/ApiProvider';

export function IncomeExpenseScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const heads = useAccHeads();
  const byId = useMemo(() => new Map((heads.data ?? []).map((h) => [h.id, h])), [heads.data]);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const params = {
    from: from.length === 10 ? from : undefined,
    to: to.length === 10 ? to : undefined,
  };
  const q = useQuery({
    queryKey: key('acc-report', 'income-expense', params),
    queryFn: () => accounts.incomeExpense(params),
  });
  const d = q.data;
  return (
    <PageLayout
      title="Income vs Expense"
      actions={<ExportCsvButton sheet={d ? () => incomeExpenseSheet(d, from, to) : null} />}
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
      </Filters>
      {q.isPending ? (
        <Skeleton height={256} />
      ) : q.isError || !d ? (
        <ErrorState
          title="Couldn't load the report"
          message={q.error?.message ?? "Couldn't load the report. Try again in a moment."}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View
            testID="ie-net"
            className={cn(
              'rounded-xl border px-5 py-4',
              d.net >= 0
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-destructive/40 bg-destructive/10',
            )}
          >
            <Text
              size="lg"
              weight="semibold"
              tabular
              className={d.net >= 0 ? 'text-emerald-700' : 'text-destructive'}
            >
              {`Net ${d.net >= 0 ? 'surplus' : 'deficit'}: ${formatMoney(absPaisa(d.net))}`}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-start gap-6">
            <View className="min-w-0 grow basis-full lg:basis-[48%]">
              <AmountTable
                title="Income"
                rows={d.income}
                total={d.total_income}
                byId={byId}
                testID="ie-income"
              />
            </View>
            <View className="min-w-0 grow basis-full lg:basis-[48%]">
              <AmountTable
                title="Expense"
                rows={d.expense}
                total={d.total_expense}
                byId={byId}
                testID="ie-expense"
              />
            </View>
          </View>
        </>
      )}
    </PageLayout>
  );
}
