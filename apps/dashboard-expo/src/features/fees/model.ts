/**
 * Pure logic behind the fee pages (dashboard/src/pages/Admin/Fees/*). Every amount is integer
 * paisa (src/lib/money/money.ts); the server recomputes what a receipt is worth, so the totals here
 * are only for showing the cashier what will be collected.
 */
import type {
  DueRow,
  FeeHead,
  FeeReceiptInput,
  FeeStatement,
  FeeWaiver,
  FeeWaiverInput,
} from '@/lib/api/fees';
import {
  addPaisa,
  formatMoney,
  moneyText,
  parseMoneyInput,
  parsePercentInput,
  sumPaisa,
  type Paisa,
} from '@/lib/money/money';

/** Month names by the server's month number; 0 is a one-off fee. */
export const MONTHS = [
  'One-off',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
export const monthLabel = (m: number) => MONTHS[m] ?? String(m);

export const CLASSES = [6, 7, 8, 9, 10] as const;
export const SECTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

/** The web's session list: next year, this year, the two before. */
export const feeYears = (thisYear = new Date().getFullYear()) => [
  thisYear + 1,
  thisYear,
  thisYear - 1,
  thisYear - 2,
];

export const frequencyLabel = (f: FeeHead['frequency']) =>
  f === 'monthly' ? 'Every month' : 'Once';

// ---- Collect fees -------------------------------------------------------------------------

export const dueKey = (r: Pick<DueRow, 'fee_head_id' | 'month'>) => `${r.fee_head_id}:${r.month}`;

export function toggleKey(set: ReadonlySet<string>, k: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(k)) next.add(k);
  return next;
}

/** "Select all due" / "Clear selection". */
export function toggleAllDue(set: ReadonlySet<string>, rows: readonly DueRow[]): Set<string> {
  const due = rows.filter((r) => r.status === 'due').map(dueKey);
  return set.size === due.length && due.length > 0 ? new Set() : new Set(due);
}

/** Keep only picks that are still due after the statement reloads (paid rows drop out). */
export function retainDue(set: ReadonlySet<string>, rows: readonly DueRow[]): Set<string> {
  const due = new Set(rows.filter((r) => r.status === 'due').map(dueKey));
  return new Set([...set].filter((k) => due.has(k)));
}

export interface Destination {
  /** Cash/bank head id; null = the "Received in" account the cashier picks. */
  id: number | null;
  name: string;
  amount: Paisa;
}

export interface Collection {
  picked: DueRow[];
  total: Paisa;
  /** A picked fee has no fixed deposit account, so "Received in" must be chosen. */
  needsPayHead: boolean;
  destinations: Destination[];
  /** Why Collect is disabled; null = ready. */
  issue: string | null;
}

export function collectionSummary(
  rows: readonly DueRow[],
  picked: ReadonlySet<string>,
  payHead: { id: number; name: string } | null,
): Collection {
  const chosen = rows.filter((r) => r.status === 'due' && picked.has(dueKey(r)));
  const total = sumPaisa(chosen, (r) => r.payable);
  const needsPayHead = chosen.some((r) => !r.deposit);
  const byAccount = new Map<string, Destination>();
  for (const r of chosen) {
    const id = r.deposit?.id ?? payHead?.id ?? null;
    const name = r.deposit?.name ?? payHead?.name ?? 'Pick an account';
    const k = `${id ?? 'none'}`;
    const d = byAccount.get(k) ?? { id, name, amount: 0 as Paisa };
    byAccount.set(k, { ...d, amount: addPaisa(d.amount, r.payable) });
  }
  const issue =
    chosen.length === 0
      ? 'Tick the installments being paid'
      : needsPayHead && !payHead
        ? 'Pick the cash/bank account'
        : total <= 0
          ? 'Nothing to collect'
          : null;
  return { picked: chosen, total, needsPayHead, destinations: [...byAccount.values()], issue };
}

/**
 * POST /api/fee-receipts input: only the installments (the server prices them), `pay_head_id`
 * only when a picked fee needs it, and the date the cashier chose.
 */
export function receiptInput(p: {
  studentId: number;
  year: number;
  date: string;
  payHeadId: number | null;
  note: string;
  collection: Collection;
}): FeeReceiptInput {
  return {
    student_id: p.studentId,
    year: p.year,
    date: p.date,
    ...(p.collection.needsPayHead && p.payHeadId ? { pay_head_id: p.payHeadId } : {}),
    ...(p.note.trim() ? { note: p.note.trim() } : {}),
    items: p.collection.picked.map((r) => ({ fee_head_id: r.fee_head_id, month: r.month })),
  };
}

