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

// HTTP contract for /api/cost-centers.
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
  // Runs even if a test failed midway, so the dev DB keeps no test rows.
  if (createdIds.length) {
    await runWithRlsContext(
      { isSuperAdmin: true },
      async () => await prisma.acc_cost_centers.deleteMany({ where: { id: { in: createdIds } } }),
    );
  }
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
  ['GET', '/api/cost-centers'],
  ['GET', '/api/cost-centers/1'],
  ['POST', '/api/cost-centers'],
  ['PATCH', '/api/cost-centers/1'],
  ['DELETE', '/api/cost-centers/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, { body: method === 'GET' ? undefined : {} });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

// All rejected before any DB write, so they leave no rows behind.
test.each([
  ['empty body', {}, 'name must be a string'],
  ['long code', { name: 'Lab', code: 'x'.repeat(21) }, 'code must be shorter than or equal to 20'],
  ['extra field', { name: 'Lab', school_id: 2 }, 'property school_id should not exist'],
])('POST /cost-centers %s → 400', async (_name, payload, message) => {
  const { status, body } = await call('POST', '/api/cost-centers', { auth: true, body: payload });
  expect(status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.message).toContain(message);
});

test('PATCH /cost-centers/abc → 400 invalid id', async () => {
  const { status, body } = await call('PATCH', '/api/cost-centers/abc', { auth: true, body: {} });
  expect(status).toBe(400);
  expect(body.message).toBe('Validation failed (numeric string is expected)');
});

test('create → list → get → update → delete → gone', async () => {
  const name = `test-cc-${Date.now()}`;

  const created = await call('POST', '/api/cost-centers', {
    auth: true,
    body: { name, code: 'T1' },
  });
  expect(created.status).toBe(201);
  expect(created.body.success).toBe(true);
  const id = created.body.data.id as number;
  createdIds.push(id);
  expect(created.body.data).toMatchObject({ name, code: 'T1', is_active: true });

  const dup = await call('POST', '/api/cost-centers', { auth: true, body: { name } });
  expect(dup.status).toBe(409);

  const list = await call('GET', '/api/cost-centers', { auth: true });
  expect(list.body.data.some((c: any) => c.id === id)).toBe(true);

  const one = await call('GET', `/api/cost-centers/${id}`, { auth: true });
  expect(one.status).toBe(200);
  expect(one.body.data).toMatchObject({ id, name });

  const updated = await call('PATCH', `/api/cost-centers/${id}`, {
    auth: true,
    body: { name: `${name}-edited`, is_active: false },
  });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({ id, name: `${name}-edited`, is_active: false });

  expect((await call('DELETE', `/api/cost-centers/${id}`, { auth: true })).status).toBe(200);

  const again = await call('DELETE', `/api/cost-centers/${id}`, { auth: true });
  expect(again.status).toBe(404);

  const missing = await call('PATCH', `/api/cost-centers/${id}`, {
    auth: true,
    body: { name: 'x' },
  });
  expect(missing.status).toBe(404);
});
