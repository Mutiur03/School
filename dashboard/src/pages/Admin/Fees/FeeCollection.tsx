import { useMemo, useState } from 'react';
import { Banknote, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAccHeads } from '@/queries/accounts.queries';
import { openFeePdf, useCreateFeeReceipt, useFeeStatement } from '@/queries/fees.queries';
import type { DueRow } from '@/types/fees';
import { cn, formatMoney, formatYmd } from '@/lib/utils';
import { DataTable, DateInput, Money, PageTitle, StateRows, num, td } from '../Accounts/ui';
import { selectClass } from '../Accounts/heads';
import { MONTHS, THIS_YEAR } from './constants';
import { StudentPicker, YearSelect, type PickedStudent } from './shared';

const columns = [
  { label: '', className: 'w-10' },
  { label: 'Fee' },
  { label: 'Month', className: 'w-24' },
  { label: 'Charge', className: 'w-28 text-right' },
  { label: 'Waiver', className: 'w-28 text-right' },
  { label: 'Payable', className: 'w-28 text-right' },
  { label: 'Status', className: 'w-32' },
];

const key = (r: Pick<DueRow, 'fee_head_id' | 'month'>) => `${r.fee_head_id}:${r.month}`;

const STATUS_STYLE = {
  paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  waived: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  due: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

const FeeCollection = () => {
  const [year, setYear] = useState(THIS_YEAR);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [date, setDate] = useState(formatYmd(new Date()));
  const [payHeadId, setPayHeadId] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data: accHeads = [] } = useAccHeads();
  const cashBank = accHeads.filter((h) => h.is_cash_bank && h.is_active);
  const { data: statement, isLoading, isError } = useFeeStatement(student?.id, year);
  const create = useCreateFeeReceipt();

  const rows = useMemo(() => statement?.rows ?? [], [statement]);
  const total = useMemo(
    () =>
      rows.filter((r) => picked.has(key(r))).reduce((t, r) => t + Math.round(r.payable * 100), 0) /
      100,
    [rows, picked],
  );
  const dueRows = rows.filter((r) => r.status === 'due');
  const pickedRows = rows.filter((r) => picked.has(key(r)));
  // Fees with a fixed deposit account always go there; only the rest use "Received in".
  const needsPayHead = pickedRows.some((r) => !r.deposit);
  const payHeadName = cashBank.find((h) => String(h.id) === payHeadId)?.name;
  const destinations = useMemo(() => {
    const byName = new Map<string, number>();
    for (const r of pickedRows) {
      const name = r.deposit?.name ?? payHeadName ?? 'Pick an account';
      byName.set(name, (byName.get(name) ?? 0) + Math.round(r.payable * 100));
    }
    return [...byName].map(([name, paisa]) => ({ name, amount: paisa / 100 }));
  }, [pickedRows, payHeadName]);

  const toggle = (k: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (!next.delete(k)) next.add(k);
      return next;
    });

  const reset = (s: PickedStudent | null) => {
    setStudent(s);
    setPicked(new Set());
  };

  const collect = async () => {
    if (!student) return;
    if (needsPayHead && !payHeadId) return toast.error('Pick the cash/bank account');
    try {
      const receipt = (await create.mutateAsync({
        student_id: student.id,
        year,
        date,
        pay_head_id: needsPayHead ? Number(payHeadId) : undefined,
        note: note.trim() || undefined,
        items: rows
          .filter((r) => picked.has(key(r)))
          .map((r) => ({ fee_head_id: r.fee_head_id, month: r.month })),
      })) as { id: number };
      setPicked(new Set());
      setNote('');
      openFeePdf(`/api/fee-receipts/${receipt.id}/pdf`);
    } catch {
      // onError already toasts
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Collect Fees"
        subtitle="Pick a student, tick the installments being paid, collect."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <YearSelect
          value={year}
          onChange={(y) => {
            setYear(y);
            reset(null);
          }}
        />
        <StudentPicker year={year} value={student?.id ?? null} onChange={reset} />
      </div>

      {!student ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Select a student to see their fees.
        </p>
      ) : (
        <>
          {statement && (
            <div className="bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="text-lg font-semibold">{statement.student.name}</p>
                <p className="text-muted-foreground text-sm">
                  ID {String(statement.student.login_id)} · Class {statement.enrollment.class}-
                  {statement.enrollment.section} · Roll {statement.enrollment.roll}
                  {statement.student.father_name && ` · Father: ${statement.student.father_name}`}
                </p>
              </div>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(statement.totals.paid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Waived</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(statement.totals.waiver)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd className="text-destructive font-semibold tabular-nums">
                    {formatMoney(statement.totals.due)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <DataTable
            columns={columns}
            minWidth="44rem"
            footer={
              <tr>
                <td className={td} colSpan={5}>
                  <button
                    type="button"
                    className="text-primary text-sm hover:underline disabled:opacity-50"
                    disabled={dueRows.length === 0}
                    onClick={() =>
                      setPicked(
                        picked.size === dueRows.length ? new Set() : new Set(dueRows.map(key)),
                      )
                    }
                  >
                    {picked.size === dueRows.length && picked.size > 0
                      ? 'Clear selection'
                      : 'Select all due'}
                  </button>
                </td>
                <td className={cn(num, 'font-semibold')}>
                  <Money value={total} />
                </td>
                <td />
              </tr>
            }
          >
            <StateRows
              colSpan={columns.length}
              loading={isLoading}
              error={isError}
              empty={rows.length === 0}
              emptyText="No fees are set for this class. Add them under Fee Structure."
            />
            {!isLoading &&
              rows.map((r) => (
                <tr
                  key={key(r)}
                  className={cn(
                    'bg-card',
                    r.status === 'due' && 'hover:bg-muted/40 cursor-pointer',
                  )}
                  onClick={() => r.status === 'due' && toggle(key(r))}
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={r.status !== 'due'}
                      checked={picked.has(key(r))}
                      onChange={() => toggle(key(r))}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${r.fee_head} ${MONTHS[r.month]}`}
                    />
                  </td>
                  <td className={td}>
                    {r.fee_head}
                    {r.deposit && (
                      <span className="text-muted-foreground ml-2 text-xs">→ {r.deposit.name}</span>
                    )}
                  </td>
                  <td className={`${td} text-muted-foreground`}>{MONTHS[r.month]}</td>
                  <td className={num}>
                    <Money value={r.charge} />
                  </td>
                  <td className={num}>{r.waiver ? <Money value={r.waiver} /> : '—'}</td>
                  <td className={num}>
                    <Money value={r.payable} />
                  </td>
                  <td className={td}>
                    <Badge className={cn('border-transparent capitalize', STATUS_STYLE[r.status])}>
                      {r.status}
                    </Badge>
                    {r.receipt_no && (
                      <span className="text-muted-foreground ml-2 text-xs">#{r.receipt_no}</span>
                    )}
                  </td>
                </tr>
              ))}
          </DataTable>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <DateInput label="Date" value={date} onChange={setDate} />
            {(needsPayHead || picked.size === 0) && (
              <label className="block space-y-1">
                <span className="text-muted-foreground block text-xs font-medium">Received in</span>
                <select
                  value={payHeadId}
                  onChange={(e) => setPayHeadId(e.target.value)}
                  className={cn(selectClass, 'w-56')}
                >
                  <option value="">Select cash / bank</option>
                  {cashBank.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1">
              <span className="text-muted-foreground block text-xs font-medium">Remarks</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-64"
                placeholder="Optional"
              />
            </label>
            <Button
              type="button"
              onClick={collect}
              disabled={picked.size === 0 || create.isPending}
            >
              <Banknote /> Collect {formatMoney(total)}
            </Button>
          </div>
          {destinations.length > 0 && (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Money goes to: </span>
              {destinations.map((d, i) => (
                <span key={d.name}>
                  {i > 0 && <span className="text-muted-foreground"> · </span>}
                  <b>{d.name}</b> {formatMoney(d.amount)}
                </span>
              ))}
            </p>
          )}
          {cashBank.length === 0 && (
            <p className="text-muted-foreground mt-2 text-sm">
              No cash/bank account yet. Mark an asset head as cash/bank under Accounts → Account
              Heads.
            </p>
          )}
          <p className="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
            <Printer size={14} /> The receipt opens in a new tab after collecting.
          </p>
        </>
      )}
    </div>
  );
};

export default FeeCollection;