/** The confirm dialog's message: who, how many installments, how much, into which accounts. */
export function collectConfirmMessage(
  st: Pick<FeeStatement, 'student' | 'enrollment'>,
  c: Collection,
  date: string,
): string {
  const where = c.destinations.map((d) => `${d.name} ৳${formatMoney(d.amount)}`).join(', ');
  const n = c.picked.length;
  return (
    `Collect ৳${formatMoney(c.total)} from ${st.student.name} (Class ${st.enrollment.class}-` +
    `${st.enrollment.section}, roll ${st.enrollment.roll}) for ${n} installment${n === 1 ? '' : 's'} ` +
    `on ${date}? Money goes to: ${where}. A receipt and its voucher are posted.`
  );
}

export const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// ---- Fee structure ------------------------------------------------------------------------

/** Text for a stored amount ("1200", "1200.5" → "1200.50"). */
export const amountText = (p: Paisa) => moneyText(p, false);

/**
 * PUT /api/fee-structures items from the per-head amount fields. Blank = not charged; anything
 * else must be a positive amount with at most two decimals.
 */
export function structureItems(
  heads: readonly Pick<FeeHead, 'id' | 'name'>[],
  texts: Readonly<Record<number, string>>,
): { items: { fee_head_id: number; amount: Paisa }[]; errors: Record<number, string> } {
  const items: { fee_head_id: number; amount: Paisa }[] = [];
  const errors: Record<number, string> = {};
  for (const h of heads) {
    const r = parseMoneyInput(texts[h.id] ?? '');
    if (r.empty) continue;
    if (!r.ok) errors[h.id] = r.error;
    else items.push({ fee_head_id: h.id, amount: r.paisa });
  }
  return { items, errors };
}

/** Did the fields change against what the server has? */
export function structureDirty(
  saved: readonly { fee_head_id: number; amount: Paisa }[],
  items: readonly { fee_head_id: number; amount: Paisa }[],
): boolean {
  if (saved.length !== items.length) return true;
  const m = new Map(saved.map((s) => [s.fee_head_id, s.amount]));
  return items.some((i) => m.get(i.fee_head_id) !== i.amount);
}

// ---- Waivers ------------------------------------------------------------------------------

export function waiverInput(p: {
  studentId: number | null;
  year: number;
  feeHeadId: number | null;
  percent: boolean;
  value: string;
  note: string;
}): { ok: true; input: FeeWaiverInput } | { ok: false; error: string } {
  if (!p.studentId) return { ok: false, error: 'Pick a student' };
  const v = p.percent ? parsePercentInput(p.value) : parseMoneyInput(p.value);
  if (v.empty) return { ok: false, error: 'Enter a waiver amount' };
  if (!v.ok) return { ok: false, error: v.error };
  return {
    ok: true,
    input: {
      student_id: p.studentId,
      year: p.year,
      ...(p.feeHeadId ? { fee_head_id: p.feeHeadId } : {}),
      percent: p.percent,
      value: v.paisa,
      ...(p.note.trim() ? { note: p.note.trim() } : {}),
    },
  };
}

/** "12.5%" or "1,200.00" (percent values are stored in hundredths, like paisa). */
export const waiverValueLabel = (w: Pick<FeeWaiver, 'percent' | 'value'>) =>
  w.percent ? `${amountText(w.value)}%` : formatMoney(w.value);

// ---- Student picker (class → section → search) --------------------------------------------

export interface PickerStudent {
  id: number;
  name: string;
  roll: number;
  section: string;
  class: number;
}

export const sectionsOf = (list: readonly PickerStudent[]) =>
  [...new Set(list.map((s) => s.section))].filter(Boolean).sort();

export function filterPicker(
  list: readonly PickerStudent[],
  section: string,
  search: string,
): PickerStudent[] {
  const q = search.trim().toLowerCase();
  return list
    .filter(
      (s) =>
        (!section || s.section === section) &&
        (!q || s.name.toLowerCase().includes(q) || String(s.roll) === q),
    )
    .sort((a, b) => a.section.localeCompare(b.section) || a.roll - b.roll);
}

// ---- Reports ------------------------------------------------------------------------------

/** Bar heights for "Last 7 days" (0-100), from paisa so the ratio is exact. */
export function barHeights(days: readonly { total: Paisa }[]): number[] {
  const peak = Math.max(1, ...days.map((d) => d.total));
  return days.map((d) => Math.max(2, (d.total / peak) * 100));
}

export const monthStartYmd = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
