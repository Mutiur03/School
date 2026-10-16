import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../app.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { redis } from '../../../config/redis.js';
import { runWithRlsContext } from '../../../config/rlsContextStore.js';
import { nestApp } from '../../common/nest-app.js';
import { MARKSHEET_QUEUE } from './jobs/marksheet.queue.js';
import type { MarksheetQueue } from './jobs/marksheet.queue.js';
import { attendanceSheetQueue } from '../../../modules/attendence/attendence-sheet.queue.js';

// HTTP contract for /api/marksheets.
// Lifecycle data lives in YEAR 2096 (temp exam) and is removed in afterAll.
const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);
let server: Server;
let base = '';
let host = '';
let token = '';
let schoolId = 0;
let examId = 0;
const YEAR = 2096; // distinct per http spec so parallel files don't collide

// Prisma queries are lazy: await inside the context so they run as super admin.
const asSuperAdmin = <T>(fn: () => Promise<T>) =>
  runWithRlsContext({ isSuperAdmin: true }, async () => await fn());

beforeAll(async () => {
  const app = await createApp();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;

  const admin = await asSuperAdmin(() =>
    prisma.admin.findFirst({ where: { role: 'admin' }, include: { school: true } }),
  );
  if (!admin?.school?.subdomain) throw new Error('need a seeded admin with a school subdomain');
  host = `${admin.school.subdomain}.localhost`;
  schoolId = admin.school.id;
  token = jwt.sign({ id: admin.id, role: 'admin' }, env.JWT_SECRET);

  await asSuperAdmin(async () => {
    const examType = await prisma.exam_types.findFirst();
    if (!examType) throw new Error('need a seeded exam type');
    const exam = await prisma.exams.create({
      data: {
        school_id: schoolId,
        exam_name: 'HTTP Spec Marksheet Exam',
        exam_year: YEAR,
        exam_type_id: examType.id,
        start_date: `${YEAR}-01-01`,
        end_date: `${YEAR}-01-10`,
        result_date: `${YEAR}-12-31`,
        levels: [6],
      },
    });
    examId = exam.id;
  });
});

afterAll(async () => {
  await asSuperAdmin(async () => {
    const where = { school_id: schoolId, exam_id: examId };
    await prisma.marksheet_files.deleteMany({ where });
    await prisma.marksheet_bundles.deleteMany({ where });
    await prisma.exams.deleteMany({ where: { school_id: schoolId, id: examId } });
  });
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue().close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
  redis.disconnect();
});

const call = async (method: string, path: string, opts: { auth?: boolean } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'x-tenant-host': host,
      ...(opts.auth ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

test.each([
  ['GET', '/api/marksheets/students/1?year=2096&exam=x'],
  ['GET', '/api/marksheets/students/1/session?year=2096'],
  ['GET', '/api/marksheets/session?year=2096'],
  ['GET', '/api/marksheets/classes/6/bundle?year=2096&exam=x'],
  ['GET', '/api/marksheets/classes/6/summary?year=2096&exam=x'],
  ['GET', '/api/marksheets/exams/1/status'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path);
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('GET /api/marksheets/exams/abc/status → 400', async () => {
  const { status, body } = await call('GET', '/api/marksheets/exams/abc/status', { auth: true });
  expect(status).toBe(400);
  expect(body.message).toContain('numeric string is expected');
});

test('generation status → 200, never cached', async () => {
  const { status, headers } = await call('GET', `/api/marksheets/exams/${examId}/status`, {
    auth: true,
  });
  expect(status).toBe(200);
  expect(headers.get('cache-control')).toBe('no-store');
});
