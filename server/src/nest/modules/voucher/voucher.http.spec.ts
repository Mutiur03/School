import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../app.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { redis } from '../../../config/redis.js';
import { runWithRlsContext } from '../../../config/rlsContextStore.js';
import { nestApp } from '../../common/nest-app.js';
import { MARKSHEET_QUEUE } from '../marksheets/jobs/marksheet.queue.js';
import type { MarksheetQueue } from '../marksheets/jobs/marksheet.queue.js';
import { attendanceSheetQueue } from '../../../modules/attendence/attendence-sheet.queue.js';

const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);

// HTTP contract for /api/vouchers. Needs the accounts migration applied to the local DB.
let server: Server;
let base = '';
let host = '';
let token = '';
let schoolId = 0;
let cashId = 0;
let rentId = 0;
const createdIds: number[] = [];

const asSuperAdmin = <T>(fn: () => Promise<T>) => runWithRlsContext({ isSuperAdmin: true }, fn);

beforeAll(async () => {
  const app = await createApp();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;

  const admin = await asSuperAdmin(
    async () =>
      await prisma.admin.findFirst({ where: { role: 'admin' }, include: { school: true } }),
  );
  if (!admin?.school?.subdomain) throw new Error('need a seeded admin with a school subdomain');
  host = `${admin.school.subdomain}.localhost`;
  token = jwt.sign({ id: admin.id, role: 'admin' }, env.JWT_SECRET);
  schoolId = admin.school.id;

  const suffix = Date.now();
  [cashId, rentId] = await asSuperAdmin(async () => {
    const cash = await prisma.acc_heads.create({
      data: { school_id: schoolId, name: `test-cash-${suffix}`, type: 'asset', is_cash_bank: true },
    });
    const rent = await prisma.acc_heads.create({
      data: { school_id: schoolId, name: `test-rent-${suffix}`, type: 'expense' },
    });
    return [cash.id, rent.id];
  });
});

afterAll(async () => {
  // Runs even if a test failed midway, so the dev DB keeps no test rows.
  await asSuperAdmin(async () => {
    if (createdIds.length) {
      await prisma.acc_vouchers.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.acc_heads.deleteMany({ where: { id: { in: [cashId, rentId] } } });
  });
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue().close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
  redis.disconnect();
});

const call = async (
  method: string,
  path: string,
  opts: { auth?: boolean; body?: unknown } = {},
) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'x-tenant-host': host,
      'content-type': 'application/json',
      ...(opts.auth ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

const voucher = () => ({
  type: 'payment',
  date: '2030-01-15',
  narration: 'test rent',
  lines: [
    { head_id: rentId, debit: 1500.25 },
    { head_id: cashId, credit: 1500.25 },
  ],
});

test.each([
  ['GET', '/api/vouchers'],
  ['GET', '/api/vouchers/1'],
  ['POST', '/api/vouchers'],
  ['PATCH', '/api/vouchers/1'],
  ['DELETE', '/api/vouchers/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, method === 'GET' ? {} : { body: {} });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('POST /vouchers empty body → 400', async () => {
  const { status, body } = await call('POST', '/api/vouchers', { auth: true, body: {} });
  expect(status).toBe(400);
  expect(body.success).toBe(false);
});

// All rejected before any DB write, so they leave no rows behind.
test.each([
  ['extra field', () => ({ ...voucher(), school_id: 2 }), 'property school_id should not exist'],
  [
    'unbalanced',
    () => ({ ...voucher(), lines: [voucher().lines[0], { head_id: cashId, credit: 1 }] }),
    'Total debit must equal total credit',
  ],
  [
    'foreign head',
    () => ({
      ...voucher(),
      lines: [
        { head_id: 2147483647, debit: 1 },
        { head_id: cashId, credit: 1 },
      ],
    }),
    'Unknown account head',
  ],
  ['contra with non-cash head', () => ({ ...voucher(), type: 'contra' }), 'Contra vouchers'],
])('POST /vouchers %s → 400', async (_name, payload, message) => {
  const { status, body } = await call('POST', '/api/vouchers', { auth: true, body: payload() });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('GET /vouchers bad query → 400', async () => {
  const { status } = await call('GET', '/api/vouchers?head_id=abc', { auth: true });
  expect(status).toBe(400);
});

test('create → get → list filter → update → delete → gone', async () => {
  const created = await call('POST', '/api/vouchers', { auth: true, body: voucher() });
  expect(created.status).toBe(201);
  const id = created.body.data.id as number;
  createdIds.push(id);
  expect(created.body.data).toMatchObject({
    voucher_no: `PV-${id}`,
    type: 'payment',
    date: '2030-01-15',
    total: 1500.25,
    lines: [
      { head_id: rentId, debit: 1500.25, credit: 0, cost_center: null },
      { head_id: cashId, debit: 0, credit: 1500.25 },
    ],
  });

  const one = await call('GET', `/api/vouchers/${id}`, { auth: true });
  expect(one.status).toBe(200);
  expect(one.body.data.id).toBe(id);

  const filtered = await call(
    'GET',
    `/api/vouchers?type=payment&from=2030-01-01&to=2030-01-31&head_id=${rentId}`,
    { auth: true },
  );
  expect(filtered.status).toBe(200);
  expect(filtered.body.data.some((v: any) => v.id === id)).toBe(true);

  const updated = await call('PATCH', `/api/vouchers/${id}`, {
    auth: true,
    body: {
      lines: [
        { head_id: rentId, debit: 99.99 },
        { head_id: cashId, credit: 99.99 },
      ],
    },
  });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({ id, total: 99.99 });
  expect(updated.body.data.lines).toHaveLength(2);

  const badType = await call('PATCH', `/api/vouchers/${id}`, {
    auth: true,
    body: { type: 'contra' },
  });
  expect(badType.status).toBe(400);

  const removed = await call('DELETE', `/api/vouchers/${id}`, { auth: true });
  expect(removed.status).toBe(200);

  const again = await call('DELETE', `/api/vouchers/${id}`, { auth: true });
  expect(again.status).toBe(404);

  const missing = await call('GET', `/api/vouchers/${id}`, { auth: true });
  expect(missing.status).toBe(404);
});
