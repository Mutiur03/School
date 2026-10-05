import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components';
import { useAccHeads, useAccReport } from '@/queries/accounts.queries';
import type { IncomeExpenseReport } from '@/types/accounts';
import { cn, formatMoney, formatYmd } from '@/lib/utils';
import { DateInput, ExportButton, PageTitle } from '../ui';
import AmountTable from './AmountTable';
import { exportXlsx } from './exportXlsx';

const IncomeExpense = () => {
  const { data: heads = [] } = useAccHeads();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data, isLoading, isError } = useAccReport<IncomeExpenseReport>('income-expense', {
    from,
    to,
  });
  const byId = new Map(heads.map((h) => [h.id, h]));

  const onExport = () =>
    data &&
    exportXlsx(
      [
        ...data.income.map((r) => ({ Section: 'Income', Head: r.name, Amount: r.amount })),
        { Section: 'Income', Head: 'Total income', Amount: data.total_income },
        ...data.expense.map((r) => ({ Section: 'Expense', Head: r.name, Amount: r.amount })),
        { Section: 'Expense', Head: 'Total expense', Amount: data.total_expense },
        { Section: '', Head: data.net >= 0 ? 'Surplus' : 'Deficit', Amount: data.net },
      ],
      `Income vs Expense ${from} to ${to}`,
    );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Income vs Expense">
        <ExportButton onClick={onExport} disabled={!data} />
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError || !data ? (
        <ErrorMessage variant="block" message="Couldn't load the report. Try again in a moment." />
      ) : (
        <>
          <div
            className={cn(
              'mb-4 rounded-xl border px-5 py-4 text-lg font-semibold tabular-nums',
              data.net >= 0
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
          >
            Net {data.net >= 0 ? 'surplus' : 'deficit'}: {formatMoney(Math.abs(data.net))}
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <AmountTable title="Income" rows={data.income} total={data.total_income} byId={byId} />
            <AmountTable
              title="Expense"
              rows={data.expense}
              total={data.total_expense}
              byId={byId}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default IncomeExpense;
