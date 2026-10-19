/**
 * Accounts endpoints (Nest, `Auth('admin')`, the school always from the token via `@SchoolId()`),
 * verified against server/src/nest/modules/accounts/*:
 *
 *   GET/POST /api/acc-heads, PATCH/DELETE /api/acc-heads/:id
 *        GET adds `opening_balance` (natural side) and the school's single `opening_date`
 *   GET/POST /api/cost-centers, PATCH/DELETE /api/cost-centers/:id
 *   GET  /api/vouchers?type&from&to&head_id&cost_center_id, POST, PATCH/DELETE /api/vouchers/:id
 *        Dr = Cr is checked in paisa on the server; fee-receipt, opening and closing vouchers and
 *        anything in a closed year are locked there too
 *   GET  /api/acc-years, PUT /api/acc-years/:year (close), DELETE /api/acc-years/:year (reopen)
 *   GET  /api/acc-reports/ledger?head_id&from&to, trial-balance?from&to,
 *        income-expense?from&to, balance-sheet?to, cost-center?from&to
 *
 * Money is parsed into integer paisa (`toPaisa`) and sent back with `toTaka`. school_id is never
 * sent.
 */
import type { AccHeadType, VoucherType } from '@school/shared-schemas';
import { toPaisa, toTaka, type Paisa } from '../money/money';
import type { ApiClient } from './client';
import {
  bool,
  isObj,
  num,
  numOrNull,
  objArray,
  parseError,
  str,
  strOrNull,
  ymd,
  type Json,
} from './parse';

export const ACC_PATHS = {
  heads: '/api/acc-heads',
  head: (id: number) => `/api/acc-heads/${id}`,
  costCenters: '/api/cost-centers',
  costCenter: (id: number) => `/api/cost-centers/${id}`,
  vouchers: '/api/vouchers',
  voucher: (id: number) => `/api/vouchers/${id}`,
  years: '/api/acc-years',
  year: (y: number) => `/api/acc-years/${y}`,
  report: (name: AccReportName) => `/api/acc-reports/${name}`,
} as const;

export type AccReportName =
  'ledger' | 'trial-balance' | 'income-expense' | 'balance-sheet' | 'cost-center';

const HEAD_TYPES: readonly AccHeadType[] = ['asset', 'liability', 'equity', 'income', 'expense'];
const V_TYPES: readonly VoucherType[] = ['receipt', 'payment', 'contra', 'journal'];
const headType = (v: unknown): AccHeadType =>
  HEAD_TYPES.includes(v as AccHeadType) ? (v as AccHeadType) : 'asset';
const voucherType = (v: unknown): VoucherType =>
  V_TYPES.includes(v as VoucherType) ? (v as VoucherType) : 'journal';

export interface AccHead {
  id: number;
  code: string | null;
  name: string;
  type: AccHeadType;
  parent_id: number | null;
  is_cash_bank: boolean;
  bank_name: string | null;
  account_no: string | null;
  is_active: boolean;
  /** On the head's natural side (assets Dr, liabilities/equity Cr); negative = the other side. */
  opening_balance: Paisa;
  opening_date: string | null;
}

export interface AccHeadInput {
  name: string;
  code: string | null;
  type: AccHeadType;
  parent_id: number | null;
  is_cash_bank: boolean;
  bank_name: string | null;
  account_no: string | null;
  is_active: boolean;
  /** undefined = not sent (types without an opening balance, or a new head left blank). */
  opening_balance?: Paisa;
  opening_date: string | null;
}

