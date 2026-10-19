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

// HTTP contract for /api/promotions + /api/graduations. Never calls POST results/promote/graduate:
// those rewrite real enrollments.
const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);
let server: Server;
let base = '';
let host = '';
let token = '';
const YEAR = 2099; // no data → pass-rules writes are isolated and removed in afterAll
let schoolId = 0;

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
  await runWithRlsContext(
    { isSuperAdmin: true },
    async () =>
      await prisma.promotion_pass_rules.deleteMany({ where: { school_id: schoolId, year: YEAR } }),
  );
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
  ['GET', `/api/promotions/${YEAR}/results`],
  ['GET', `/api/promotions/${YEAR}/stats`],
  ['POST', `/api/promotions/${YEAR}/results`],
  ['GET', `/api/promotions/${YEAR}/pass-rules`],
  ['PUT', `/api/promotions/${YEAR}/pass-rules`],
  ['GET', `/api/promotions/${YEAR}/plan`],
  ['POST', `/api/promotions/${YEAR}`],
  ['GET', `/api/graduations/${YEAR}/plan`],
  ['POST', `/api/graduations/${YEAR}`],
  ['PATCH', `/api/promotions/${YEAR}/results/1`],
  ['GET', `/api/promotions/${YEAR}/results/1/placement?status=Passed`],
  ['DELETE', `/api/promotions/${YEAR}/results/1/override`],
  ['GET', `/api/promotions/${YEAR}/corrections/plan`],
  ['POST', `/api/promotions/${YEAR}/corrections`],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, { body: method === 'GET' ? undefined : {} });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('GET /promotions/abc/stats → 400 invalid year', async () => {
  const { status, body } = await call('GET', '/api/promotions/abc/stats', { auth: true });
  expect(status).toBe(400);
  expect(body.message).toBe('Validation failed (numeric string is expected)');
});

test.each([
  [{}, 'rules must be an array'],
  [{ rules: [{ class: 5, max_failed: 0 }] }, 'class must be one of the following values'],
  [{ rules: [{ class: 6, max_failed: 99 }] }, 'max_failed must not be greater than 15'],
  [{ rules: [], school_id: 2 }, 'property school_id should not exist'],
])('PUT pass-rules %j → 400', async (payload, message) => {
  const { status, body } = await call('PUT', `/api/promotions/${YEAR}/pass-rules`, {
    auth: true,
    body: payload,
  });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test.each([
  [{}, 'status must be one of the following values'],
  [{ status: 'Promoted' }, 'status must be one of the following values'],
])('PATCH result %j → 400', async (payload, message) => {
  const { status, body } = await call('PATCH', `/api/promotions/${YEAR}/results/1`, {
    auth: true,
    body: payload,
  });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('PATCH unknown enrollment → 404', async () => {
  const { status, body } = await call('PATCH', `/api/promotions/${YEAR}/results/2147483647`, {
    auth: true,
    body: { status: 'Passed' },
  });
  expect(status).toBe(404);
  expect(body.success).toBe(false);
});

test('PATCH a real enrollment under the wrong year → 404, row untouched', async () => {
  const enrollment = await runWithRlsContext(
    { isSuperAdmin: true },
    async () =>
      await prisma.student_enrollments.findFirst({
        where: { school_id: schoolId, year: { not: YEAR } },
      }),
  );
  if (!enrollment) throw new Error('need a seeded enrollment');
  const { status } = await call('PATCH', `/api/promotions/${YEAR}/results/${enrollment.id}`, {
    auth: true,
    body: { status: enrollment.status === 'Failed' ? 'Passed' : 'Failed' },
  });
  expect(status).toBe(404);
  const after = await runWithRlsContext(
    { isSuperAdmin: true },
    async () => await prisma.student_enrollments.findUnique({ where: { id: enrollment.id } }),
  );
  expect(after?.status).toBe(enrollment.status);
});

test('empty year: results, stats and plans are empty', async () => {
  const results = await call('GET', `/api/promotions/${YEAR}/results`, { auth: true });
  expect(results.status).toBe(200);
  expect(results.body.data).toMatchObject({ results: [], missingYearEnd: [], missingPrevious: [] });

  const stats = await call('GET', `/api/promotions/${YEAR}/stats`, { auth: true });
  expect(stats.status).toBe(200);
  expect(stats.body.data).toMatchObject({ year: YEAR, newYear: YEAR + 1, promoted: false });

  const preview = await call('GET', `/api/promotions/${YEAR}/plan`, { auth: true });
  expect(preview.status).toBe(200);
  expect(preview.body.data.students).toEqual([]);

  const graduation = await call('GET', `/api/graduations/${YEAR}/plan`, { auth: true });
  expect(graduation.status).toBe(200);
  expect(graduation.body.data.students).toEqual([]);
});

test('pass rules: read defaults → save → read back', async () => {
  const before = await call('GET', `/api/promotions/${YEAR}/pass-rules`, { auth: true });
  expect(before.status).toBe(200);
  expect(before.body.data).toHaveLength(5);

  const saved = await call('PUT', `/api/promotions/${YEAR}/pass-rules`, {
    auth: true,
    body: { rules: [{ class: 9, max_failed: 2 }] },
  });
  expect(saved.status).toBe(200);
  expect(saved.body.data).toContainEqual({ class: 9, max_failed: 2 });
  expect(saved.body.data).toContainEqual({ class: 6, max_failed: 0 });

  const after = await call('GET', `/api/promotions/${YEAR}/pass-rules`, { auth: true });
  expect(after.body.data).toEqual(saved.body.data);
});
