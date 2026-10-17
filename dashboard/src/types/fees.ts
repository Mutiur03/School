export type FeeFrequency = 'monthly' | 'once';

export interface FeeHead {
  id: number;
  name: string;
  frequency: FeeFrequency;
  income_head_id: number;
  income_head: { id: number; name: string };
  /** Fixed cash/bank account for this fee; null = the cashier picks at collection. */
  deposit_head_id: number | null;
  deposit_head: { id: number; name: string } | null;
  is_waivable: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FeeHeadInput {
  name: string;
  frequency: FeeFrequency;
  /** Omit to let the server create "<name> Fees". */
  income_head_id?: number;
  deposit_head_id: number | null;
  is_waivable: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FeeStructureRow {
  id: number;
  year: number;
  class: number;
  fee_head_id: number;
  amount: number;
  fee_head: { id: number; name: string; frequency: FeeFrequency };
}

export interface FeeWaiver {
  id: number;
  student_id: number;
  year: number;
  fee_head_id: number | null;
  percent: boolean;
  value: number;
  note: string | null;
  student: { id: number; name: string; login_id: number | string };
  fee_head: { id: number; name: string } | null;
}

export interface FeeWaiverInput {
  student_id: number;
  year: number;
  fee_head_id?: number;
  percent: boolean;
  value: number;
  note?: string;
}

export interface DueRow {
  fee_head_id: number;
  fee_head: string;
  month: number;
  charge: number;
  waiver: number;
  payable: number;
  status: 'paid' | 'due' | 'waived';
  receipt_no: number | null;
  paid_amount: number;
  deposit: { id: number; name: string } | null;
}

export interface FeeStatement {
  student: { id: number; name: string; login_id: number | string; father_name: string | null };
  enrollment: { year: number; class: number; section: string; roll: number };
  rows: DueRow[];
  totals: { waiver: number; paid: number; due: number };
}

export interface FeeReceiptListItem {
  id: number;
  receipt_no: number;
  date: string;
  year: number;
  class: number;
  section: string;
  roll: number;
  total: number;
  student: { id: number; name: string; login_id: number | string };
  /** Cash/bank accounts the money went into (one receipt can span several). */
  accounts: { id: number; name: string; amount: number }[];
  voucher_no: string;
}

export interface FeeReceiptInput {
  student_id: number;
  year: number;
  date: string;
  /** Only for fees that have no fixed deposit account. */
  pay_head_id?: number;
  note?: string;
  items: { fee_head_id: number; month: number }[];
}

export interface FeeCollectionReport {
  from: string;
  to: string;
  total: number;
  count: number;
  by_day: { date: string; count: number; total: number }[];
  by_class: { class: number; count: number; total: number }[];
  by_account: { deposit_head_id: number; name: string; total: number }[];
  by_head: { fee_head_id: number; name: string; count: number; waiver: number; total: number }[];
}

export interface FeeDuesReport {
  year: number;
  class: number;
  section: string | null;
  upto_month: number;
  rows: {
    student_id: number;
    name: string;
    login_id: number;
    section: string;
    roll: number;
    charge: number;
    waiver: number;
    paid: number;
    due: number;
  }[];
  total_due: number;
}

export interface FeeSummary {
  today: number;
  month: number;
  year: number;
  last_7_days: { date: string; total: number }[];
  latest: {
    id: number;
    receipt_no: number;
    date: string;
    total: number;
    student: { name: string; login_id: number | string };
    class: number;
    section: string;
    roll: number;
  }[];
}
