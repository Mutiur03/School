import { useState } from 'react';
import { useAccHeads, useAccReport } from '@/queries/accounts.queries';
import type { TrialBalanceReport } from '@/types/accounts';
import { cn, formatMoney, formatYmd } from '@/lib/utils';
import {
  DataTable,
  DateInput,
  ExportButton,
  Money,
  PageTitle,
  StateRows,
  YearSelect,
  num,
  td,
} from '../ui';
import { TYPE_LABELS, depthOf, topAncestor } from '../heads';
import { exportXlsx } from './exportXlsx';

const codeColumn = { label: 'Code', className: 'w-28' };
const columns = [
  { label: 'Head' },
  { label: 'Type', className: 'w-32' },
  { label: 'Debit', className: 'w-40 text-right' },
  { label: 'Credit', className: 'w-40 text-right' },
];

type Row = TrialBalanceReport['rows'][number] & { depth: number };

const TrialBalance = () => {
  const { data: heads = [] } = useAccHeads();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const [short, setShort] = useState(false);
  const { data, isLoading, isError } = useAccReport<TrialBalanceReport>('trial-balance', {
    from,
    to,
  });

  const byId = new Map(heads.map((h) => [h.id, h]));
  let rows: Row[] = (data?.rows ?? []).map((r) => ({ ...r, depth: depthOf(r.head_id, byId) }));
  if (short) {
    // Roll every head into its top-level parent, then net to one side.
    const rolled = new Map<number, Row>();
    for (const r of rows) {
      const topId = topAncestor(r.head_id, byId);
      const top = byId.get(topId);
      const acc = rolled.get(topId) ?? {
        ...r,
        head_id: topId,
        code: top?.code ?? r.code,
        name: top?.name ?? r.name,
        parent_id: null,
        debit: 0,
        credit: 0,
        depth: 0,
      };
      acc.debit += r.debit;
      acc.credit += r.credit;
      rolled.set(topId, acc);
    }
    rows = [...rolled.values()].map((r) => {
      const net = r.debit - r.credit;
      return { ...r, debit: Math.max(net, 0), credit: Math.max(-net, 0) };
    });
  }
  const totalDr = short ? rows.reduce((s, r) => s + r.debit, 0) : (data?.total_debit ?? 0);
  const totalCr = short ? rows.reduce((s, r) => s + r.credit, 0) : (data?.total_credit ?? 0);
  // Code is optional: only show the column once some head actually has one.
  const hasCodes = rows.some((r) => r.code);
  const cols = hasCodes ? [codeColumn, ...columns] : columns;
  const mismatch = Math.round(totalDr * 100) !== Math.round(totalCr * 100);

  const onExport = () =>
    exportXlsx(
      [
        ...rows.map((r) => ({
          ...(hasCodes && { Code: r.code ?? '' }),
          Head: r.name,
          Type: TYPE_LABELS[r.type],
          Debit: r.debit,
          Credit: r.credit,
        })),
        { ...(hasCodes && { Code: '' }), Head: 'Total', Type: '', Debit: totalDr, Credit: totalCr },
      ],
      `Trial Balance ${from} to ${to}`,
    );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Trial Balance">
        <ExportButton onClick={onExport} disabled={!data} />
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <YearSelect
          from={from}
          to={to}
          onPick={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
        <div className="bg-muted inline-flex rounded-lg p-1" role="group" aria-label="Detail">
          {(['Full', 'Short'] as const).map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={short === (label === 'Short')}
              onClick={() => setShort(label === 'Short')}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium',
                short === (label === 'Short') ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={cols}
        footer={
          data && (
            <tr className={cn('font-semibold', mismatch && 'text-destructive')}>
              <td colSpan={cols.length - 2} className={td}>
                Total
                {mismatch && ` — out of balance by ${formatMoney(Math.abs(totalDr - totalCr))}`}
              </td>
              <td className={num}>{formatMoney(totalDr)}</td>
              <td className={num}>{formatMoney(totalCr)}</td>
            </tr>
          )
        }
      >
        <StateRows
          colSpan={cols.length}
          loading={isLoading}
          error={isError}
          empty={rows.length === 0}
          emptyText="No balances in this period."
        />
        {rows.map((r) => (
          <tr key={r.head_id} className="bg-card">
            {hasCodes && (
              <td className={`${td} text-muted-foreground tabular-nums`}>{r.code ?? '—'}</td>
            )}
            <td className={td} style={{ paddingLeft: `${1 + r.depth * 1.25}rem` }}>
              {r.name}
            </td>
            <td className={`${td} text-muted-foreground`}>{TYPE_LABELS[r.type]}</td>
            <td className={num}>{r.debit ? <Money value={r.debit} /> : ''}</td>
            <td className={num}>{r.credit ? <Money value={r.credit} /> : ''}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
};

export default TrialBalance;
