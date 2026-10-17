import type { AccHeadType, VoucherType } from '@school/shared-schemas';

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
  /** Opening balance on the head's natural side (assets Dr, liabilities/equity Cr). */
  opening_balance: number;
  /** One date for all of the school's opening balances; null until the first is set. */
  opening_date: string | null;
}

export interface CostCenter {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface VoucherLine {
  id: number;
  head_id: number;
  head: { id: number; name: string; type: AccHeadType };
  cost_center_id: number | null;
  cost_center: { id: number; name: string } | null;
  debit: number;
  credit: number;
  note: string | null;
}

export interface Voucher {
  id: number;
  voucher_no: string;
  type: VoucherType;
  date: string;
  narration: string | null;
  reference: string | null;
  total: number;
  /** Set when a fee receipt posted this voucher: read-only here, managed from Fees > Receipts. */
  fee_receipt_no: number | null;
  /** The opening-balances voucher: read-only here, edited on each account head. */
  is_opening: boolean;
  lines: VoucherLine[];
}

export interface VoucherFilters {
  type?: VoucherType | '';
  from?: string;
  to?: string;
  head_id?: number;
  cost_center_id?: number;
}

export interface LedgerReport {
  head: { id: number; name: string; type: AccHeadType };
  opening: number;
  rows: {
    voucher_id: number;
    voucher_no: string;
    date: string;
    type: VoucherType;
    narration: string | null;
    note: string | null;
    debit: number;
    credit: number;
    balance: number;
  }[];
  closing: number;
}

export interface TrialBalanceReport {
  rows: {
    head_id: number;
    code: string | null;
    name: string;
    type: AccHeadType;
    parent_id: number | null;
    debit: number;
    credit: number;
  }[];
  total_debit: number;
  total_credit: number;
}

export interface AmountRow {
  head_id: number;
  name: string;
  parent_id: number | null;
  amount: number;
}

export interface IncomeExpenseReport {
  income: AmountRow[];
  expense: AmountRow[];
  total_income: number;
  total_expense: number;
  net: number;
}

export interface BalanceSheetReport {
  assets: AmountRow[];
  liabilities: AmountRow[];
  equity: AmountRow[];
  surplus: number;
  total_assets: number;
  total_liabilities_equity: number;
}

export interface CostCenterReport {
  rows: {
    cost_center_id: number;
    cost_center_name: string;
    income: number;
    expense: number;
    net: number;
  }[];
}
