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

// HTTP contract for /api/public-results (no login; school from the host).
// Lifecycle data lives in YEAR 2095 (temp unpublished exam) and is removed in afterAll.
const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);
let server: Server;
let base = '';
let host = '';
let token = '';
let schoolId = 0;
let examId = 0;
let studentId = 0;
const YEAR = 2095; // distinct per http spec so parallel files don't collide
const CLASS = 6;
const EXAM = 'HTTP Spec Public Exam';

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
    const student = await prisma.students.findFirst({ where: { school_id: schoolId } });
    if (!examType || !student) throw new Error('need a seeded exam type and student');
    const exam = await prisma.exams.create({
      data: {
        school_id: schoolId,
        exam_name: EXAM,
        exam_year: YEAR,
        exam_type_id: examType.id,
        start_date: `${YEAR}-01-01`,
        end_date: `${YEAR}-01-10`,
        result_date: `${YEAR}-12-31`,
        levels: [CLASS],
      },
    });
    examId = exam.id;
    studentId = student.id;
  });
});

afterAll(async () => {
  await asSuperAdmin(
    async () => await prisma.exams.deleteMany({ where: { school_id: schoolId, id: examId } }),
  );
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue().close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
  redis.disconnect();
});

const call = async (
  method: string,
  path: string,
  opts: { auth?: boolean | string; body?: unknown } = {},
) => {
  const bearer = opts.auth === true ? token : opts.auth;
  const res = await fetch(base + path, {
    method,
    headers: {
      'x-tenant-host': host,
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

test.each([
  ['GET', '/api/public-results?year=2095&exam=x'],
  ['GET', '/api/public-results/marksheet?year=2095&exam=x'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path);
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('public result with an admin (non public_result) token → 401 Invalid token', async () => {
  const { status, body } = await call('GET', '/api/public-results?year=2095&exam=x', {
    auth: true,
  });
  expect(status).toBe(401);
  expect(body.message).toBe('Invalid token');
});

test.each([
  ['GET', '/api/public-results/exams?year=26&class=6', undefined, 'Session year is invalid'],
  [
    'GET',
    '/api/public-results/exams?year=2095&class=11',
    undefined,
    'Class must be between 1 and 10',
  ],
  ['POST', '/api/public-results/verification', {}, 'Mobile must be 11 digits and start with 01'],
])('public %s %s → 400', async (method, path, payload, message) => {
  const { status, body } = await call(method, path, { body: payload });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('public lifecycle: exams → bad verification → unpublished result', async () => {
  const exams = await call('GET', `/api/public-results/exams?year=${YEAR}&class=${CLASS}`);
  expect(exams.status).toBe(200);
  expect(exams.body.data).toEqual([expect.objectContaining({ exam_name: EXAM, visible: false })]);

  const verify = await call('POST', '/api/public-results/verification', {
    body: { year: YEAR, class: CLASS, section: 'Z', roll: 999, phone: '01000000000' },
  });
  expect(verify.status).toBe(401);

  // Valid public token, but the exam is not published yet.
  const publicToken = jwt.sign({ id: studentId, schoolId, role: 'public_result' }, env.JWT_SECRET);
  const result = await call(
    'GET',
    `/api/public-results?year=${YEAR}&exam=${encodeURIComponent(EXAM)}`,
    { auth: publicToken },
  );
  expect(result.status).toBe(403);
  expect(result.body.message).toBe('The results have not been published yet.');
});
