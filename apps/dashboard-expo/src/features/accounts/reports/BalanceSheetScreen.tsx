/**
 * Balance Sheet, replicating dashboard/src/pages/Admin/Accounts/Reports/BalanceSheet.tsx: Year /
 * As of, the Balanced / Out of balance strip (compared in paisa), Assets, Liabilities and Equity
 * (with "Surplus / (deficit) to date") grouped under parent heads, and Total liabilities & equity.
 * Live data: GET /api/acc-reports/balance-sheet?to. Excel export is not ported.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { balanceSheetView } from '@/features/accounts/model';
import {
  AmountTable,
  BalanceBanner,
  ReportYearSelect,
  ExportCsvButton,
} from '@/features/accounts/report-ui';
import { useAccHeads, useFinanceKey } from '@/features/finance/queries';
import { DateField, Filters } from '@/features/finance/ui';
import { todayYmd } from '@/features/holidays/model';
import { formatMoney } from '@/lib/money/money';
import { balanceSheetSheet } from '@/features/accounts/report-export';
import { useApi } from '@/session/ApiProvider';

export function BalanceSheetScreen() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  const heads = useAccHeads();
  const byId = useMemo(() => new Map((heads.data ?? []).map((h) => [h.id, h])), [heads.data]);
  const [to, setTo] = useState(todayYmd());
  const params = { to: to.length === 10 ? to : undefined };
  const q = useQuery({
    queryKey: key('acc-report', 'balance-sheet', params),
    queryFn: () => accounts.balanceSheet(params),
  });
  const d = q.data;
  const v = d ? balanceSheetView(d) : null;
  return (
    <PageLayout
      title="Balance Sheet"
      actions={<ExportCsvButton sheet={d ? () => balanceSheetSheet(d, to) : null} />}
      description={`As of ${to}`}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <Filters>
        <ReportYearSelect to={to} onPick={(_, t) => setTo(t)} />
        <DateField label="As of" value={to} onChange={setTo} />
      </Filters>
      {q.isPending ? (
        <Skeleton height={256} />
      ) : q.isError || !d || !v ? (
        <ErrorState
          title="Couldn't load the report"
          message={q.error?.message ?? "Couldn't load the report. Try again in a moment."}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <BalanceBanner ok={v.balanced} testID="bs-balance">
            {v.balanced
              ? 'Balanced: assets equal liabilities + equity.'
              : `Out of balance by ${formatMoney(v.difference)}`}
          </BalanceBanner>
          <View className="flex-row flex-wrap items-start gap-6">
            <View className="min-w-0 grow basis-full lg:basis-[48%]">
              <AmountTable
                title="Assets"
                rows={d.assets}
                total={d.total_assets}
                byId={byId}
                testID="bs-assets"
              />
            </View>
            <View className="min-w-0 grow basis-full gap-6 lg:basis-[48%]">
              <AmountTable
                title="Liabilities"
                rows={d.liabilities}
                total={v.liabilities}
                byId={byId}
                testID="bs-liabilities"
              />
              <AmountTable
                title="Equity"
                rows={d.equity}
                total={v.equity}
                byId={byId}
                extra={{ label: 'Surplus / (deficit) to date', value: d.surplus }}
                testID="bs-equity"
              />
              <SectionCard>
                <View className="flex-row justify-between">
                  <Text size="sm" weight="semibold">
                    Total liabilities & equity
                  </Text>
                  <Text size="sm" weight="semibold" tabular>
                    {formatMoney(d.total_liabilities_equity)}
                  </Text>
                </View>
              </SectionCard>
            </View>
          </View>
        </>
      )}
    </PageLayout>
  );
}
