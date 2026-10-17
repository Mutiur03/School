import { ACC_HEAD_TYPES, type AccHeadType, type VoucherType } from '@school/shared-schemas';
import type { AccHead } from '@/types/accounts';
import { formatMoney } from '@/lib/utils';
import { filterSelectClassName } from '@/components';

export const selectClass = filterSelectClassName;

/** Ledger-style balance: positive = Dr, negative = Cr. */
export const drCr = (n: number) => `${formatMoney(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}`;

export const VOUCHER_MODES: { type: VoucherType; label: string }[] = [
  { type: 'receipt', label: 'Income' },
  { type: 'payment', label: 'Expense' },
  { type: 'contra', label: 'Transfer' },
  { type: 'journal', label: 'Journal' },
];

export const TYPE_LABELS: Record<AccHeadType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

/** Heads of one type, parents first with children (depth-indented) right after. */
export const flattenTree = (heads: AccHead[]) => {
  const ids = new Set(heads.map((h) => h.id));
  const byParent = new Map<number | null, AccHead[]>();
  for (const h of heads) {
    const key = h.parent_id != null && ids.has(h.parent_id) ? h.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), h]);
  }
  const out: { head: AccHead; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const head of (byParent.get(parent) ?? []).sort((a, b) =>
      (a.code ?? a.name).localeCompare(b.code ?? b.name),
    )) {
      out.push({ head, depth });
      walk(head.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
};

/** All heads grouped by type in chart order, each group tree-flattened. */
export const groupByType = (heads: AccHead[]) =>
  ACC_HEAD_TYPES.map((type) => ({
    type,
    rows: flattenTree(heads.filter((h) => h.type === type)),
  }));

/** Walk parent_id up to the root head (guards against cycles). */
export const topAncestor = (id: number, byId: Map<number, AccHead>) => {
  let cur = id;
  const seen = new Set<number>();
  while (!seen.has(cur)) {
    seen.add(cur);
    const parent = byId.get(cur)?.parent_id;
    if (parent == null || !byId.has(parent)) break;
    cur = parent;
  }
  return cur;
};

export const depthOf = (id: number, byId: Map<number, AccHead>) => {
  let d = 0;
  for (let cur = byId.get(id)?.parent_id; cur != null && d < 10; cur = byId.get(cur)?.parent_id)
    d++;
  return d;
};

/** Types that can carry an opening balance (income/expense start every year at zero). */
export const OPENING_TYPES: AccHeadType[] = ['asset', 'liability', 'equity'];

/** Side an opening balance is entered on, per type. */
export const OPENING_SIDE: Partial<Record<AccHeadType, string>> = {
  asset: 'Debit balance',
  liability: 'Credit balance',
  equity: 'Credit balance',
};

/** Where the school's opening balances start unless set otherwise. */
export const defaultOpeningDate = () => `${new Date().getFullYear()}-01-01`;
