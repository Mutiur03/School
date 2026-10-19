/**
 * Pure logic behind the accounts pages (dashboard/src/pages/Admin/Accounts/heads.ts, the report
 * pages and FiscalYears). Amounts are integer paisa; every subtotal is an integer sum.
 */
import type { AccHeadType, VoucherType } from '@school/shared-schemas';
import type {
  AccHead,
  AccHeadInput,
  AccYear,
  AmountRow,
  BalanceSheetReport,
  CostCenterReportRow,
  TrialBalanceRow,
  Voucher,
} from '@/lib/api/accounts';
import {
  absPaisa,
  addPaisa,
  formatMoney,
  negPaisa,
  parseMoneyInput,
  subPaisa,
  sumPaisa,
  ZERO,
  type Paisa,
} from '@/lib/money/money';

export const ACC_TYPES: readonly AccHeadType[] = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
];

/** System equity head that balances the opening voucher (shared-schemas OPENING_EQUITY_NAME). */
export const OPENING_EQUITY = 'Opening Balance Equity';

export const TYPE_LABELS: Record<AccHeadType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

export const VOUCHER_MODES: { type: VoucherType; label: string }[] = [
  { type: 'receipt', label: 'Income' },
  { type: 'payment', label: 'Expense' },
  { type: 'contra', label: 'Transfer' },
  { type: 'journal', label: 'Journal' },
];
export const VOUCHER_LABEL = Object.fromEntries(
  VOUCHER_MODES.map((m) => [m.type, m.label]),
) as Record<VoucherType, string>;

/** Types that can carry an opening balance (income/expense start every year at zero). */
export const OPENING_TYPES: readonly AccHeadType[] = ['asset', 'liability', 'equity'];
export const OPENING_SIDE: Partial<Record<AccHeadType, string>> = {
  asset: 'Debit balance',
  liability: 'Credit balance',
  equity: 'Credit balance',
};
export const defaultOpeningDate = (now = new Date()) => `${now.getFullYear()}-01-01`;

type TreeHead = Pick<AccHead, 'id' | 'parent_id' | 'code' | 'name'>;

/** Heads of one type, parents first with children (depth-indented) right after. */
export function flattenTree<T extends TreeHead>(heads: readonly T[]): { head: T; depth: number }[] {
  const ids = new Set(heads.map((h) => h.id));
  const byParent = new Map<number | null, T[]>();
  for (const h of heads) {
    const key = h.parent_id != null && ids.has(h.parent_id) ? h.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), h]);
  }
  const out: { head: T; depth: number }[] = [];
  const seen = new Set<number>();
  const walk = (parent: number | null, depth: number) => {
    for (const head of [...(byParent.get(parent) ?? [])].sort((a, b) =>
      (a.code ?? a.name).localeCompare(b.code ?? b.name),
    )) {
      if (seen.has(head.id)) continue;
      seen.add(head.id);
      out.push({ head, depth });
      walk(head.id, depth + 1);
    }
  };
  walk(null, 0);
  // A parent cycle (the server only blocks self-parenting) would hide heads: list them at the top.
  for (const h of heads) if (!seen.has(h.id)) out.push({ head: h, depth: 0 });
  return out;
}

export const groupByType = <T extends TreeHead & { type: AccHeadType }>(heads: readonly T[]) =>
  ACC_TYPES.map((type) => ({ type, rows: flattenTree(heads.filter((h) => h.type === type)) }));

/** Walk parent_id up to the root head (guards against cycles). */
export function topAncestor(id: number, byId: ReadonlyMap<number, Pick<AccHead, 'parent_id'>>) {
  let cur = id;
  const seen = new Set<number>();
  while (!seen.has(cur)) {
    seen.add(cur);
    const parent = byId.get(cur)?.parent_id;
    if (parent == null || !byId.has(parent)) break;
    cur = parent;
  }
  return cur;
}

export function depthOf(id: number, byId: ReadonlyMap<number, Pick<AccHead, 'parent_id'>>) {
  let d = 0;
  for (let cur = byId.get(id)?.parent_id; cur != null && d < 10; cur = byId.get(cur)?.parent_id)
    d++;
  return d;
}

/** Select options grouped by type, children indented (web GroupedHeadOptions). */
export function headOptions(heads: readonly AccHead[]) {
  return groupByType(heads).flatMap((g) =>
    g.rows.map(({ head, depth }) => ({
      value: head.id,
      label: `${'  '.repeat(depth)}${head.name} · ${TYPE_LABELS[g.type]}`,
    })),
  );
}

// ---- Account head form --------------------------------------------------------------------

export const canHaveOpening = (type: AccHeadType, editing: Pick<AccHead, 'name'> | null) =>
  OPENING_TYPES.includes(type) && editing?.name !== OPENING_EQUITY;

export interface AccHeadForm {
  name: string;
  code: string;
  type: AccHeadType;
  parent_id: number | null;
  is_cash_bank: boolean;
  bank_name: string;
  account_no: string;
  is_active: boolean;
  opening_balance: string;
  opening_date: string;
}

