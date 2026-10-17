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

// HTTP contract for /api/acc-heads.
let server: Server;
let base = '';
let host = '';
let token = '';
const createdIds: number[] = [];

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
  token = jwt.sign({ id: admin.id, role: 'admin' }, env.JWT_SECRET);
});

afterAll(async () => {
  // Children before parents (parent FK is RESTRICT), so delete newest first.
  await runWithRlsContext({ isSuperAdmin: true }, async () => {
    for (const id of [...createdIds].reverse()) {
      await prisma.acc_heads.deleteMany({ where: { id } });
    }
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

test.each([
  ['GET', '/api/acc-heads'],
  ['GET', '/api/acc-heads/1'],
  ['POST', '/api/acc-heads'],
  ['PATCH', '/api/acc-heads/1'],
  ['DELETE', '/api/acc-heads/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, { body: method === 'GET' ? undefined : {} });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

const valid = { name: 'Cash', type: 'asset' };

// All rejected before any DB write, so they leave no rows behind.
test.each([
  ['empty body', {}, 'name must be a string'],
  ['bad type', { ...valid, type: 'revenue' }, 'type must be one of the following values'],
  ['extra field', { ...valid, school_id: 2 }, 'property school_id should not exist'],
  [
    'cash/bank on income',
    { name: 'Fees', type: 'income', is_cash_bank: true },
    'Only asset heads can be cash/bank accounts',
  ],
  ['missing parent', { ...valid, parent_id: 2147483647 }, 'Parent head not found'],
])('POST /acc-heads %s → 400', async (_name, payload, message) => {
  const { status, body } = await call('POST', '/api/acc-heads', { auth: true, body: payload });
  expect(status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.message).toContain(message);
});

test('GET /acc-heads/abc → 400 invalid id', async () => {
  const { status, body } = await call('GET', '/api/acc-heads/abc', { auth: true });
  expect(status).toBe(400);
  expect(body.message).toBe('Validation failed (numeric string is expected)');
});

test('create parent/child → list → get → update → delete in-use 409 → delete → gone', async () => {
  const name = `test-head-${Date.now()}`;

  const parent = await call('POST', '/api/acc-heads', {
    auth: true,
    body: { name, type: 'expense', code: 'T1' },
  });
  expect(parent.status).toBe(201);
  const parentId = parent.body.data.id as number;
  createdIds.push(parentId);
  expect(parent.body.data).toMatchObject({ name, type: 'expense', is_cash_bank: false });

  const child = await call('POST', '/api/acc-heads', {
    auth: true,
    body: { name: `${name}-child`, type: 'expense', parent_id: parentId },
  });
  expect(child.status).toBe(201);
  const childId = child.body.data.id as number;
  createdIds.push(childId);

  const wrongType = await call('POST', '/api/acc-heads', {
    auth: true,
    body: { name: `${name}-bad`, type: 'income', parent_id: parentId },
  });
  expect(wrongType.status).toBe(400);

  const dup = await call('POST', '/api/acc-heads', { auth: true, body: { name, type: 'expense' } });
  expect(dup.status).toBe(409);

  const list = await call('GET', '/api/acc-heads', { auth: true });
  expect(list.status).toBe(200);
  expect(list.body.data.some((h: any) => h.id === childId)).toBe(true);

  const one = await call('GET', `/api/acc-heads/${childId}`, { auth: true });
  expect(one.status).toBe(200);
  expect(one.body.data).toMatchObject({ id: childId, parent_id: parentId });

  const self = await call('PATCH', `/api/acc-heads/${childId}`, {
    auth: true,
    body: { parent_id: childId },
  });
  expect(self.status).toBe(400);

  const updated = await call('PATCH', `/api/acc-heads/${childId}`, {
    auth: true,
    body: { name: `${name}-edited`, is_active: false },
  });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({
    id: childId,
    name: `${name}-edited`,
    is_active: false,
  });

  const inUse = await call('DELETE', `/api/acc-heads/${parentId}`, { auth: true });
  expect(inUse.status).toBe(409);

  expect((await call('DELETE', `/api/acc-heads/${childId}`, { auth: true })).status).toBe(200);
  expect((await call('DELETE', `/api/acc-heads/${parentId}`, { auth: true })).status).toBe(200);

  const again = await call('DELETE', `/api/acc-heads/${parentId}`, { auth: true });
  expect(again.status).toBe(404);

  const missing = await call('GET', `/api/acc-heads/${parentId}`, { auth: true });
  expect(missing.status).toBe(404);
});
