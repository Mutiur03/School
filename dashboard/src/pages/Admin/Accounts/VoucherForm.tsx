import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  voucherFormSchema,
  type VoucherFormData,
  type VoucherLineData,
  type VoucherType,
} from '@school/shared-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useAccHeads,
  useCostCenters,
  useCreateVoucher,
  useUpdateVoucher,
} from '@/queries/accounts.queries';
import type { AccHead, Voucher } from '@/types/accounts';
import { cn, formatMoney, formatYmd } from '@/lib/utils';
import { Field, FormPopup, th } from './ui';
import { TYPE_LABELS, VOUCHER_MODES, groupByType, selectClass } from './heads';

type AmountRow = { head_id: string; amount: string; cost_center_id: string };
type GridRow = {
  head_id: string;
  debit: string;
  credit: string;
  cost_center_id: string;
  note: string;
};

const blankRow = (): AmountRow => ({ head_id: '', amount: '', cost_center_id: '' });
const blankGrid = (): GridRow => ({
  head_id: '',
  debit: '',
  credit: '',
  cost_center_id: '',
  note: '',
});

const num = (s: string) => Number(s) || 0;
const idOrNull = (s: string) => (s ? Number(s) : null);
const line = (
  head: string,
  debit: number,
  credit: number,
  cc = '',
  note: string | null = null,
): VoucherLineData => ({
  head_id: Number(head) || 0,
  debit,
  credit,
  cost_center_id: idOrNull(cc),
  note,
});

const HeadSelect = ({
  value,
  onChange,
  heads,
  grouped,
  placeholder = 'Select head…',
}: {
  value: string;
  onChange: (v: string) => void;
  heads: AccHead[];
  grouped?: boolean;
  placeholder?: string;
}) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
    <option value="">{placeholder}</option>
    {grouped
      ? groupByType(heads)
          .filter((g) => g.rows.length)
          .map((g) => (
            <optgroup key={g.type} label={TYPE_LABELS[g.type]}>
              {g.rows.map(({ head, depth }) => (
                <option key={head.id} value={head.id}>
                  {'  '.repeat(depth)}
                  {head.name}
                </option>
              ))}
            </optgroup>
          ))
      : heads.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
  </select>
);

const amountInput = 'h-9 text-right tabular-nums';

/**
 * Mount with `key` so state resets per voucher. Editing always uses the journal grid
 * (keeps the voucher's own type) — rebuilding the simple modes from lines isn't worth it.
 */
