import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../app.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { redis } from '../../../config/redis.js';
import { runWithRlsContext } from '../../../config/rlsContextStore.js';
import { marksheetQueue } from '../../../modules/marks/marksheet.queue.js';
import { attendanceSheetQueue } from '../../../modules/attendence/attendence-sheet.queue.js';

// HTTP contract for /api/holidays — must pass identically on legacy Express and Nest.
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
      async () => await prisma.holidays.deleteMany({ where: { id: { in: createdIds } } }),
    );
  }
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue.close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
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

test('GET /holidays → 200 ApiResponse', async () => {
  const { status, body } = await call('GET', '/api/holidays');
  expect(status).toBe(200);
  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
});

test('POST /holidays without token → 401 error envelope', async () => {
  const { status, body } = await call('POST', '/api/holidays', { body: {} });
  expect(status).toBe(401);
  expect(body).toEqual({
    success: false,
    message: 'Unauthorized',
    errors: [],
    error: 'Unauthorized',
  });
});

test('POST /holidays empty body → 400', async () => {
  const { status, body } = await call('POST', '/api/holidays', { auth: true, body: {} });
  expect(status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.message).toContain('title must be a string');
});

const valid = { title: 'Eid', start_date: '2026-03-30', end_date: '2026-04-01' };

// All rejected before any DB write, so they leave no rows behind.
test.each([
  ['missing dates', { title: 'Eid' }, 'start_date must be a valid ISO 8601 date string'],
  ['bad date', { ...valid, start_date: 'not-a-date' }, 'start_date must be a valid ISO 8601 date string'],
  ['wrong type', { ...valid, is_optional: 'yes' }, 'is_optional must be a boolean value'],
  ['extra field', { ...valid, school_id: 2 }, 'property school_id should not exist'],
  ['start after end', { ...valid, start_date: '2026-05-01' }, 'Start date cannot be after end date'],
])('POST /holidays %s → 400', async (_name, payload, message) => {
  const { status, body } = await call('POST', '/api/holidays', { auth: true, body: payload });
  expect(status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.message).toContain(message);
  expect(body.error).toBe(body.message);
});

test('PATCH /holidays/:id unknown field → 400', async () => {
  const { status, body } = await call('PATCH', '/api/holidays/1', {
    auth: true,
    body: { school_id: 2 },
  });
  expect(status).toBe(400);
  expect(body.message).toContain('property school_id should not exist');
});

test('PATCH /holidays/abc → 400 invalid id', async () => {
  const { status, body } = await call('PATCH', '/api/holidays/abc', {
    auth: true,
    body: {},
  });
  expect(status).toBe(400);
  expect(body.message).toBe('Validation failed (numeric string is expected)');
});

test.each([
  ['PATCH', '/api/holidays/1'],
  ['DELETE', '/api/holidays/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, { body: {} });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('unknown route → legacy 404 body', async () => {
  const { status, body } = await call('GET', '/api/does-not-exist');
  expect(status).toBe(404);
  expect(body).toEqual({ success: false, message: 'Route not found' });
});

test('legacy route error → same envelope', async () => {
  const { status, body } = await call('POST', '/api/events/addEvent', { body: {} });
  expect(status).toBe(401);
  expect(body).toEqual({
    success: false,
    message: 'Unauthorized',
    errors: [],
    error: 'Unauthorized',
  });
});

test('create → list → update → delete → gone', async () => {
  const title = `test-holiday-${Date.now()}`;

  const created = await call('POST', '/api/holidays', {
    auth: true,
    body: { title, start_date: '2030-01-01T09:00:00Z', end_date: '2030-01-02' },
  });
  expect(created.status).toBe(201);
  expect(created.body.success).toBe(true);
  const id = created.body.data.id as number;
  createdIds.push(id);
  expect(created.body.data).toMatchObject({
    title,
    start_date: '2030-01-01',
    end_date: '2030-01-02',
    is_optional: false,
  });

  const list = await call('GET', '/api/holidays');
  expect(list.body.data.some((h: any) => h.id === id)).toBe(true);

  const updated = await call('PATCH', `/api/holidays/${id}`, {
    auth: true,
    body: { title: `${title}-edited`, is_optional: true },
  });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({
    id,
    title: `${title}-edited`,
    is_optional: true,
    start_date: '2030-01-01',
  });

  const removed = await call('DELETE', `/api/holidays/${id}`, { auth: true });
  expect(removed.status).toBe(200);

  const again = await call('DELETE', `/api/holidays/${id}`, { auth: true });
  expect(again.status).toBe(404);
  expect(again.body.success).toBe(false);

  const missingUpdate = await call('PATCH', `/api/holidays/${id}`, { auth: true, body: { title: 'x' } });
  expect(missingUpdate.status).toBe(404);
});
