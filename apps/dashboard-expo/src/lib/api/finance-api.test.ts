/**
 * Fees and accounts clients: exact paths, methods and bodies (verified against
 * server/src/nest/modules/{fees,accounts}), money parsed into paisa and sent back as two-decimal
 * taka, receipts sending only the installments (the server prices them), and no school id ever.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { createAccountsApi } from './accounts';
import { createFeesApi } from './fees';
import { fromPaisaInt } from '../money/money';

type Call = { url: string; method: string; body: unknown };

const nest = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function harness(respond: (c: Call) => Response = () => nest(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://s.test',
    fetch: fetchImpl,
    auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
  });
  return { calls, client };
}

const path = (c: Call) => new URL(c.url).pathname;
const query = (c: Call) => Object.fromEntries(new URL(c.url).searchParams);
const P = fromPaisaInt;
function noSchoolId(calls: Call[]) {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      assert.equal('school_id' in v, false);
      Object.values(v).forEach(walk);
    }
  };
  for (const c of calls) {
    assert.equal(new URL(c.url).searchParams.has('school_id'), false);
    walk(c.body);
  }
}

const dueRows = [
  {
    fee_head_id: 1,
    fee_head: 'Tuition',
    month: 1,
    charge: 500.1,
    waiver: 0.1,
    payable: 500,
    status: 'paid',
    receipt_no: 4,
    paid_amount: 500,
    deposit: null,
  },
  {
    fee_head_id: 1,
    fee_head: 'Tuition',
    month: 2,
    charge: 500.1,
    waiver: 0.1,
    payable: 500,
    status: 'due',
    receipt_no: null,
    paid_amount: 0,
    deposit: null,
  },
  {
    fee_head_id: 2,
    fee_head: 'Admission',
    month: 0,
    charge: 0.29,
    waiver: 0,
    payable: 0.29,
    status: 'due',
    receipt_no: null,
    paid_amount: 0,
    deposit: { id: 9, name: 'Sonali Bank' },
  },
];

describe('fees api', () => {
  it('statement: amounts in paisa', async () => {
    const h = harness(() =>
      nest({
        student: { id: 7, name: 'Rahim', login_id: 260601, father_name: null },
        enrollment: { year: 2026, class: 6, section: 'A', roll: 3 },
        rows: dueRows,
        totals: { waiver: 0.2, paid: 500, due: 500.29 },
      }),
    );
    const s = await createFeesApi(h.client).statement(7, 2026);
    assert.equal(path(h.calls[0]!), '/api/fee-receipts/statement');
    assert.deepEqual(query(h.calls[0]!), { student_id: '7', year: '2026' });
    assert.equal(s.student.login_id, '260601');
    assert.deepEqual(
      s.rows.map((r) => [r.charge, r.waiver, r.payable, r.status]),
      [
        [50010, 10, 50000, 'paid'],
        [50010, 10, 50000, 'due'],
        [29, 0, 29, 'due'],
      ],
    );
    assert.deepEqual(s.totals, { waiver: 20, paid: 50000, due: 50029 });
    assert.equal(s.rows[2]!.deposit?.name, 'Sonali Bank');
  });

  it('collect: only items, no amounts, pay_head_id only when given', async () => {
    const h = harness(() => nest({ id: 55, receipt_no: 12, total: 500.29 }, 201));
    const api = createFeesApi(h.client);
    const r = await api.collect({
      student_id: 7,
      year: 2026,
      date: '2026-10-19',
      pay_head_id: 3,
      note: '  paid by father ',
      items: [
        { fee_head_id: 1, month: 2 },
        { fee_head_id: 2, month: 0 },
      ],
    });
    assert.deepEqual(r, { id: 55, receipt_no: 12 });
    const c = h.calls[0]!;
    assert.equal(c.method, 'POST');
    assert.equal(path(c), '/api/fee-receipts');
    assert.deepEqual(c.body, {
      student_id: 7,
      year: 2026,
      date: '2026-10-19',
      pay_head_id: 3,
      note: 'paid by father',
      items: [
        { fee_head_id: 1, month: 2 },
        { fee_head_id: 2, month: 0 },
      ],
    });
    await api.collect({ student_id: 7, year: 2026, date: '2026-10-19', items: [] });
    assert.deepEqual(Object.keys(h.calls[1]!.body as object).sort(), [
      'date',
      'items',
      'student_id',
      'year',
    ]);
    noSchoolId(h.calls);
  });

  it('collect: a response without an id is an error, not a silent success', async () => {
    const h = harness(() => nest({}));
    await assert.rejects(
      createFeesApi(h.client).collect({ student_id: 1, year: 2026, date: '2026-01-01', items: [] }),
    );
  });

  it('structure: PUT replaces the class with two-decimal amounts; POST copies', async () => {
    const h = harness((c) => (c.method === 'POST' ? nest({ copied: 3 }) : nest([])));
    const api = createFeesApi(h.client);
    await api.saveStructure({
      year: 2026,
      cls: 8,
      items: [
        { fee_head_id: 1, amount: P(120050) },
        { fee_head_id: 2, amount: P(30) },
      ],
    });
    assert.equal(h.calls[0]!.method, 'PUT');
    assert.equal(path(h.calls[0]!), '/api/fee-structures');
    assert.deepEqual(h.calls[0]!.body, {
      year: 2026,
      class: 8,
      items: [
        { fee_head_id: 1, amount: 1200.5 },
        { fee_head_id: 2, amount: 0.3 },
      ],
    });
    assert.deepEqual(await api.copyStructure(2025, 2026), { copied: 3 });
    assert.deepEqual(h.calls[1]!.body, { from_year: 2025, to_year: 2026 });
    await api.structures(2026, 8);
    assert.deepEqual(query(h.calls[2]!), { year: '2026', class: '8' });
    noSchoolId(h.calls);
  });

  it('structure rows parse Decimal strings', async () => {
    const h = harness(() =>
      nest([
        {
          id: 1,
          year: 2026,
          class: 8,
          fee_head_id: 1,
          amount: '1200.50',
          fee_head: { id: 1, name: 'T', frequency: 'monthly' },
        },
      ]),
    );
    const [row] = await createFeesApi(h.client).structures(2026, 8);
    assert.equal(row!.amount, 120050);
  });

  it('waivers: create, patch without student, delete', async () => {
    const h = harness();
    const api = createFeesApi(h.client);
    const input = {
      student_id: 7,
      year: 2026,
      fee_head_id: 1,
      percent: true,
      value: P(1250),
      note: ' sibling ',
    };
    await api.createWaiver(input);
    assert.deepEqual(h.calls[0]!.body, {
      student_id: 7,
      year: 2026,
      fee_head_id: 1,
      percent: true,
      value: 12.5,
      note: 'sibling',
    });
    await api.updateWaiver(4, { ...input, fee_head_id: undefined, percent: false, value: P(5000) });
    assert.equal(h.calls[1]!.method, 'PATCH');
    assert.equal(path(h.calls[1]!), '/api/fee-waivers/4');
    assert.deepEqual(h.calls[1]!.body, {
      year: 2026,
      fee_head_id: null,
      percent: false,
      value: 50,
      note: 'sibling',
    });
    // Editing can clear the note (and the head) — both sent as null, never the student.
    await api.updateWaiver(4, { ...input, note: '  ' });
    assert.deepEqual(h.calls[2]!.body, {
      year: 2026,
      fee_head_id: 1,
      percent: true,
      value: 12.5,
      note: null,
    });
    await api.deleteWaiver(4);
    assert.equal(h.calls[3]!.method, 'DELETE');
    noSchoolId(h.calls);
  });

  it('fee heads: income head omitted for auto-create, deposit null = chosen at collection', async () => {
    const h = harness();
    const api = createFeesApi(h.client);
    const base = {
      name: ' Tuition ',
      frequency: 'monthly' as const,
      deposit_head_id: null,
      is_waivable: true,
      sort_order: 1,
      is_active: true,
    };
    await api.createHead(base);
    assert.deepEqual(h.calls[0]!.body, { ...base, name: 'Tuition' });
    await api.updateHead(3, { ...base, income_head_id: 12, deposit_head_id: 9 });
    assert.equal(path(h.calls[1]!), '/api/fee-heads/3');
    assert.deepEqual(h.calls[1]!.body, {
      ...base,
      name: 'Tuition',
      income_head_id: 12,
      deposit_head_id: 9,
    });
  });

  it('receipts: filters only when set; delete and PDF paths', async () => {
    const h = harness((c) =>
      path(c).endsWith('/pdf')
        ? new Response(new Uint8Array([37, 80, 68, 70]), {
            headers: { 'content-type': 'application/pdf' },
          })
        : nest([
            {
              id: 1,
              receipt_no: 4,
              date: '2026-10-19T00:00:00.000Z',
              year: 2026,
              class: 6,
              section: 'A',
              roll: 3,
              total: 500.29,
              student: { id: 7, name: 'R', login_id: 1 },
              accounts: [
                { id: 3, name: 'Cash', amount: 500 },
                { id: 9, name: 'Bank', amount: 0.29 },
              ],
              voucher_no: 'RV-8',
            },
          ]),
    );
    const api = createFeesApi(h.client);
    const [r] = await api.receipts({ from: '2026-10-01', to: '2026-10-19', class: undefined });
    assert.deepEqual(query(h.calls[0]!), { from: '2026-10-01', to: '2026-10-19' });
    assert.equal(r!.total, 50029);
    assert.equal(r!.date, '2026-10-19');
    assert.deepEqual(
      r!.accounts.map((a) => a.amount),
      [50000, 29],
    );
    await api.deleteReceipt(1);
    assert.equal(h.calls[1]!.method, 'DELETE');
    assert.equal(path(h.calls[1]!), '/api/fee-receipts/1');
    await api.receiptPdf(1);
    assert.equal(path(h.calls[2]!), '/api/fee-receipts/1/pdf');
  });

  it('reports: summary, collection, dues', async () => {
    const h = harness((c) =>
      path(c).endsWith('summary')
        ? nest({
            today: 0.1,
            month: 0.3,
            year: 1000.5,
            last_7_days: [{ date: '2026-10-19', total: 0.2 }],
            latest: [],
          })
        : path(c).endsWith('collection')
          ? nest({
              from: '2026-01-01',
              to: '2026-10-19',
              total: 0.3,
              count: 2,
              by_day: [{ date: '2026-10-19', count: 2, total: 0.3 }],
              by_class: [{ class: 6, count: 2, total: 0.3 }],
              by_account: [{ deposit_head_id: 3, name: 'Cash', total: 0.3 }],
              by_head: [{ fee_head_id: 1, name: 'T', count: 2, waiver: 0.1, total: 0.3 }],
            })
          : nest({
              rows: [
                {
                  student_id: 1,
                  name: 'A',
                  login_id: 5,
                  section: 'A',
                  roll: 1,
                  charge: 1,
                  waiver: 0.5,
                  paid: 0.25,
                  due: 0.25,
                },
              ],
              total_due: 0.25,
            }),
    );
    const api = createFeesApi(h.client);
    const s = await api.summary('2026-10-19');
    assert.deepEqual([s.today, s.month, s.year, s.last_7_days[0]!.total], [10, 30, 100050, 20]);
    const c = await api.collection('2026-01-01', '2026-10-19');
    assert.equal(c.total, 30);
    assert.equal(c.by_head[0]!.waiver, 10);
    const d = await api.dues({ year: 2026, class: 6, section: '', upto_month: 10 });
    assert.deepEqual(query(h.calls[2]!), { year: '2026', class: '6', upto_month: '10' });
    assert.equal(d.rows[0]!.due, 25);
    assert.equal(d.total_due, 25);
    await api.duesPdf({ year: 2026, class: 6, section: 'B' }).catch(() => {});
    assert.equal(path(h.calls[3]!), '/api/fee-reports/dues/pdf');
    assert.deepEqual(query(h.calls[3]!), { year: '2026', class: '6', section: 'B' });
    noSchoolId(h.calls);
  });
});

describe('accounts api', () => {
  it('heads: opening balance in paisa both ways', async () => {
    const h = harness((c) =>
      c.method === 'GET'
        ? nest([
            {
              id: 1,
              name: 'Cash',
              type: 'asset',
              code: null,
              parent_id: null,
              is_cash_bank: true,
              is_active: true,
              opening_balance: 1500.75,
              opening_date: '2026-01-01',
            },
          ])
        : nest({}),
    );
    const api = createAccountsApi(h.client);
    const [head] = await api.heads();
    assert.equal(head!.opening_balance, 150075);
    const input = {
      name: 'Cash ',
      code: null,
      type: 'asset' as const,
      parent_id: null,
      is_cash_bank: true,
      bank_name: null,
      account_no: null,
      is_active: true,
      opening_date: '2026-01-01',
    };
    await api.updateHead(1, { ...input, opening_balance: P(-25) });
    assert.equal(h.calls[1]!.method, 'PATCH');
    assert.deepEqual(h.calls[1]!.body, { ...input, name: 'Cash', opening_balance: -0.25 });
    await api.createHead(input);
    assert.equal('opening_balance' in (h.calls[2]!.body as object), false);
    noSchoolId(h.calls);
  });

  it('vouchers: lines in two-decimal taka; filters; locked flags parsed', async () => {
    const h = harness((c) =>
      c.method === 'GET'
        ? nest([
            {
              id: 8,
              voucher_no: 'RV-8',
              type: 'receipt',
              date: '2026-10-19T00:00:00.000Z',
              narration: null,
              reference: null,
              total: 0.3,
              fee_receipt_no: 4,
              is_opening: false,
              is_closing: false,
              lines: [
                {
                  id: 1,
                  head_id: 1,
                  head: { id: 1, name: 'Cash', type: 'asset' },
                  cost_center_id: null,
                  cost_center: null,
                  debit: '0.30',
                  credit: '0.00',
                  note: null,
                },
                {
                  id: 2,
                  head_id: 2,
                  head: { id: 2, name: 'Fees', type: 'income' },
                  cost_center_id: null,
                  cost_center: null,
                  debit: 0,
                  credit: 0.3,
                  note: null,
                },
              ],
            },
          ])
        : nest({ id: 9 }),
    );
    const api = createAccountsApi(h.client);
    const [v] = await api.vouchers({ type: 'receipt', from: '2026-01-01', to: undefined });
    assert.deepEqual(query(h.calls[0]!), { type: 'receipt', from: '2026-01-01' });
    assert.equal(v!.total, 30);
    assert.deepEqual(
      v!.lines.map((l) => [l.debit, l.credit]),
      [
        [30, 0],
        [0, 30],
      ],
    );
    assert.equal(v!.fee_receipt_no, 4);
    await api.createVoucher({
      type: 'payment',
      date: '2026-10-19',
      narration: null,
      reference: 'CHQ-1',
      lines: [
        { head_id: 5, cost_center_id: 2, debit: P(10), credit: P(0), note: null },
        { head_id: 6, cost_center_id: 2, debit: P(20), credit: P(0), note: null },
        { head_id: 1, cost_center_id: null, debit: P(0), credit: P(30), note: null },
      ],
    });
    const body = h.calls[1]!.body as { lines: { debit: number; credit: number }[] };
    assert.equal(h.calls[1]!.method, 'POST');
    assert.deepEqual(
      body.lines.map((l) => [l.debit, l.credit]),
      [
        [0.1, 0],
        [0.2, 0],
        [0, 0.3],
      ],
    );
    await api.updateVoucher(8, {
      type: 'journal',
      date: '2026-10-19',
      narration: 'x',
      reference: null,
      lines: [],
    });
    assert.equal(h.calls[2]!.method, 'PATCH');
    assert.equal(path(h.calls[2]!), '/api/vouchers/8');
    await api.deleteVoucher(8);
    assert.equal(h.calls[3]!.method, 'DELETE');
    noSchoolId(h.calls);
  });

  it('years: close is PUT, reopen is DELETE', async () => {
    const h = harness((c) =>
      c.method === 'GET'
        ? nest([
            {
              year: 2025,
              closed: false,
              closed_at: null,
              income: 1000.1,
              expense: 1000.2,
              net: -0.1,
              can_close: true,
              can_reopen: false,
            },
          ])
        : nest({}),
    );
    const api = createAccountsApi(h.client);
    const [y] = await api.years();
    assert.deepEqual([y!.income, y!.expense, y!.net], [100010, 100020, -10]);
    await api.closeYear(2025);
    await api.reopenYear(2025);
    assert.deepEqual(
      h.calls.slice(1).map((c) => [c.method, path(c)]),
      [
        ['PUT', '/api/acc-years/2025'],
        ['DELETE', '/api/acc-years/2025'],
      ],
    );
  });

  it('reports: paths, queries and paisa', async () => {
    const h = harness((c) => {
      const p = path(c);
      if (p.endsWith('ledger'))
        return nest({
          head: { id: 1, name: 'Cash', type: 'asset' },
          opening: 10.1,
          rows: [
            {
              voucher_id: 1,
              voucher_no: 'RV-1',
              date: '2026-02-01',
              type: 'receipt',
              narration: null,
              note: null,
              debit: 0.2,
              credit: 0,
              balance: 10.3,
            },
          ],
          closing: 10.3,
        });
      if (p.endsWith('trial-balance'))
        return nest({
          rows: [
            {
              head_id: 1,
              code: null,
              name: 'Cash',
              type: 'asset',
              parent_id: null,
              debit: 0.3,
              credit: 0,
            },
          ],
          total_debit: 0.3,
          total_credit: 0.3,
        });
      if (p.endsWith('income-expense'))
        return nest({
          income: [{ head_id: 2, name: 'Fees', parent_id: null, amount: 0.3 }],
          expense: [],
          total_income: 0.3,
          total_expense: 0,
          net: 0.3,
        });
      if (p.endsWith('balance-sheet'))
        return nest({
          assets: [],
          liabilities: [],
          equity: [],
          surplus: 0.3,
          total_assets: 0.3,
          total_liabilities_equity: 0.3,
        });
      return nest({
        rows: [
          { cost_center_id: 1, cost_center_name: 'Lab', income: 0.1, expense: 0.2, net: -0.1 },
        ],
      });
    });
    const api = createAccountsApi(h.client);
    const l = await api.ledger({ head_id: 1, from: '2026-01-01', to: '2026-12-31' });
    assert.deepEqual(
      [l.opening, l.rows[0]!.debit, l.rows[0]!.balance, l.closing],
      [1010, 20, 1030, 1030],
    );
    const tb = await api.trialBalance({ from: '2026-01-01', to: '2026-12-31' });
    assert.deepEqual([tb.total_debit, tb.total_credit], [30, 30]);
    const ie = await api.incomeExpense({ from: '2026-01-01' });
    assert.equal(ie.net, 30);
    const bs = await api.balanceSheet({ to: '2026-12-31' });
    assert.equal(bs.surplus, 30);
    const cc = await api.costCenterReport({});
    assert.equal(cc[0]!.net, -10);
    assert.deepEqual(
      h.calls.map((c) => [path(c), query(c)]),
      [
        ['/api/acc-reports/ledger', { head_id: '1', from: '2026-01-01', to: '2026-12-31' }],
        ['/api/acc-reports/trial-balance', { from: '2026-01-01', to: '2026-12-31' }],
        ['/api/acc-reports/income-expense', { from: '2026-01-01' }],
        ['/api/acc-reports/balance-sheet', { to: '2026-12-31' }],
        ['/api/acc-reports/cost-center', {}],
      ],
    );
    noSchoolId(h.calls);
  });

  it('cost centers CRUD', async () => {
    const h = harness();
    const api = createAccountsApi(h.client);
    await api.createCostCenter({ name: ' Lab ', code: null, is_active: true });
    await api.updateCostCenter(2, { name: 'Lab', code: 'L1', is_active: false });
    await api.deleteCostCenter(2);
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['POST', '/api/cost-centers'],
        ['PATCH', '/api/cost-centers/2'],
        ['DELETE', '/api/cost-centers/2'],
      ],
    );
    assert.deepEqual(h.calls[0]!.body, { name: 'Lab', code: null, is_active: true });
  });
});

describe('accounts: quick-add head', () => {
  it('createHead returns the new id (or null when the server omits it)', async () => {
    let reply: unknown = { id: 42, name: 'Rent' };
    const h = harness(() => nest(reply, 201));
    const api = createAccountsApi(h.client);
    const input = {
      name: 'Rent',
      code: null,
      type: 'expense' as const,
      parent_id: null,
      is_cash_bank: false,
      bank_name: null,
      account_no: null,
      is_active: true,
      opening_date: '2026-01-01',
    };
    assert.equal(await api.createHead(input), 42);
    assert.equal(h.calls[0]!.method, 'POST');
    assert.equal(path(h.calls[0]!), '/api/acc-heads');
    reply = null;
    assert.equal(await api.createHead(input), null);
    noSchoolId(h.calls);
  });
});