/**
 * Form → request, as the web does it: cash/bank only for assets (bank details dropped
 * otherwise), a parent only if it is still a valid option, the opening balance parsed exactly
 * (negative = the other side) and sent only for asset/liability/equity heads; blank on edit = 0.
 */
export function accHeadInput(
  f: AccHeadForm,
  editing: AccHead | null,
  heads: readonly AccHead[],
): { ok: true; input: AccHeadInput } | { ok: false; field: keyof AccHeadForm; error: string } {
  const name = f.name.trim();
  if (!name) return { ok: false, field: 'name', error: 'Name is required' };
  if (name.length > 100) return { ok: false, field: 'name', error: 'Name is too long' };
  const cash = f.type === 'asset' && f.is_cash_bank;
  const parentOk = heads.some(
    (h) => h.id === f.parent_id && h.type === f.type && h.id !== editing?.id,
  );
  const opening = canHaveOpening(f.type, editing);
  let opening_balance: Paisa | undefined;
  if (opening) {
    const r = parseMoneyInput(f.opening_balance, { allowNegative: true, allowZero: true });
    if (!r.ok) return { ok: false, field: 'opening_balance', error: r.error };
    opening_balance = r.empty ? (editing ? ZERO : undefined) : r.paisa;
    if (opening_balance !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(f.opening_date))
      return { ok: false, field: 'opening_date', error: 'Pick the opening date' };
  }
  const text = (s: string) => (s.trim() ? s.trim() : null);
  return {
    ok: true,
    input: {
      name,
      code: text(f.code),
      type: f.type,
      parent_id: parentOk ? f.parent_id : null,
      is_cash_bank: cash,
      bank_name: cash ? text(f.bank_name) : null,
      account_no: cash ? text(f.account_no) : null,
      is_active: f.is_active,
      ...(opening_balance !== undefined ? { opening_balance } : {}),
      opening_date: opening ? text(f.opening_date) : null,
    },
  };
}

/** The opening balance moves the opening voucher, so a change gets its own confirm. */
export const openingChanged = (editing: AccHead | null, input: AccHeadInput) =>
  input.opening_balance !== undefined && input.opening_balance !== (editing?.opening_balance ?? 0);

// ---- Vouchers -----------------------------------------------------------------------------

/** Locked vouchers can't be edited here (the server refuses them too). */
export function voucherLock(v: Voucher, closedYears: ReadonlySet<number>): string | null {
  if (v.is_closing) return 'Year-end closing';
  if (v.is_opening) return 'Opening balances';
  if (v.fee_receipt_no) return `Fee receipt #${v.fee_receipt_no}`;
  if (closedYears.has(Number(v.date.slice(0, 4)))) return 'Year closed';
  return null;
}

export const LOCK_HINT: Record<string, string> = {
  'Year-end closing': 'Year-end closing. Reopen the year in Fiscal Years to undo it.',
  'Opening balances': 'Opening balances. Edit them on each account head.',
  'Year closed': 'This year is closed. Reopen it in Fiscal Years to change it.',
};
export const lockHint = (lock: string) =>
  LOCK_HINT[lock] ?? 'Posted by fee collection. Edit or delete the receipt in Fees > Receipts.';

// ---- Reports ------------------------------------------------------------------------------

export type TbRow = TrialBalanceRow & { depth: number };

/**
 * Trial balance rows. Short: every head rolled into its top-level parent and netted to one side,
 * with totals summed here; Full: the server's rows and totals.
 */
export function trialBalanceView(
  rows: readonly TrialBalanceRow[],
  heads: readonly AccHead[],
  short: boolean,
  serverTotals: { debit: Paisa; credit: Paisa },
): { rows: TbRow[]; debit: Paisa; credit: Paisa; difference: Paisa; hasCodes: boolean } {
  const byId = new Map(heads.map((h) => [h.id, h]));
  let out: TbRow[] = rows.map((r) => ({ ...r, depth: depthOf(r.head_id, byId) }));
  if (short) {
    const rolled = new Map<number, TbRow>();
    for (const r of out) {
      const topId = topAncestor(r.head_id, byId);
      const top = byId.get(topId);
      const acc = rolled.get(topId) ?? {
        ...r,
        head_id: topId,
        code: top?.code ?? r.code,
        name: top?.name ?? r.name,
        parent_id: null,
        debit: ZERO,
        credit: ZERO,
        depth: 0,
      };
      rolled.set(topId, {
        ...acc,
        debit: addPaisa(acc.debit, r.debit),
        credit: addPaisa(acc.credit, r.credit),
      });
    }
    out = [...rolled.values()].map((r) => {
      const net = subPaisa(r.debit, r.credit);
      return { ...r, debit: net > 0 ? net : ZERO, credit: net < 0 ? negPaisa(net) : ZERO };
    });
  }
  const debit = short ? sumPaisa(out, (r) => r.debit) : serverTotals.debit;
  const credit = short ? sumPaisa(out, (r) => r.credit) : serverTotals.credit;
  return {
    rows: out,
    debit,
    credit,
    difference: absPaisa(subPaisa(debit, credit)),
    hasCodes: out.some((r) => r.code),
  };
}

