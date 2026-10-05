import { useState } from 'react';
import { useAccReport } from '@/queries/accounts.queries';
import type { CostCenterReport as Report } from '@/types/accounts';
import { formatMoney, formatYmd } from '@/lib/utils';
import { DataTable, DateInput, ExportButton, Money, PageTitle, StateRows, num, td } from '../ui';
import { exportXlsx } from './exportXlsx';

const columns = [
  { label: 'Cost center' },
  { label: 'Income', className: 'w-40 text-right' },
  { label: 'Expense', className: 'w-40 text-right' },
  { label: 'Net', className: 'w-40 text-right' },
];

const CostCenterReport = () => {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data, isLoading, isError } = useAccReport<Report>('cost-center', { from, to });
  const rows = data?.rows ?? [];
  const sum = (k: 'income' | 'expense' | 'net') => rows.reduce((s, r) => s + r[k], 0);

  const onExport = () =>
    exportXlsx(
      [
        ...rows.map((r) => ({
          'Cost center': r.cost_center_name,
          Income: r.income,
          Expense: r.expense,
          Net: r.net,
        })),
        { 'Cost center': 'Total', Income: sum('income'), Expense: sum('expense'), Net: sum('net') },
      ],
      `Cost Center Report ${from} to ${to}`,
    );

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Cost Center Report">
        <ExportButton onClick={onExport} disabled={!data} />
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
      </div>

      <DataTable
        columns={columns}
        minWidth="36rem"
        footer={
          rows.length > 0 && (
            <tr className="font-semibold">
              <td className={td}>Total</td>
              <td className={num}>{formatMoney(sum('income'))}</td>
              <td className={num}>{formatMoney(sum('expense'))}</td>
              <td className={num}>
                <Money value={sum('net')} />
              </td>
            </tr>
          )
        }
      >
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={rows.length === 0}
          emptyText="No cost-center activity in this period."
        />
        {rows.map((r) => (
          <tr key={r.cost_center_id} className="bg-card">
            <td className={td}>{r.cost_center_name}</td>
            <td className={num}>
              <Money value={r.income} />
            </td>
            <td className={num}>
              <Money value={r.expense} />
            </td>
            <td className={num}>
              <Money value={r.net} />
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
};

export default CostCenterReport;
