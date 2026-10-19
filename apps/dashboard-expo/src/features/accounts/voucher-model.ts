/**
 * The voucher form (dashboard/src/pages/Admin/Accounts/VoucherForm.tsx) as pure functions: the
 * Income / Expense / Transfer forms and the journal grid all become double-entry lines in integer
 * paisa, so Dr = Cr is an exact integer comparison (the server checks the same in paisa).
 */
import type { VoucherType } from '@school/shared-schemas';
import type { AccHead, Voucher, VoucherInput, VoucherLineInput } from '@/lib/api/accounts';
import {
  absPaisa,
  formatMoney,
  moneyText,
  parseMoneyInput,
  subPaisa,
  sumPaisa,
  ZERO,
  type Paisa,
} from '@/lib/money/money';

export interface AmountRow {
  head_id: number | null;
  amount: string;
  cost_center_id: number | null;
}
export interface GridRow {
  head_id: number | null;
  debit: string;
  credit: string;
  cost_center_id: number | null;
  note: string;
}
export interface Transfer {
  from: number | null;
  to: number | null;
  amount: string;
}
export interface Simple {
  cashId: number | null;
  rows: AmountRow[];
  transfer: Transfer;
}

export const blankRow = (): AmountRow => ({ head_id: null, amount: '', cost_center_id: null });
export const blankGrid = (): GridRow => ({
  head_id: null,
  debit: '',
  credit: '',
  cost_center_id: null,
  note: '',
});
const blankTransfer = (): Transfer => ({ from: null, to: null, amount: '' });

/**
 * Rebuild the Income / Expense / Transfer form from a stored voucher so edit looks like create.
 * Null when the lines don't fit that shape (journals, notes, split cash lines): those open in the
 * journal grid so nothing is lost.
 */
export function toSimple(v: Voucher, heads: readonly AccHead[]): Simple | null {
  const byId = new Map(heads.map((h) => [h.id, h]));
  const empty: Simple = { cashId: null, rows: [blankRow()], transfer: blankTransfer() };
  if (v.type === 'journal' || v.lines.some((l) => l.note)) return null;
  const dr = v.lines.filter((l) => l.debit > 0);
  const cr = v.lines.filter((l) => l.credit > 0);

  if (v.type === 'contra') {
    const [d, c] = [dr[0], cr[0]];
    if (v.lines.length !== 2 || !d || !c || v.lines.some((l) => l.cost_center_id)) return null;
    if (!byId.get(d.head_id)?.is_cash_bank || !byId.get(c.head_id)?.is_cash_bank) return null;
    if (d.debit !== c.credit) return null;
    return {
      ...empty,
      transfer: { from: c.head_id, to: d.head_id, amount: moneyText(d.debit, false) },
    };
  }

  const receipt = v.type === 'receipt';
  const [cashSide, itemSide] = receipt ? [dr, cr] : [cr, dr];
  const cash = cashSide[0];
  if (cashSide.length !== 1 || !cash || cash.cost_center_id) return null;
  if (!byId.get(cash.head_id)?.is_cash_bank) return null;
  if (itemSide.some((l) => byId.get(l.head_id)?.type !== (receipt ? 'income' : 'expense')))
    return null;
  return {
    ...empty,
    cashId: cash.head_id,
    rows: itemSide.map((l) => ({
      head_id: l.head_id,
      amount: moneyText(receipt ? l.credit : l.debit, false),
      cost_center_id: l.cost_center_id,
    })),
  };
}

export const gridFromVoucher = (v: Voucher): GridRow[] =>
  v.lines.map((l) => ({
    head_id: l.head_id,
    debit: moneyText(l.debit),
    credit: moneyText(l.credit),
    cost_center_id: l.cost_center_id,
    note: l.note ?? '',
  }));

export interface VoucherState {
  type: VoucherType;
  date: string;
  narration: string;
  reference: string;
  useGrid: boolean;
  cashId: number | null;
  rows: AmountRow[];
  transfer: Transfer;
  grid: GridRow[];
}

