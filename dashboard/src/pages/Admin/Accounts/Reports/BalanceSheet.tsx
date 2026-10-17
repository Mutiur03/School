import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components';
import { useAccHeads, useAccReport } from '@/queries/accounts.queries';
import type { BalanceSheetReport } from '@/types/accounts';
import { cn, formatMoney, formatYmd } from '@/lib/utils';
import { DateInput, ExportButton, Money, PageTitle, YearSelect, num, td } from '../ui';
import AmountTable from './AmountTable';
import { exportXlsx } from './exportXlsx';

const BalanceSheet = () => {
  const { data: heads = [] } = useAccHeads();
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data, isLoading, isError } = useAccReport<BalanceSheetReport>('balance-sheet', { to });
  const byId = new Map(heads.map((h) => [h.id, h]));
  const balanced =
    !!data &&
    Math.round(data.total_assets * 100) === Math.round(data.total_liabilities_equity * 100);

  const onExport = () =>
    data &&
    exportXlsx(
      [
        ...data.assets.map((r) => ({ Section: 'Assets', Head: r.name, Amount: r.amount })),
        { Section: 'Assets', Head: 'Total assets', Amount: data.total_assets },
        ...data.liabilities.map((r) => ({
          Section: 'Liabilities',
          Head: r.name,
          Amount: r.amount,
        })),
        ...data.equity.map((r) => ({ Section: 'Equity', Head: r.name, Amount: r.amount })),
        { Section: 'Equity', Head: 'Surplus / (deficit)', Amount: data.surplus },
        {
          Section: 'Liabilities & equity',
          Head: 'Total liabilities & equity',
          Amount: data.total_liabilities_equity,
        },
      ],
      `Balance Sheet as of ${to}`,
    );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Balance Sheet" subtitle={`As of ${to}`}>
        <ExportButton onClick={onExport} disabled={!data} />
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <YearSelect to={to} onPick={(_, t) => setTo(t)} />
        <DateInput label="As of" value={to} onChange={setTo} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError || !data ? (
        <ErrorMessage variant="block" message="Couldn't load the report. Try again in a moment." />
      ) : (
        <>
          <div
            className={cn(
              'mb-4 flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium tabular-nums',
              balanced
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
          >
            {balanced ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {balanced
              ? 'Balanced: assets equal liabilities + equity.'
              : `Out of balance by ${formatMoney(Math.abs(data.total_assets - data.total_liabilities_equity))}`}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <AmountTable title="Assets" rows={data.assets} total={data.total_assets} byId={byId} />
            <div className="space-y-6">
              <AmountTable
                title="Liabilities"
                rows={data.liabilities}
                total={data.liabilities.reduce((s, r) => s + r.amount, 0)}
                byId={byId}
              />
              <AmountTable
                title="Equity"
                rows={data.equity}
                total={
                  data.total_liabilities_equity - data.liabilities.reduce((s, r) => s + r.amount, 0)
                }
                byId={byId}
                extra={
                  <tr className="bg-card">
                    <td className={`${td} italic`}>Surplus / (deficit) to date</td>
                    <td className={num}>
                      <Money value={data.surplus} />
                    </td>
                  </tr>
                }
              />
              <div className="bg-card border-border flex justify-between rounded-xl border px-4 py-3 font-semibold">
                <span>Total liabilities & equity</span>
                <span className="tabular-nums">{formatMoney(data.total_liabilities_equity)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BalanceSheet;