const VoucherForm = ({ voucher, onClose }: { voucher: Voucher | null; onClose: () => void }) => {
  const { data: heads = [] } = useAccHeads();
  const { data: centers = [] } = useCostCenters();
  const create = useCreateVoucher();
  const update = useUpdateVoucher();

  const [type, setType] = useState<VoucherType>(voucher?.type ?? 'receipt');
  const [date, setDate] = useState(voucher?.date.slice(0, 10) ?? formatYmd(new Date()));
  const [reference, setReference] = useState(voucher?.reference ?? '');
  const [narration, setNarration] = useState(voucher?.narration ?? '');
  const [cashId, setCashId] = useState('');
  const [rows, setRows] = useState<AmountRow[]>([blankRow()]);
  const [transfer, setTransfer] = useState({ from: '', to: '', amount: '' });
  const [grid, setGrid] = useState<GridRow[]>(
    voucher
      ? voucher.lines.map((l) => ({
          head_id: String(l.head_id),
          debit: l.debit ? String(l.debit) : '',
          credit: l.credit ? String(l.credit) : '',
          cost_center_id: l.cost_center_id ? String(l.cost_center_id) : '',
          note: l.note ?? '',
        }))
      : [blankGrid(), blankGrid()],
  );

  const useGrid = type === 'journal' || voucher !== null;
  const active = heads.filter((h) => h.is_active);
  const cashHeads = active.filter((h) => h.is_cash_bank);
  const usedIds = new Set(voucher?.lines.map((l) => l.head_id));
  const gridHeads = heads.filter((h) => h.is_active || usedIds.has(h.id));
  const rowHeads = active.filter((h) => h.type === (type === 'receipt' ? 'income' : 'expense'));
  const activeCenters = centers.filter((c) => c.is_active);

  // ---- Build double-entry lines from whichever mode is showing ----
  let lines: VoucherLineData[];
  if (useGrid) {
    lines = grid
      .filter((r) => r.head_id || r.debit || r.credit)
      .map((r) =>
        line(r.head_id, num(r.debit), num(r.credit), r.cost_center_id, r.note.trim() || null),
      );
  } else if (type === 'contra') {
    const amt = num(transfer.amount);
    lines = [line(transfer.to, amt, 0), line(transfer.from, 0, amt)];
  } else {
    const items = rows.filter((r) => r.head_id || r.amount);
    const total = items.reduce((s, r) => s + num(r.amount), 0);
    const receipt = type === 'receipt';
    lines = [
      line(cashId, receipt ? total : 0, receipt ? 0 : total),
      ...items.map((r) =>
        line(r.head_id, receipt ? 0 : num(r.amount), receipt ? num(r.amount) : 0, r.cost_center_id),
      ),
    ];
  }

  const payload: VoucherFormData = {
    type,
    date,
    narration: narration.trim() || null,
    reference: reference.trim() || null,
    lines,
  };
  const parsed = voucherFormSchema.safeParse(payload);
  const totalDr = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCr = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const issue =
    !useGrid && type === 'contra' && transfer.from && transfer.from === transfer.to
      ? 'From and to accounts must differ'
      : totalDr === 0
        ? 'Enter an amount'
        : parsed.success
          ? null
          : parsed.error.issues[0]?.message;

  const saving = create.isPending || update.isPending;
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.success || issue) return;
    try {
      if (voucher) await update.mutateAsync({ id: voucher.id, data: parsed.data });
      else await create.mutateAsync(parsed.data);
      onClose();
    } catch {
      // onError already toasts
    }
  };

  const setRow = (i: number, patch: Partial<AmountRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setGridRow = (i: number, patch: Partial<GridRow>) =>
    setGrid((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const ccSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">—</option>
      {activeCenters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  const removeBtn = (onClick: () => void, disabled: boolean) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove row"
      onClick={onClick}
      disabled={disabled}
    >
      <Trash2 />
    </Button>
  );

  return (
    <FormPopup
      open
      onClose={onClose}
      title={voucher ? `Edit voucher ${voucher.voucher_no}` : 'New voucher'}
      onSubmit={onSubmit}
      saving={saving}
      disabled={!!issue}
      submitLabel={voucher ? 'Save changes' : 'Save voucher'}
      size="full"
      footerNote={
        <span className="tabular-nums">
          Dr {formatMoney(totalDr)} · Cr {formatMoney(totalCr)}
          {issue ? (
            <span className="text-destructive"> · {issue}</span>
          ) : (
            <span className="text-emerald-600"> · Balanced</span>
          )}
        </span>
      }
    >
      {!voucher && (
        <div role="tablist" className="bg-muted inline-flex rounded-lg p-1">
          {VOUCHER_MODES.map((m) => (
            <button
              key={m.type}
              type="button"
              role="tab"
              aria-selected={type === m.type}
              onClick={() => setType(m.type)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                type === m.type ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reference">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Receipt / cheque no."
          />
        </Field>
        <Field label="Narration">
          <Input value={narration} onChange={(e) => setNarration(e.target.value)} />
        </Field>
      </div>

      {useGrid ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left">
            <thead>
              <tr>
                <th className={th}>Head</th>
                <th className={cn(th, 'w-36 text-right')}>Debit</th>
                <th className={cn(th, 'w-36 text-right')}>Credit</th>
                <th className={cn(th, 'w-40')}>Cost center</th>
                <th className={th}>Note</th>
                <th className={cn(th, 'w-px')} />
              </tr>
            </thead>
            <tbody>
              {grid.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <HeadSelect
                      grouped
                      heads={gridHeads}
                      value={r.head_id}
                      onChange={(v) => setGridRow(i, { head_id: v })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className={amountInput}
                      value={r.debit}
                      onChange={(e) =>
                        setGridRow(
                          i,
                          e.target.value ? { debit: e.target.value, credit: '' } : { debit: '' },
                        )
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className={amountInput}
                      value={r.credit}
                      onChange={(e) =>
                        setGridRow(
                          i,
                          e.target.value ? { credit: e.target.value, debit: '' } : { credit: '' },
                        )
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    {ccSelect(r.cost_center_id, (v) => setGridRow(i, { cost_center_id: v }))}
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      className="h-9"
                      value={r.note}
                      onChange={(e) => setGridRow(i, { note: e.target.value })}
                    />
                  </td>
                  <td className="py-1">
                    {removeBtn(() => setGrid((g) => g.filter((_, j) => j !== i)), grid.length <= 2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-border border-t text-sm font-semibold tabular-nums">
                <td className="py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGrid((g) => [...g, blankGrid()])}
                  >
                    <Plus /> Add row
                  </Button>
                </td>
                <td className="px-3 py-2 text-right">{formatMoney(totalDr)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(totalCr)}</td>
                <td colSpan={3} className="px-3 py-2">
                  {Math.round((totalDr - totalCr) * 100) !== 0 && (
                    <span className="text-destructive">
                      Difference {formatMoney(Math.abs(totalDr - totalCr))}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : type === 'contra' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="From account" required>
            <HeadSelect
              heads={cashHeads}
              value={transfer.from}
              onChange={(v) => setTransfer({ ...transfer, from: v })}
            />
          </Field>
          <Field label="To account" required>
            <HeadSelect
              heads={cashHeads}
              value={transfer.to}
              onChange={(v) => setTransfer({ ...transfer, to: v })}
            />
          </Field>
          <Field label="Amount" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              className={amountInput}
              value={transfer.amount}
              onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <>
          <Field
            label={type === 'receipt' ? 'Receive into (cash / bank)' : 'Pay from (cash / bank)'}
            required
            className="sm:max-w-sm"
          >
            <HeadSelect heads={cashHeads} value={cashId} onChange={setCashId} />
          </Field>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr>
                  <th className={th}>{type === 'receipt' ? 'Income head' : 'Expense head'}</th>
                  <th className={cn(th, 'w-40 text-right')}>Amount</th>
                  <th className={cn(th, 'w-44')}>Cost center</th>
                  <th className={cn(th, 'w-px')} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <HeadSelect
                        heads={rowHeads}
                        value={r.head_id}
                        onChange={(v) => setRow(i, { head_id: v })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={amountInput}
                        value={r.amount}
                        onChange={(e) => setRow(i, { amount: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      {ccSelect(r.cost_center_id, (v) => setRow(i, { cost_center_id: v }))}
                    </td>
                    <td className="py-1">
                      {removeBtn(
                        () => setRows((rs) => rs.filter((_, j) => j !== i)),
                        rows.length <= 1,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-border border-t text-sm font-semibold tabular-nums">
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRows((rs) => [...rs, blankRow()])}
                    >
                      <Plus /> Add row
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-right">Total {formatMoney(totalDr)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </FormPopup>
  );
};

export default VoucherForm;
