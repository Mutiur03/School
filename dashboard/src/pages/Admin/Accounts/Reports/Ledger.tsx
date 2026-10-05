import { useState } from 'react';
import { useAccHeads, useAccReport } from '@/queries/accounts.queries';
import type { LedgerReport } from '@/types/accounts';
import { cn, formatDay, formatYmd } from '@/lib/utils';
import { DataTable, DateInput, ExportButton, Money, PageTitle, StateRows, num, td } from '../ui';
import { TYPE_LABELS, drCr, groupByType, selectClass } from '../heads';
import { exportXlsx } from './exportXlsx';

const columns = [
  { label: 'Date', className: 'w-32' },
  { label: 'Voucher', className: 'w-28' },
  { label: 'Particulars' },
  { label: 'Debit', className: 'w-36 text-right' },
  { label: 'Credit', className: 'w-36 text-right' },
  { label: 'Balance', className: 'w-40 text-right' },
];

const Ledger = () => {
  const { data: heads = [] } = useAccHeads();
  const [headId, setHeadId] = useState('');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data, isLoading, isError } = useAccReport<LedgerReport>(
    'ledger',
    { head_id: headId, from, to },
    !!headId,
  );

  const onExport = () =>
    data &&
    exportXlsx(
      [
        {
          Date: from,
          Voucher: '',
          Particulars: 'Opening balance',
          Debit: '',
          Credit: '',
          Balance: drCr(data.opening),
        },
        ...data.rows.map((r) => ({
          Date: r.date.slice(0, 10),
          Voucher: r.voucher_no,
          Particulars: [r.narration, r.note].filter(Boolean).join(' — '),
          Debit: r.debit || '',
          Credit: r.credit || '',
          Balance: drCr(r.balance),
        })),
        {
          Date: to,
          Voucher: '',
          Particulars: 'Closing balance',
          Debit: '',
          Credit: '',
          Balance: drCr(data.closing),
        },
      ],
      `Ledger - ${data.head.name}`,
    );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Ledger"
        subtitle={
          data
            ? `${data.head.name} · ${TYPE_LABELS[data.head.type]}`
            : 'Pick an account head to see its movements.'
        }
      >
        <ExportButton onClick={onExport} disabled={!data} />
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block space-y-1">
          <span className="text-muted-foreground block text-xs font-medium">Account head</span>
          <select
            value={headId}
            onChange={(e) => setHeadId(e.target.value)}
            className={cn(selectClass, 'w-64')}
          >
            <option value="">Select head…</option>
            {groupByType(heads).map((g) => (
              <optgroup key={g.type} label={TYPE_LABELS[g.type]}>
                {g.rows.map(({ head, depth }) => (
                  <option key={head.id} value={head.id}>
                    {'  '.repeat(depth)}
                    {head.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
      </div>

      <DataTable columns={columns} minWidth="48rem">
        {!headId ? (
          <tr>
            <td
              colSpan={columns.length}
              className="text-muted-foreground px-4 py-12 text-center text-sm"
            >
              Select an account head.
            </td>
          </tr>
        ) : (
          <StateRows
            colSpan={columns.length}
            loading={isLoading}
            error={isError}
            empty={false}
            emptyText=""
          />
        )}
        {data && (
          <>
            <tr className="bg-muted/30 font-medium">
              <td colSpan={5} className={td}>
                Opening balance
              </td>
              <td className={num}>{drCr(data.opening)}</td>
            </tr>
            {data.rows.map((r, i) => (
              <tr key={`${r.voucher_id}-${i}`} className="bg-card">
                <td className={`${td} text-muted-foreground whitespace-nowrap`}>
                  {formatDay(r.date.slice(0, 10))}
                </td>
                <td className={`${td} tabular-nums`}>{r.voucher_no}</td>
                <td className={td}>
                  {r.narration || '—'}
                  {r.note && <span className="text-muted-foreground block text-xs">{r.note}</span>}
                </td>
                <td className={num}>{r.debit ? <Money value={r.debit} /> : ''}</td>
                <td className={num}>{r.credit ? <Money value={r.credit} /> : ''}</td>
                <td className={num}>{drCr(r.balance)}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-6 text-center text-sm"
                >
                  No transactions in this period.
                </td>
              </tr>
            )}
            <tr className="bg-muted/30 font-semibold">
              <td colSpan={5} className={td}>
                Closing balance
              </td>
              <td className={num}>{drCr(data.closing)}</td>
            </tr>
          </>
        )}
      </DataTable>
    </div>
  );
};

export default Ledger;
