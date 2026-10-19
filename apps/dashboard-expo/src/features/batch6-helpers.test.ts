/**
 * Batch 6 helpers: multi-select model, CSV export (quoting, formula injection, exact money, BOM,
 * file names), the account-report sheets, the quick-add head form, the in-app leave guard and the
 * sms-logs list parameter.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchesAny, multiLabel, toggleValue } from '@/components/ui/multi-select-model';
import { csvBytes, csvCell, csvFileName, csvMoney, toCsv } from '@/lib/files/csv';
import type { AccHead } from '@/lib/api/accounts';
import { fromPaisaInt } from '@/lib/money/money';
import { createLeaveGuardStore } from '@/navigation/leave-guard-model';
import { quickHeadClash, quickHeadDefaults, quickHeadInput } from '@/features/accounts/model';
import {
  balanceSheetSheet,
  costCenterSheet,
  incomeExpenseSheet,
  ledgerSheet,
  trialBalanceSheet,
} from '@/features/accounts/report-export';
import { listParam } from '@/features/sms/model';

const P = fromPaisaInt;
const opts = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('multi-select model', () => {
  it('toggles values and keeps the options order', () => {
    assert.deepEqual(toggleValue([], 'c', opts), ['c']);
    assert.deepEqual(toggleValue(['c'], 'a', opts), ['a', 'c']);
    assert.deepEqual(toggleValue(['a', 'c'], 'a', opts), ['c']);
  });
  it('labels: all, one, N selected; unknown values ignored', () => {
    assert.equal(multiLabel([], opts, 'All'), 'All');
    assert.equal(multiLabel(['b'], opts, 'All'), 'Beta');
    assert.equal(multiLabel(['a', 'b'], opts, 'All'), '2 selected');
    assert.equal(multiLabel(['zzz'], opts, 'All'), 'All');
  });
  it('empty selection matches everything', () => {
    assert.equal(matchesAny([], 'x'), true);
    assert.equal(matchesAny(['a'], 'a'), true);
    assert.equal(matchesAny(['a'], 'b'), false);
  });
  it('sms list param: comma list or all', () => {
    assert.equal(listParam([]), 'all');
    assert.equal(listParam(['attendance', 'bulk']), 'attendance,bulk');
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    assert.equal(csvCell('plain'), 'plain');
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('two\nlines'), '"two\nlines"');
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(undefined), '');
    assert.equal(csvCell(12), '12');
    assert.equal(csvCell(Number.NaN), '');
  });
  it('neutralises formula injection in text cells', () => {
    for (const bad of ['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tx', '\rx']) {
      assert.ok(csvCell(bad).replace(/^"/, '').startsWith("'"), bad);
    }
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  });
  it('money is exact two-decimal taka from paisa and negatives stay numbers', () => {
    assert.equal(csvCell(csvMoney(P(0))), '0.00');
    assert.equal(csvCell(csvMoney(P(5))), '0.05');
    assert.equal(csvCell(csvMoney(P(150075))), '1500.75');
    assert.equal(csvCell(csvMoney(P(-25))), '-0.25');
    assert.equal(csvCell(csvMoney(P(-123456789))), '-1234567.89');
  });
  it('CRLF rows, BOM bytes and safe file names', () => {
    assert.equal(toCsv(['A', 'B'], [[1, 'x,y']]), 'A,B\r\n1,"x,y"\r\n');
    const bytes = new Uint8Array(csvBytes('ক'));
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(new TextDecoder().decode(bytes.slice(3)), 'ক');
    assert.equal(
      csvFileName(['Ledger', 'Cash / Bank', '2026-01-01', null, '', 'to']),
      'Ledger_Cash-Bank_2026-01-01_to.csv',
    );
    assert.equal(csvFileName(['../../etc', 'x']), '..-..-etc_x.csv');
  });
});

describe('account report sheets', () => {
  it('ledger: opening, rows with blank zero sides, closing', () => {
    const s = ledgerSheet(
      {
        head: { id: 1, name: 'Cash', type: 'asset' },
        opening: P(100000),
        rows: [
          {
            voucher_id: 1,
            voucher_no: 'RV-1',
            date: '2026-02-01',
            type: 'receipt',
            narration: 'Fees',
            note: 'Feb',
            debit: P(5050),
            credit: P(0),
            balance: P(105050),
          },
        ] as never,
        closing: P(105050),
      },
      '2026-01-01',
      '2026-12-31',
    );
    assert.equal(s.fileName, 'Ledger_Cash_2026-01-01_to_2026-12-31.csv');
    assert.deepEqual(s.headers, ['Date', 'Voucher', 'Particulars', 'Debit', 'Credit', 'Balance']);
    const csv = toCsv(s.headers, s.rows).split('\r\n');
    assert.equal(csv[1], '2026-01-01,,Opening balance,,,"1,000.00 Dr"');
    assert.equal(csv[2], '2026-02-01,RV-1,Fees — Feb,50.50,,"1,050.50 Dr"');
    assert.equal(csv[3], '2026-12-31,,Closing balance,,,"1,050.50 Dr"');
  });
  it('trial balance: code column only when used, totals row', () => {
    const rows = [
      {
        head_id: 1,
        code: null,
        name: 'Cash',
        type: 'asset' as const,
        parent_id: null,
        debit: P(1000),
        credit: P(0),
      },
    ];
    const plain = trialBalanceSheet(
      { rows: rows as never, debit: P(1000), credit: P(1000), hasCodes: false },
      'a',
      'b',
    );
    assert.deepEqual(plain.headers, ['Head', 'Type', 'Debit', 'Credit']);
    assert.equal(toCsv([], plain.rows).split('\r\n')[2], 'Total,,10.00,10.00');
    const coded = trialBalanceSheet(
      { rows: rows as never, debit: P(1000), credit: P(1000), hasCodes: true },
      'a',
      'b',
    );
    assert.equal(coded.headers[0], 'Code');
    assert.equal(coded.rows[0]!.length, 5);
  });
  it('income vs expense, balance sheet and cost centers', () => {
    const ie = incomeExpenseSheet(
      {
        income: [{ head_id: 1, name: 'Fees', amount: P(200000) }],
        expense: [{ head_id: 2, name: 'Salary', amount: P(250000) }],
        total_income: P(200000),
        total_expense: P(250000),
        net: P(-50000),
      } as never,
      'a',
      'b',
    );
    assert.deepEqual(toCsv([], ie.rows).split('\r\n').slice(-2, -1), [',Deficit,-500.00']);
    const bs = balanceSheetSheet(
      {
        assets: [{ head_id: 1, name: 'Cash', amount: P(100) }],
        liabilities: [],
        equity: [],
        surplus: P(100),
        total_assets: P(100),
        total_liabilities_equity: P(100),
      } as never,
      '2026-12-31',
    );
    assert.equal(bs.fileName, 'Balance-Sheet_as-of_2026-12-31.csv');
    assert.equal(bs.rows.length, 4);
    const cc = costCenterSheet(
      [
        {
          cost_center_id: 1,
          cost_center_name: 'Lab',
          income: P(300),
          expense: P(100),
          net: P(200),
        },
        { cost_center_id: 2, cost_center_name: 'Bus', income: P(0), expense: P(50), net: P(-50) },
      ] as never,
      'a',
      'b',
    );
    assert.equal(toCsv([], cc.rows).split('\r\n')[3], 'Total,3.00,1.50,1.50');
  });
});

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

describe('quick-add head', () => {
  const heads = [head({ id: 1, name: 'Cash', is_cash_bank: true, opening_date: '2025-07-01' })];
  it('defaults follow the preset and reuse the school opening date', () => {
    const d = quickHeadDefaults({ type: 'asset', cashBank: true }, heads);
    assert.equal(d.type, 'asset');
    assert.equal(d.cashBank, true);
    assert.equal(d.openingDate, '2025-07-01');
    const e = quickHeadDefaults({}, [], new Date('2026-05-10T00:00:00'));
    assert.equal(e.type, 'expense');
    assert.equal(e.openingDate, '2026-01-01');
  });
  it('rejects a case-insensitive name clash before the server', () => {
    assert.equal(quickHeadClash(heads, ' cash ')?.id, 1);
    const r = quickHeadInput({ ...quickHeadDefaults({}, heads), name: 'CASH' }, heads);
    assert.equal(r.ok, false);
  });
  it('creates a top-level active head; cash/bank only for assets; exact opening', () => {
    const asset = quickHeadInput(
      {
        ...quickHeadDefaults({ type: 'asset', cashBank: true }, heads),
        name: ' Petty cash ',
        opening: '-12.50',
      },
      heads,
    );
    assert.ok(asset.ok);
    assert.equal(asset.input.name, 'Petty cash');
    assert.equal(asset.input.parent_id, null);
    assert.equal(asset.input.code, null);
    assert.equal(asset.input.is_active, true);
    assert.equal(asset.input.is_cash_bank, true);
    assert.equal(asset.input.opening_balance, -1250);
    const exp = quickHeadInput(
      { ...quickHeadDefaults({}, heads), name: 'Rent', cashBank: true },
      heads,
    );
    assert.ok(exp.ok);
    assert.equal(exp.input.is_cash_bank, false);
  });
});

describe('leave guard', () => {
  it('navigates at once without a guard, asks with one, proceed clears it', () => {
    const store = createLeaveGuardStore();
    let went = 0;
    store.attempt(
      () => went++,
      () => assert.fail('should not ask'),
    );
    assert.equal(went, 1);
    const remove = store.set({ title: 'Leave?', message: 'Unsaved' });
    let proceed: (() => void) | null = null;
    store.attempt(
      () => went++,
      (g, p) => {
        assert.equal(g.title, 'Leave?');
        proceed = p;
      },
    );
    assert.equal(went, 1);
    (proceed as unknown as () => void)();
    assert.equal(went, 2);
    assert.equal(store.current(), null);
    remove();
  });
  it('a stale remover does not clear a newer guard', () => {
    const store = createLeaveGuardStore();
    const removeOld = store.set({ title: 'a', message: '' });
    store.set({ title: 'b', message: '' });
    removeOld();
    assert.equal(store.current()?.title, 'b');
  });
});