export interface AmountGroup {
  parent: { id: number; name: string } | null;
  subtotal: Paisa;
  rows: AmountRow[];
}

/** AmountTable: rows under their parent head (when it exists), each group with a subtotal. */
export function amountGroups(
  rows: readonly AmountRow[],
  byId: ReadonlyMap<number, Pick<AccHead, 'name'>>,
): AmountGroup[] {
  const groups = new Map<number | null, AmountRow[]>();
  for (const r of rows) {
    const key = r.parent_id != null && byId.has(r.parent_id) ? r.parent_id : null;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups].map(([id, items]) => ({
    parent: id == null ? null : { id, name: byId.get(id)?.name ?? '' },
    subtotal: sumPaisa(items, (r) => r.amount),
    rows: items,
  }));
}

/** Balance sheet: liabilities total, equity total (incl. surplus) and the balanced check. */
export function balanceSheetView(d: BalanceSheetReport) {
  const liabilities = sumPaisa(d.liabilities, (r) => r.amount);
  const equity = subPaisa(d.total_liabilities_equity, liabilities);
  const difference = absPaisa(subPaisa(d.total_assets, d.total_liabilities_equity));
  return { liabilities, equity, difference, balanced: difference === 0 };
}

export function costCenterTotals(rows: readonly CostCenterReportRow[]) {
  return {
    income: sumPaisa(rows, (r) => r.income),
    expense: sumPaisa(rows, (r) => r.expense),
    net: sumPaisa(rows, (r) => r.net),
  };
}

// ---- Fiscal years -------------------------------------------------------------------------

export const surplusLabel = (net: Paisa) =>
  `${formatMoney(absPaisa(net))} ${net < 0 ? 'deficit' : 'surplus'}`;

export const closeYearMessage = (y: Pick<AccYear, 'year' | 'net'>) =>
  `The ${y.net < 0 ? 'deficit' : 'surplus'} of ${formatMoney(absPaisa(y.net))} moves into ` +
  `Retained Earnings and ${y.year + 1} starts with zero income and expense. No voucher or fee ` +
  `receipt dated in ${y.year} can be added, changed or deleted until you reopen it.`;

export const reopenYearMessage = (y: Pick<AccYear, 'year'>) =>
  `The ${y.year} closing entry is removed and entries in that year can be changed again. ` +
  `Close it once you have finished.`;

/** Calendar-year shortcut for reports: the year whose 1 Jan - 31 Dec matches, else null. */
export function pickedYear(from: string | undefined, to: string, years: readonly number[]) {
  return (
    years.find((y) => to === `${y}-12-31` && (from === undefined || from === `${y}-01-01`)) ?? null
  );
}

export const reportYears = (now = new Date()) =>
  Array.from({ length: 8 }, (_, i) => now.getFullYear() - i);

// ---- Quick add head (web QuickHeadPopup, inside the voucher form) --------------------------

export interface QuickHeadPreset {
  /** Locks the type when the field only takes one (income / expense rows, cash/bank picker). */
  type?: AccHeadType;
  cashBank?: boolean;
}

export interface QuickHeadForm {
  name: string;
  type: AccHeadType;
  cashBank: boolean;
  bankName: string;
  accountNo: string;
  opening: string;
  openingDate: string;
}

export const quickHeadDefaults = (
  preset: QuickHeadPreset,
  heads: readonly Pick<AccHead, 'opening_date'>[],
  now = new Date(),
): QuickHeadForm => ({
  name: '',
  type: preset.type ?? 'expense',
  cashBank: preset.cashBank ?? false,
  bankName: '',
  accountNo: '',
  opening: '',
  openingDate: heads.find((h) => h.opening_date)?.opening_date ?? defaultOpeningDate(now),
});

/** Names are unique per school; case-insensitive so look-alikes are caught before the server. */
export const quickHeadClash = (heads: readonly AccHead[], name: string) => {
  const n = name.trim().toLowerCase();
  return n ? heads.find((h) => h.name.toLowerCase() === n) : undefined;
};

/** The minimal head the web's quick popup creates: top level, no code, active. */
export function quickHeadInput(f: QuickHeadForm, heads: readonly AccHead[]) {
  const clash = quickHeadClash(heads, f.name);
  if (clash) {
    return {
      ok: false as const,
      field: 'name' as const,
      error: `"${clash.name}" already exists (${TYPE_LABELS[clash.type]}). Use a different name.`,
    };
  }
  return accHeadInput(
    {
      name: f.name,
      code: '',
      type: f.type,
      parent_id: null,
      is_cash_bank: f.type === 'asset' && f.cashBank,
      bank_name: f.bankName,
      account_no: f.accountNo,
      is_active: true,
      opening_balance: f.opening,
      opening_date: f.openingDate,
    },
    null,
    heads,
  );
}
