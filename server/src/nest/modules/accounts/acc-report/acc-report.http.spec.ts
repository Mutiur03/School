import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../../app.js';
import { env } from '../../../../config/env.js';
import { prisma } from '../../../../config/prisma.js';
import { redis } from '../../../../config/redis.js';
import { runWithRlsContext } from '../../../../config/rlsContextStore.js';
import { nestApp } from '../../../common/nest-app.js';
import { MARKSHEET_QUEUE } from '../../marksheets/jobs/marksheet.queue.js';
import type { MarksheetQueue } from '../../marksheets/jobs/marksheet.queue.js';
import { attendanceSheetQueue } from '../../../../modules/attendence/attendence-sheet.queue.js';

const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);

// HTTP contract for /api/acc-reports (read-only). Needs the accounts migration applied.
let server: Server;
let base = '';
let host = '';
let token = '';
let schoolId = 0;
const createdHeadIds: number[] = [];
const createdVoucherIds: number[] = [];

beforeAll(async () => {
  const app = await createApp();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;

  const admin = await runWithRlsContext(
    { isSuperAdmin: true },
    async () =>
      await prisma.admin.findFirst({ where: { role: 'admin' }, include: { school: true } }),
  );
  if (!admin?.school?.subdomain) throw new Error('need a seeded admin with a school subdomain');
  host = `${admin.school.subdomain}.localhost`;
  schoolId = admin.school.id;
  token = jwt.sign({ id: admin.id, role: 'admin' }, env.JWT_SECRET);
});

afterAll(async () => {
  // Runs even if a test failed midway, so the dev DB keeps no test rows. Vouchers cascade to lines.
  await runWithRlsContext({ isSuperAdmin: true }, async () => {
    if (createdVoucherIds.length) {
      await prisma.acc_vouchers.deleteMany({ where: { id: { in: createdVoucherIds } } });
    }
    if (createdHeadIds.length) {
      await prisma.acc_heads.deleteMany({ where: { id: { in: createdHeadIds } } });
    }
  });
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue().close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
  redis.disconnect();
});

const call = async (path: string, opts: { auth?: boolean } = { auth: true }) => {
  const res = await fetch(base + path, {
    headers: {
      'x-tenant-host': host,
      ...(opts.auth ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  return { status: res.status, body: (await res.json()) as any };
};

test.each([
  '/api/acc-reports/ledger?head_id=1',
  '/api/acc-reports/trial-balance',
  '/api/acc-reports/income-expense',
  '/api/acc-reports/balance-sheet',
  '/api/acc-reports/cost-center',
])('GET %s without token → 401', async (path) => {
  const { status, body } = await call(path, { auth: false });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test.each([
  [
    'bad date',
    '/api/acc-reports/trial-balance?from=nope',
    'from must be a valid ISO 8601 date string',
  ],
  [
    'unknown field',
    '/api/acc-reports/trial-balance?school_id=2',
    'property school_id should not exist',
  ],
  [
    'from after to',
    '/api/acc-reports/income-expense?from=2026-05-01&to=2026-01-01',
    'From date cannot be after to date',
  ],
  ['missing head_id', '/api/acc-reports/ledger', 'head_id must be an integer number'],
  ['bad head_id', '/api/acc-reports/ledger?head_id=abc', 'head_id must be an integer number'],
])('%s → 400', async (_name, path, message) => {
  const { status, body } = await call(path);
  expect(status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.message).toContain(message);
});

test('ledger for unknown head → 404', async () => {
  const { status, body } = await call('/api/acc-reports/ledger?head_id=999999999');
  expect(status).toBe(404);
  expect(body.success).toBe(false);
});

test('balanced fixture → ledger, trial balance, P&L, balance sheet', async () => {
  const tag = `test-acc-${Date.now()}`;
  // Far-future dates keep these rows apart from real data in range-limited reports.
  const from = '2099-01-01';
  const to = '2099-12-31';

  const [cash, capital, tuition, salary] = await runWithRlsContext(
    { isSuperAdmin: true },
    async () =>
      await Promise.all(
        (
          [
            ['Cash', 'asset'],
            ['Capital', 'equity'],
            ['Tuition', 'income'],
            ['Salary', 'expense'],
          ] as const
        ).map(([name, type]) =>
          prisma.acc_heads.create({ data: { school_id: schoolId, name: `${tag}-${name}`, type } }),
        ),
      ),
  );
  createdHeadIds.push(cash.id, capital.id, tuition.id, salary.id);

  const voucher = async (
    type: 'journal' | 'receipt' | 'payment',
    date: string,
    lines: [number, number, number][],
  ) => {
    const v = await runWithRlsContext(
      { isSuperAdmin: true },
      async () =>
        await prisma.acc_vouchers.create({
          data: {
            school_id: schoolId,
            type,
            date: new Date(date),
            lines: {
              create: lines.map(([head_id, debit, credit]) => ({
                school_id: schoolId,
                head_id,
                debit,
                credit,
              })),
            },
          },
        }),
    );
    createdVoucherIds.push(v.id);
    return v;
  };
  await voucher('journal', '2098-12-31', [
    [cash.id, 1000, 0],
    [capital.id, 0, 1000],
  ]);
  const rv = await voucher('receipt', '2099-02-01', [
    [cash.id, 500, 0],
    [tuition.id, 0, 500],
  ]);
  await voucher('payment', '2099-03-01', [
    [salary.id, 200, 0],
    [cash.id, 0, 200],
  ]);

  const ledger = await call(`/api/acc-reports/ledger?head_id=${cash.id}&from=${from}&to=${to}`);
  expect(ledger.status).toBe(200);
  expect(ledger.body.data).toMatchObject({
    head: { id: cash.id, type: 'asset' },
    opening: 1000,
    closing: 1300,
  });
  expect(ledger.body.data.rows[0]).toMatchObject({
    voucher_no: `RV-${rv.id}`,
    date: '2099-02-01',
    debit: 500,
    balance: 1500,
  });

  const tb = await call(`/api/acc-reports/trial-balance?from=${from}&to=${to}`);
  expect(tb.status).toBe(200);
  expect(tb.body.data.total_debit).toBe(tb.body.data.total_credit);

  const pl = await call(`/api/acc-reports/income-expense?from=${from}&to=${to}`);
  expect(pl.body.data.income).toContainEqual(
    expect.objectContaining({ head_id: tuition.id, amount: 500 }),
  );
  expect(pl.body.data.expense).toContainEqual(
    expect.objectContaining({ head_id: salary.id, amount: 200 }),
  );

  const bs = await call(`/api/acc-reports/balance-sheet?to=${to}`);
  expect(bs.status).toBe(200);
  expect(bs.body.data.assets).toContainEqual(
    expect.objectContaining({ head_id: cash.id, amount: 1300 }),
  );
  // Holds for the whole school as long as every voucher in the DB is balanced.
  expect(bs.body.data.total_assets).toBe(bs.body.data.total_liabilities_equity);

  const cc = await call(`/api/acc-reports/cost-center?from=${from}&to=${to}`);
  expect(cc.status).toBe(200);
  expect(Array.isArray(cc.body.data.rows)).toBe(true);
});
