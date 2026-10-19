/**
 * CSV sheets for the five account reports, with the same rows and columns as the web's Excel
 * exports (dashboard/src/pages/Admin/Accounts/Reports/*.tsx → exportXlsx). Amounts come from
 * integer paisa via csvMoney, so the file holds exactly what the screen shows.
 */
import { csvFileName, csvMoney, type CsvCell } from '@/lib/files/csv';
import type {
  BalanceSheetReport,
  CostCenterReportRow,
  IncomeExpenseReport,
  LedgerReport,
} from '@/lib/api';
import { drCr, type Paisa } from '@/lib/money/money';
import { TYPE_LABELS, costCenterTotals, type TbRow } from './model';

export interface CsvSheet {
  fileName: string;
  headers: string[];
  rows: CsvCell[][];
}

const blankZero = (p: Paisa): CsvCell => (p ? csvMoney(p) : '');

export function ledgerSheet(d: LedgerReport, from: string, to: string): CsvSheet {
  return {
    fileName: csvFileName(['Ledger', d.head.name, from, 'to', to]),
    headers: ['Date', 'Voucher', 'Particulars', 'Debit', 'Credit', 'Balance'],
    rows: [
      [from, '', 'Opening balance', '', '', drCr(d.opening)],
      ...d.rows.map((r) => [
        r.date,
        r.voucher_no,
        [r.narration, r.note].filter(Boolean).join(' — '),
        blankZero(r.debit),
        blankZero(r.credit),
        drCr(r.balance),
      ]),
      [to, '', 'Closing balance', '', '', drCr(d.closing)],
    ],
  };
}

export function trialBalanceSheet(
  v: { rows: readonly TbRow[]; debit: Paisa; credit: Paisa; hasCodes: boolean },
  from: string,
  to: string,
): CsvSheet {
  const code = (c: string | null): CsvCell[] => (v.hasCodes ? [c ?? ''] : []);
  return {
    fileName: csvFileName(['Trial-Balance', from, 'to', to]),
    headers: [...(v.hasCodes ? ['Code'] : []), 'Head', 'Type', 'Debit', 'Credit'],
    rows: [
      ...v.rows.map((r) => [
        ...code(r.code),
        r.name,
        TYPE_LABELS[r.type],
        csvMoney(r.debit),
        csvMoney(r.credit),
      ]),
      [...code(''), 'Total', '', csvMoney(v.debit), csvMoney(v.credit)],
    ],
  };
}

export function incomeExpenseSheet(d: IncomeExpenseReport, from: string, to: string): CsvSheet {
  return {
    fileName: csvFileName(['Income-vs-Expense', from, 'to', to]),
    headers: ['Section', 'Head', 'Amount'],
    rows: [
      ...d.income.map((r) => ['Income', r.name, csvMoney(r.amount)]),
      ['Income', 'Total income', csvMoney(d.total_income)],
      ...d.expense.map((r) => ['Expense', r.name, csvMoney(r.amount)]),
      ['Expense', 'Total expense', csvMoney(d.total_expense)],
      ['', d.net >= 0 ? 'Surplus' : 'Deficit', csvMoney(d.net)],
    ],
  };
}

export function balanceSheetSheet(d: BalanceSheetReport, to: string): CsvSheet {
  return {
    fileName: csvFileName(['Balance-Sheet', 'as-of', to]),
    headers: ['Section', 'Head', 'Amount'],
    rows: [
      ...d.assets.map((r) => ['Assets', r.name, csvMoney(r.amount)]),
      ['Assets', 'Total assets', csvMoney(d.total_assets)],
      ...d.liabilities.map((r) => ['Liabilities', r.name, csvMoney(r.amount)]),
      ...d.equity.map((r) => ['Equity', r.name, csvMoney(r.amount)]),
      ['Equity', 'Surplus / (deficit)', csvMoney(d.surplus)],
      ['Liabilities & equity', 'Total liabilities & equity', csvMoney(d.total_liabilities_equity)],
    ],
  };
}

export function costCenterSheet(
  rows: readonly CostCenterReportRow[],
  from: string,
  to: string,
): CsvSheet {
  const t = costCenterTotals(rows);
  return {
    fileName: csvFileName(['Cost-Center-Report', from, 'to', to]),
    headers: ['Cost center', 'Income', 'Expense', 'Net'],
    rows: [
      ...rows.map((r) => [
        r.cost_center_name,
        csvMoney(r.income),
        csvMoney(r.expense),
        csvMoney(r.net),
      ]),
      ['Total', csvMoney(t.income), csvMoney(t.expense), csvMoney(t.net)],
    ],
  };
}