export interface BuiltVoucher {
  input: VoucherInput;
  debit: Paisa;
  credit: Paisa;
  difference: Paisa;
  /** First problem; null = ready to save. */
  issue: string | null;
}

const amount = (text: string, where: string): { p: Paisa; error: string | null } => {
  const r = parseMoneyInput(text, { allowZero: true });
  if (!r.ok) return { p: ZERO, error: `${where}: ${r.error}` };
  return { p: r.paisa, error: null };
};

const line = (
  head: number | null,
  debit: Paisa,
  credit: Paisa,
  cc: number | null = null,
  note: string | null = null,
): VoucherLineInput => ({ head_id: head ?? 0, debit, credit, cost_center_id: cc, note });

/** Lines, totals and the first issue for whichever mode is showing. */
export function buildVoucher(s: VoucherState): BuiltVoucher {
  const errors: string[] = [];
  let lines: VoucherLineInput[];
  if (s.useGrid) {
    lines = s.grid
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.head_id || r.debit.trim() || r.credit.trim())
      .map(({ r, i }) => {
        const d = amount(r.debit, `Row ${i + 1} debit`);
        const c = amount(r.credit, `Row ${i + 1} credit`);
        if (d.error) errors.push(d.error);
        if (c.error) errors.push(c.error);
        return line(r.head_id, d.p, c.p, r.cost_center_id, r.note.trim() || null);
      });
  } else if (s.type === 'contra') {
    const a = amount(s.transfer.amount, 'Amount');
    if (a.error) errors.push(a.error);
    lines = [line(s.transfer.to, a.p, ZERO), line(s.transfer.from, ZERO, a.p)];
  } else {
    const receipt = s.type === 'receipt';
    const items = s.rows
      .map((r, i) => ({ r, i, a: amount(r.amount, `Row ${i + 1}`) }))
      .filter(({ r }) => r.head_id || r.amount.trim());
    for (const it of items) if (it.a.error) errors.push(it.a.error);
    const total = sumPaisa(items, (it) => it.a.p);
    lines = [
      line(s.cashId, receipt ? total : ZERO, receipt ? ZERO : total),
      ...items.map((it) =>
        line(it.r.head_id, receipt ? ZERO : it.a.p, receipt ? it.a.p : ZERO, it.r.cost_center_id),
      ),
    ];
  }

  const debit = sumPaisa(lines, (l) => l.debit);
  const credit = sumPaisa(lines, (l) => l.credit);
  const difference = absPaisa(subPaisa(debit, credit));
  const input: VoucherInput = {
    type: s.type,
    date: s.date,
    narration: s.narration.trim() || null,
    reference: s.reference.trim() || null,
    lines,
  };

  const lineIssue = lines.findIndex((l) => !l.head_id);
  const sideIssue = lines.findIndex((l) => l.debit > 0 === l.credit > 0);
  const issue =
    errors[0] ??
    (!s.useGrid && s.type === 'contra' && s.transfer.from && s.transfer.from === s.transfer.to
      ? 'From and to accounts must differ'
      : debit === 0
        ? 'Enter an amount'
        : !/^\d{4}-\d{2}-\d{2}$/.test(s.date)
          ? 'Date is required'
          : lines.length < 2
            ? 'A voucher needs at least two lines'
            : lineIssue >= 0
              ? 'Pick an account head'
              : sideIssue >= 0
                ? 'Each line needs either a debit or a credit amount'
                : difference !== 0
                  ? `Total debit must equal total credit (difference ${formatMoney(difference)})`
                  : (s.narration.trim().length > 500 && 'Narration is too long') ||
                    (s.reference.trim().length > 100 && 'Reference is too long') ||
                    null);
  return { input, debit, credit, difference, issue };
}

/** Text for the confirm dialog before a voucher is saved. */
export function voucherConfirmMessage(b: BuiltVoucher, label: string, editing: string | null) {
  const n = b.input.lines.length;
  return `${editing ? `Save changes to ${editing}` : `Post a new ${label.toLowerCase()} voucher`} dated ${b.input.date} for ৳${formatMoney(b.debit)} (${n} lines, Dr = Cr)?`;
}