export interface CostCenter {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface CostCenterInput {
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface VoucherLine {
  id: number;
  head_id: number;
  head: { id: number; name: string; type: AccHeadType } | null;
  cost_center_id: number | null;
  cost_center: { id: number; name: string } | null;
  debit: Paisa;
  credit: Paisa;
  note: string | null;
}

export interface Voucher {
  id: number;
  voucher_no: string;
  type: VoucherType;
  date: string;
  narration: string | null;
  reference: string | null;
  total: Paisa;
  fee_receipt_no: number | null;
  is_opening: boolean;
  is_closing: boolean;
  lines: VoucherLine[];
}

export interface VoucherLineInput {
  head_id: number;
  cost_center_id: number | null;
  debit: Paisa;
  credit: Paisa;
  note: string | null;
}

export interface VoucherInput {
  type: VoucherType;
  date: string;
  narration: string | null;
  reference: string | null;
  lines: VoucherLineInput[];
}

export interface VoucherFilters {
  type?: VoucherType;
  from?: string;
  to?: string;
  head_id?: number;
  cost_center_id?: number;
}

export interface AccYear {
  year: number;
  closed: boolean;
  closed_at: string | null;
  income: Paisa;
  expense: Paisa;
  net: Paisa;
  can_close: boolean;
  can_reopen: boolean;
}

export interface LedgerRow {
  voucher_id: number;
  voucher_no: string;
  date: string;
  type: VoucherType;
  narration: string | null;
  note: string | null;
  debit: Paisa;
  credit: Paisa;
  balance: Paisa;
}

export interface LedgerReport {
  head: { id: number; name: string; type: AccHeadType };
  opening: Paisa;
  rows: LedgerRow[];
  closing: Paisa;
}

export interface TrialBalanceRow {
  head_id: number;
  code: string | null;
  name: string;
  type: AccHeadType;
  parent_id: number | null;
  debit: Paisa;
  credit: Paisa;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  total_debit: Paisa;
  total_credit: Paisa;
}

export interface AmountRow {
  head_id: number;
  name: string;
  parent_id: number | null;
  amount: Paisa;
}

export interface IncomeExpenseReport {
  income: AmountRow[];
  expense: AmountRow[];
  total_income: Paisa;
  total_expense: Paisa;
  net: Paisa;
}

export interface BalanceSheetReport {
  assets: AmountRow[];
  liabilities: AmountRow[];
  equity: AmountRow[];
  surplus: Paisa;
  total_assets: Paisa;
  total_liabilities_equity: Paisa;
}

export interface CostCenterReportRow {
  cost_center_id: number;
  cost_center_name: string;
  income: Paisa;
  expense: Paisa;
  net: Paisa;
}

export function parseAccHead(r: Json): AccHead {
  return {
    id: num(r.id),
    code: strOrNull(r.code),
    name: str(r.name),
    type: headType(r.type),
    parent_id: numOrNull(r.parent_id),
    is_cash_bank: bool(r.is_cash_bank),
    bank_name: strOrNull(r.bank_name),
    account_no: strOrNull(r.account_no),
    is_active: bool(r.is_active, true),
    opening_balance: toPaisa(r.opening_balance),
    opening_date: ymd(r.opening_date) || null,
  };
}

export function parseCostCenter(r: Json): CostCenter {
  return {
    id: num(r.id),
    name: str(r.name),
    code: strOrNull(r.code),
    is_active: bool(r.is_active, true),
  };
}

export function parseVoucher(r: Json): Voucher {
  return {
    id: num(r.id),
    voucher_no: str(r.voucher_no),
    type: voucherType(r.type),
    date: ymd(r.date),
    narration: strOrNull(r.narration),
    reference: strOrNull(r.reference),
    total: toPaisa(r.total),
    fee_receipt_no: numOrNull(r.fee_receipt_no),
    is_opening: bool(r.is_opening),
    is_closing: bool(r.is_closing),
    lines: (Array.isArray(r.lines) ? r.lines.filter(isObj) : []).map((l) => {
      const h = isObj(l.head) ? l.head : null;
      const c = isObj(l.cost_center) ? l.cost_center : null;
      return {
        id: num(l.id),
        head_id: num(l.head_id),
        head: h ? { id: num(h.id), name: str(h.name), type: headType(h.type) } : null,
        cost_center_id: numOrNull(l.cost_center_id),
        cost_center: c ? { id: num(c.id), name: str(c.name) } : null,
        debit: toPaisa(l.debit),
        credit: toPaisa(l.credit),
        note: strOrNull(l.note),
      };
    }),
  };
}

export function parseAccYear(r: Json): AccYear {
  return {
    year: num(r.year),
    closed: bool(r.closed),
    closed_at: strOrNull(r.closed_at),
    income: toPaisa(r.income),
    expense: toPaisa(r.expense),
    net: toPaisa(r.net),
    can_close: bool(r.can_close),
    can_reopen: bool(r.can_reopen),
  };
}

const amountRows = (v: unknown): AmountRow[] =>
  (Array.isArray(v) ? v.filter(isObj) : []).map((r) => ({
    head_id: num(r.head_id),
    name: str(r.name),
    parent_id: numOrNull(r.parent_id),
    amount: toPaisa(r.amount),
  }));

export function parseLedger(data: unknown): LedgerReport {
  if (!isObj(data) || !isObj(data.head)) throw parseError(ACC_PATHS.report('ledger'));
  return {
    head: { id: num(data.head.id), name: str(data.head.name), type: headType(data.head.type) },
    opening: toPaisa(data.opening),
    rows: objArray(data.rows, ACC_PATHS.report('ledger')).map((r) => ({
      voucher_id: num(r.voucher_id),
      voucher_no: str(r.voucher_no),
      date: ymd(r.date),
      type: voucherType(r.type),
      narration: strOrNull(r.narration),
      note: strOrNull(r.note),
      debit: toPaisa(r.debit),
      credit: toPaisa(r.credit),
      balance: toPaisa(r.balance),
    })),
    closing: toPaisa(data.closing),
  };
}

export function parseTrialBalance(data: unknown): TrialBalanceReport {
  if (!isObj(data)) throw parseError(ACC_PATHS.report('trial-balance'));
  return {
    rows: objArray(data.rows, ACC_PATHS.report('trial-balance')).map((r) => ({
      head_id: num(r.head_id),
      code: strOrNull(r.code),
      name: str(r.name),
      type: headType(r.type),
      parent_id: numOrNull(r.parent_id),
      debit: toPaisa(r.debit),
      credit: toPaisa(r.credit),
    })),
    total_debit: toPaisa(data.total_debit),
    total_credit: toPaisa(data.total_credit),
  };
}

export function parseIncomeExpense(data: unknown): IncomeExpenseReport {
  if (!isObj(data)) throw parseError(ACC_PATHS.report('income-expense'));
  return {
    income: amountRows(data.income),
    expense: amountRows(data.expense),
    total_income: toPaisa(data.total_income),
    total_expense: toPaisa(data.total_expense),
    net: toPaisa(data.net),
  };
}

export function parseBalanceSheet(data: unknown): BalanceSheetReport {
  if (!isObj(data)) throw parseError(ACC_PATHS.report('balance-sheet'));
  return {
    assets: amountRows(data.assets),
    liabilities: amountRows(data.liabilities),
    equity: amountRows(data.equity),
    surplus: toPaisa(data.surplus),
    total_assets: toPaisa(data.total_assets),
    total_liabilities_equity: toPaisa(data.total_liabilities_equity),
  };
}

export function parseCostCenterReport(data: unknown): CostCenterReportRow[] {
  if (!isObj(data)) throw parseError(ACC_PATHS.report('cost-center'));
  return objArray(data.rows, ACC_PATHS.report('cost-center')).map((r) => ({
    cost_center_id: num(r.cost_center_id),
    cost_center_name: str(r.cost_center_name),
    income: toPaisa(r.income),
    expense: toPaisa(r.expense),
    net: toPaisa(r.net),
  }));
}

/** POST/PATCH /api/acc-heads body; opening_balance only when given. */
export function accHeadBody(input: AccHeadInput): Json {
  return {
    name: input.name.trim(),
    type: input.type,
    code: input.code,
    parent_id: input.parent_id,
    is_cash_bank: input.is_cash_bank,
    bank_name: input.bank_name,
    account_no: input.account_no,
    is_active: input.is_active,
    ...(input.opening_balance !== undefined
      ? { opening_balance: toTaka(input.opening_balance) }
      : {}),
    opening_date: input.opening_date,
  };
}

export const costCenterBody = (input: CostCenterInput): Json => ({
  name: input.name.trim(),
  code: input.code,
  is_active: input.is_active,
});

/** POST/PATCH /api/vouchers body. Each line carries only its own side. */
export function voucherBody(input: VoucherInput): Json {
  return {
    type: input.type,
    date: input.date,
    narration: input.narration,
    reference: input.reference,
    lines: input.lines.map((l) => ({
      head_id: l.head_id,
      cost_center_id: l.cost_center_id,
      debit: toTaka(l.debit),
      credit: toTaka(l.credit),
      note: l.note,
    })),
  };
}

const defined = (q: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) as Record<
    string,
    string | number
  >;

export const voucherQuery = (f: VoucherFilters) =>
  defined({
    type: f.type,
    from: f.from,
    to: f.to,
    head_id: f.head_id,
    cost_center_id: f.cost_center_id,
  });

export function createAccountsApi(client: ApiClient) {
  const report = (name: AccReportName, query: Record<string, string | number | undefined>) =>
    client.get(ACC_PATHS.report(name), { query: defined(query) });
  return {
    async heads(): Promise<AccHead[]> {
      return objArray(await client.get(ACC_PATHS.heads), ACC_PATHS.heads).map(parseAccHead);
    },
    /** Returns the new head's id (null if the server didn't send one back). */
    async createHead(input: AccHeadInput): Promise<number | null> {
      const data = await client.post(ACC_PATHS.heads, accHeadBody(input));
      return isObj(data) ? numOrNull(data.id) : null;
    },
    async updateHead(id: number, input: AccHeadInput) {
      await client.patch(ACC_PATHS.head(id), accHeadBody(input));
    },
    async deleteHead(id: number) {
      await client.delete(ACC_PATHS.head(id));
    },

    async costCenters(): Promise<CostCenter[]> {
      const data = await client.get(ACC_PATHS.costCenters);
      return objArray(data, ACC_PATHS.costCenters).map(parseCostCenter);
    },
    async createCostCenter(input: CostCenterInput) {
      await client.post(ACC_PATHS.costCenters, costCenterBody(input));
    },
    async updateCostCenter(id: number, input: CostCenterInput) {
      await client.patch(ACC_PATHS.costCenter(id), costCenterBody(input));
    },
    async deleteCostCenter(id: number) {
      await client.delete(ACC_PATHS.costCenter(id));
    },

    async vouchers(f: VoucherFilters): Promise<Voucher[]> {
      const data = await client.get(ACC_PATHS.vouchers, { query: voucherQuery(f) });
      return objArray(data, ACC_PATHS.vouchers).map(parseVoucher);
    },
    async createVoucher(input: VoucherInput) {
      await client.post(ACC_PATHS.vouchers, voucherBody(input), { timeoutMs: 60_000 });
    },
    async updateVoucher(id: number, input: VoucherInput) {
      await client.patch(ACC_PATHS.voucher(id), voucherBody(input), { timeoutMs: 60_000 });
    },
    async deleteVoucher(id: number) {
      await client.delete(ACC_PATHS.voucher(id));
    },

    async years(): Promise<AccYear[]> {
      return objArray(await client.get(ACC_PATHS.years), ACC_PATHS.years).map(parseAccYear);
    },
    async closeYear(year: number) {
      await client.put(ACC_PATHS.year(year), {}, { timeoutMs: 60_000 });
    },
    async reopenYear(year: number) {
      await client.delete(ACC_PATHS.year(year));
    },

    async ledger(q: { head_id: number; from?: string; to?: string }) {
      return parseLedger(await report('ledger', q));
    },
    async trialBalance(q: { from?: string; to?: string }) {
      return parseTrialBalance(await report('trial-balance', q));
    },
    async incomeExpense(q: { from?: string; to?: string }) {
      return parseIncomeExpense(await report('income-expense', q));
    },
    async balanceSheet(q: { to?: string }) {
      return parseBalanceSheet(await report('balance-sheet', q));
    },
    async costCenterReport(q: { from?: string; to?: string }) {
      return parseCostCenterReport(await report('cost-center', q));
    },
  };
}

export type AccountsApi = ReturnType<typeof createAccountsApi>;
