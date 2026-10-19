/**
 * Accounts logic: head tree helpers, the head form → request, voucher lines from every mode (Dr =
 * Cr in paisa, checked again against the shared voucherFormSchema), toSimple, locks, and the
 * report subtotals (trial-balance short rollup, grouped amounts, balance sheet, cost centers).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AccHead, Voucher } from '@/lib/api/accounts';
import { voucherBody } from '@/lib/api/accounts';
import { fromPaisaInt, toPaisa } from '@/lib/money/money';
import {
  accHeadInput,
  amountGroups,
  balanceSheetView,
  closeYearMessage,
  costCenterTotals,
  depthOf,
  flattenTree,
  groupByType,
  openingChanged,
  pickedYear,
  surplusLabel,
  topAncestor,
  trialBalanceView,
  voucherLock,
  type AccHeadForm,
} from './model';
import {
  blankGrid,
  buildVoucher,
  gridFromVoucher,
  toSimple,
  voucherConfirmMessage,
  type VoucherState,
} from './voucher-model';

const P = fromPaisaInt;
const head = (over: Partial<AccHead> & Pick<AccHead, 'id' | 'name'>): AccHead => ({
  code: null,
  type: 'asset',
  parent_id: null,
  is_cash_bank: false,
  bank_name: null,
  account_no: null,
  is_active: true,
  opening_balance: P(0),
  opening_date: null,
  ...over,
});

const heads: AccHead[] = [
  head({ id: 1, name: 'Cash', is_cash_bank: true }),
  head({ id: 2, name: 'Bank', is_cash_bank: true }),
  head({ id: 3, name: 'Fees', type: 'income' }),
  head({ id: 4, name: 'Tuition Fees', type: 'income', parent_id: 3 }),
  head({ id: 5, name: 'Salary', type: 'expense' }),
  head({ id: 6, name: 'Teacher salary', type: 'expense', parent_id: 5 }),
  head({ id: 7, name: 'Loan', type: 'liability' }),
];
const byId = new Map(heads.map((h) => [h.id, h]));

describe('head tree', () => {
  it('parents first, children indented', () => {
    assert.deepEqual(
      flattenTree(heads.filter((h) => h.type === 'income')).map((r) => [r.head.id, r.depth]),
      [
        [3, 0],
        [4, 1],
      ],
    );
    assert.deepEqual(
      groupByType(heads).map((g) => g.rows.length),
      [2, 1, 0, 2, 2],
    );
    assert.equal(topAncestor(4, byId), 3);
    assert.equal(depthOf(6, byId), 1);
  });
  it('a parent cycle does not hide heads', () => {
    const cyc = [
      head({ id: 1, name: 'A', parent_id: 2 }),
      head({ id: 2, name: 'B', parent_id: 1 }),
    ];
    assert.deepEqual(
      flattenTree(cyc)
        .map((r) => r.head.id)
        .sort(),
      [1, 2],
    );
    const m = new Map(cyc.map((h) => [h.id, h]));
    assert.ok([1, 2].includes(topAncestor(1, m)));
  });
});

describe('account head form', () => {
  const form: AccHeadForm = {
    name: ' Petty cash ',
    code: '',
    type: 'asset',
    parent_id: 1,
    is_cash_bank: true,
    bank_name: '',
    account_no: '123',
    is_active: true,
    opening_balance: '1,500.75',
    opening_date: '2026-01-01',
  };
  it('parses the opening balance exactly and keeps cash/bank for assets', () => {
    const r = accHeadInput(form, null, heads);
    assert.ok(r.ok);
    assert.equal(r.input.opening_balance, 150075);
    assert.equal(r.input.parent_id, 1);
    assert.equal(r.input.account_no, '123');
    assert.equal(r.input.bank_name, null);
    assert.equal(r.input.name, 'Petty cash');
  });
  it('non-assets drop cash/bank; income has no opening; bad parents dropped', () => {
    const r = accHeadInput({ ...form, type: 'income', parent_id: 1 }, null, heads);
    assert.ok(r.ok);
    assert.equal(r.input.is_cash_bank, false);
    assert.equal(r.input.account_no, null);
    assert.equal(r.input.parent_id, null);
    assert.equal('opening_balance' in r.input, false);
    assert.equal(r.input.opening_date, null);
  });
  it('negative = other side; blank on edit clears to 0; more decimals rejected', () => {
    const neg = accHeadInput(
      { ...form, type: 'liability', parent_id: null, opening_balance: '-25.5' },
      null,
      heads,
    );
    assert.ok(neg.ok && neg.input.opening_balance === -2550);
    const edit = heads[0]!;
    const cleared = accHeadInput(
      { ...form, opening_balance: '' },
      { ...edit, opening_balance: P(500) },
      heads,
    );
    assert.ok(cleared.ok && cleared.input.opening_balance === 0);
    assert.ok(cleared.ok && openingChanged({ ...edit, opening_balance: P(500) }, cleared.input));
    const fresh = accHeadInput({ ...form, opening_balance: '' }, null, heads);
    assert.ok(fresh.ok && !('opening_balance' in fresh.input));
    const bad = accHeadInput({ ...form, opening_balance: '1.005' }, null, heads);
    assert.ok(!bad.ok && bad.field === 'opening_balance');
    const noName = accHeadInput({ ...form, name: ' ' }, null, heads);
    assert.ok(!noName.ok && noName.field === 'name');
  });
  it('the opening equity head never takes an opening balance', () => {
    const oe = head({ id: 9, name: 'Opening Balance Equity', type: 'equity' });
    const r = accHeadInput({ ...form, name: oe.name, type: 'equity', parent_id: null }, oe, [
      ...heads,
      oe,
    ]);
    assert.ok(r.ok && !('opening_balance' in r.input));
  });
});

const base: VoucherState = {
  type: 'receipt',
  date: '2026-10-19',
  narration: ' Donation ',
  reference: '',
  useGrid: false,
  cashId: 1,
  rows: [
    { head_id: 3, amount: '0.1', cost_center_id: null },
    { head_id: 4, amount: '0.2', cost_center_id: 2 },
  ],
  transfer: { from: null, to: null, amount: '' },
  grid: [blankGrid(), blankGrid()],
};

describe('voucher lines', () => {
  it('income: cash debit = sum of credits, exactly', async () => {
    const b = buildVoucher(base);
    assert.equal(b.issue, null);
    assert.equal(b.debit, 30);
    assert.equal(b.credit, 30);
    const body = voucherBody(b.input);
    assert.deepEqual(body, {
      type: 'receipt',
      date: '2026-10-19',
      narration: 'Donation',
      reference: null,
      lines: [
        { head_id: 1, cost_center_id: null, debit: 0.3, credit: 0, note: null },
        { head_id: 3, cost_center_id: null, debit: 0, credit: 0.1, note: null },
        { head_id: 4, cost_center_id: 2, debit: 0, credit: 0.2, note: null },
      ],
    });
    const { voucherFormSchema } = await import('@school/shared-schemas');
    assert.equal(voucherFormSchema.safeParse(body).success, true);
  });

  it('expense flips the sides', () => {
    const b = buildVoucher({
      ...base,
      type: 'payment',
      rows: [{ head_id: 5, amount: '1,200.50', cost_center_id: null }],
    });
    assert.deepEqual(
      b.input.lines.map((l) => [l.head_id, l.debit, l.credit]),
      [
        [1, 0, 120050],
        [5, 120050, 0],
      ],
    );
  });

  it('transfer: to is debited, from is credited, must differ', () => {
    const t = buildVoucher({
      ...base,
      type: 'contra',
      transfer: { from: 1, to: 2, amount: '500' },
    });
    assert.deepEqual(
      t.input.lines.map((l) => [l.head_id, l.debit, l.credit]),
      [
        [2, 50000, 0],
        [1, 0, 50000],
      ],
    );
    assert.equal(t.issue, null);
    assert.equal(
      buildVoucher({ ...base, type: 'contra', transfer: { from: 1, to: 1, amount: '5' } }).issue,
      'From and to accounts must differ',
    );
  });

  it('journal grid: Dr = Cr compared in paisa', async () => {
    const grid = [
      { head_id: 6, debit: '0.1', credit: '', cost_center_id: null, note: 'Oct' },
      { head_id: 6, debit: '0.2', credit: '', cost_center_id: null, note: '' },
      { head_id: 7, debit: '', credit: '0.3', cost_center_id: null, note: '' },
    ];
    const b = buildVoucher({ ...base, type: 'journal', useGrid: true, grid });
    assert.equal(b.issue, null);
    assert.equal(b.difference, 0);
    const { voucherFormSchema } = await import('@school/shared-schemas');
    assert.equal(voucherFormSchema.safeParse(voucherBody(b.input)).success, true);
    const off = buildVoucher({
      ...base,
      type: 'journal',
      useGrid: true,
      grid: [...grid.slice(0, 2), { ...grid[2]!, credit: '0.31' }],
    });
    assert.equal(off.difference, 1);
    assert.match(off.issue!, /difference 0\.01/);
  });

  it('reports the first problem', () => {
    const issue = (s: Partial<VoucherState>) => buildVoucher({ ...base, ...s }).issue;
    assert.equal(
      issue({ rows: [{ head_id: 3, amount: '', cost_center_id: null }] }),
      'Enter an amount',
    );
    assert.equal(issue({ cashId: null }), 'Pick an account head');
    assert.match(
      issue({ rows: [{ head_id: 3, amount: '1.234', cost_center_id: null }] })!,
      /Row 1: Use at most 2 decimal/,
    );
    assert.equal(issue({ date: '' }), 'Date is required');
    assert.equal(
      issue({
        useGrid: true,
        type: 'journal',
        grid: [
          { head_id: 1, debit: '5', credit: '5', cost_center_id: null, note: '' },
          { head_id: 2, debit: '', credit: '', cost_center_id: null, note: '' },
        ],
      }),
      'Each line needs either a debit or a credit amount',
    );
  });

  it('confirm text', () => {
    const b = buildVoucher(base);
    assert.equal(
      voucherConfirmMessage(b, 'Income', null),
      'Post a new income voucher dated 2026-10-19 for ৳0.30 (3 lines, Dr = Cr)?',
    );
    assert.match(voucherConfirmMessage(b, 'Income', 'RV-8'), /^Save changes to RV-8/);
  });
});

const voucher = (over: Partial<Voucher>): Voucher => ({
  id: 8,
  voucher_no: 'RV-8',
  type: 'receipt',
  date: '2026-10-19',
  narration: null,
  reference: null,
  total: P(30),
  fee_receipt_no: null,
  is_opening: false,
  is_closing: false,
  lines: [
    {
      id: 1,
      head_id: 1,
      head: null,
      cost_center_id: null,
      cost_center: null,
      debit: P(30),
      credit: P(0),
      note: null,
    },
    {
      id: 2,
      head_id: 3,
      head: null,
      cost_center_id: 2,
      cost_center: null,
      debit: P(0),
      credit: P(10),
      note: null,
    },
    {
      id: 3,
      head_id: 4,
      head: null,
      cost_center_id: null,
      cost_center: null,
      debit: P(0),
      credit: P(20),
      note: null,
    },
  ],
  ...over,
});

describe('toSimple and locks', () => {
  it('reopens an income voucher as the simple form', () => {
    const s = toSimple(voucher({}), heads);
    assert.deepEqual(s, {
      cashId: 1,
      rows: [
        { head_id: 3, amount: '0.10', cost_center_id: 2 },
        { head_id: 4, amount: '0.20', cost_center_id: null },
      ],
      transfer: { from: null, to: null, amount: '' },
    });
    // and it rebuilds the same lines
    const b = buildVoucher({ ...base, narration: '', cashId: s!.cashId, rows: s!.rows });
    assert.deepEqual(
      b.input.lines.map((l) => [l.head_id, l.debit, l.credit]),
      voucher({}).lines.map((l) => [l.head_id, l.debit, l.credit]),
    );
  });
  it('falls back to the grid for journals, notes or odd shapes', () => {
    assert.equal(toSimple(voucher({ type: 'journal' }), heads), null);
    const lines = voucher({}).lines;
    assert.equal(
      toSimple(voucher({ lines: lines.map((l, i) => (i === 1 ? { ...l, note: 'x' } : l)) }), heads),
      null,
    );
    assert.equal(
      toSimple(
        voucher({ lines: lines.map((l, i) => (i === 0 ? { ...l, head_id: 5 } : l)) }),
        heads,
      ),
      null,
    );
    const transfer = voucher({
      type: 'contra',
      lines: [lines[0]!, { ...lines[1]!, head_id: 2, cost_center_id: null, credit: P(30) }],
    });
    assert.deepEqual(toSimple(transfer, heads)?.transfer, { from: 2, to: 1, amount: '0.30' });
    assert.deepEqual(gridFromVoucher(voucher({}))[0], {
      head_id: 1,
      debit: '0.30',
      credit: '',
      cost_center_id: null,
      note: '',
    });
  });
  it('locks', () => {
    const closed = new Set([2025]);
    assert.equal(voucherLock(voucher({}), closed), null);
    assert.equal(voucherLock(voucher({ fee_receipt_no: 4 }), closed), 'Fee receipt #4');
    assert.equal(voucherLock(voucher({ is_opening: true }), closed), 'Opening balances');
    assert.equal(voucherLock(voucher({ is_closing: true }), closed), 'Year-end closing');
    assert.equal(voucherLock(voucher({ date: '2025-12-31' }), closed), 'Year closed');
  });
});

describe('report math in paisa', () => {
  it('trial balance short rollup nets each top head to one side', () => {
    const rows = [
      {
        head_id: 3,
        code: null,
        name: 'Fees',
        type: 'income' as const,
        parent_id: null,
        debit: P(0),
        credit: toPaisa(0.1),
      },
      {
        head_id: 4,
        code: null,
        name: 'Tuition Fees',
        type: 'income' as const,
        parent_id: 3,
        debit: P(0),
        credit: toPaisa(0.2),
      },
      {
        head_id: 1,
        code: 'A1',
        name: 'Cash',
        type: 'asset' as const,
        parent_id: null,
        debit: toPaisa(0.5),
        credit: P(0),
      },
      {
        head_id: 6,
        code: null,
        name: 'Teacher salary',
        type: 'expense' as const,
        parent_id: 5,
        debit: toPaisa(0.1),
        credit: P(0),
      },
      {
        head_id: 5,
        code: null,
        name: 'Salary',
        type: 'expense' as const,
        parent_id: null,
        debit: P(0),
        credit: toPaisa(0.3),
      },
    ];
    const full = trialBalanceView(rows, heads, false, { debit: P(60), credit: P(60) });
    assert.deepEqual(
      full.rows.map((r) => r.depth),
      [0, 1, 0, 1, 0],
    );
    assert.equal(full.difference, 0);
    assert.equal(full.hasCodes, true);
    const short = trialBalanceView(rows, heads, true, { debit: P(60), credit: P(60) });
    assert.deepEqual(
      short.rows.map((r) => [r.head_id, r.debit, r.credit]),
      [
        [3, 0, 30],
        [1, 50, 0],
        [5, 0, 20],
      ],
    );
    assert.equal(short.debit, 50);
    assert.equal(short.credit, 50);
    const off = trialBalanceView(rows, heads, false, { debit: P(60), credit: P(59) });
    assert.equal(off.difference, 1);
  });

  it('amount groups and subtotals', () => {
    const g = amountGroups(
      [
        { head_id: 4, name: 'Tuition Fees', parent_id: 3, amount: toPaisa(0.1) },
        { head_id: 8, name: 'Exam Fees', parent_id: 3, amount: toPaisa(0.2) },
        { head_id: 9, name: 'Donation', parent_id: null, amount: toPaisa(5) },
        { head_id: 10, name: 'Orphan', parent_id: 999, amount: toPaisa(1) },
      ],
      byId,
    );
    assert.deepEqual(
      g.map((x) => [x.parent?.name ?? null, x.subtotal, x.rows.length]),
      [
        ['Fees', 30, 2],
        [null, 600, 2],
      ],
    );
  });

  it('balance sheet totals and the balanced check', () => {
    const d = {
      assets: [{ head_id: 1, name: 'Cash', parent_id: null, amount: toPaisa(100.3) }],
      liabilities: [
        { head_id: 7, name: 'Loan', parent_id: null, amount: toPaisa(0.1) },
        { head_id: 11, name: 'Payable', parent_id: null, amount: toPaisa(0.2) },
      ],
      equity: [{ head_id: 12, name: 'Capital', parent_id: null, amount: toPaisa(90) }],
      surplus: toPaisa(10),
      total_assets: toPaisa(100.3),
      total_liabilities_equity: toPaisa(100.3),
    };
    assert.deepEqual(balanceSheetView(d), {
      liabilities: 30,
      equity: 10000,
      difference: 0,
      balanced: true,
    });
    assert.equal(balanceSheetView({ ...d, total_assets: toPaisa(100.31) }).balanced, false);
  });

  it('cost center totals', () => {
    assert.deepEqual(
      costCenterTotals([
        {
          cost_center_id: 1,
          cost_center_name: 'A',
          income: toPaisa(0.1),
          expense: toPaisa(0.2),
          net: toPaisa(-0.1),
        },
        {
          cost_center_id: 2,
          cost_center_name: 'B',
          income: toPaisa(0.2),
          expense: toPaisa(0),
          net: toPaisa(0.2),
        },
      ]),
      { income: 30, expense: 20, net: 10 },
    );
  });

  it('years and labels', () => {
    assert.equal(surplusLabel(P(-1050)), '10.50 deficit');
    assert.equal(surplusLabel(P(0)), '0.00 surplus');
    assert.match(
      closeYearMessage({ year: 2025, net: P(-123456) }),
      /deficit of 1,234\.56 moves into Retained Earnings and 2026/,
    );
    assert.equal(pickedYear('2025-01-01', '2025-12-31', [2026, 2025]), 2025);
    assert.equal(pickedYear(undefined, '2025-12-31', [2026, 2025]), 2025);
    assert.equal(pickedYear('2025-01-02', '2025-12-31', [2026, 2025]), null);
  });
});
