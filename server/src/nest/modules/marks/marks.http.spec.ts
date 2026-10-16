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

// HTTP contract for /api/marks.
// Lifecycle data lives in YEAR 2097 (temp exam/subject/enrollment) and is removed in afterAll.
const marksheetQueue = () => nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE);
let server: Server;
let base = '';
let host = '';
let token = '';
let schoolId = 0;
const YEAR = 2097; // distinct per http spec (promotion uses 2099) so parallel files don't collide
const CLASS = 6;
const EXAM = 'HTTP Spec Exam';
const seeded = { examId: 0, subjectId: 0, enrollmentId: 0, studentId: 0 };

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
    const subject = await prisma.subjects.create({
      data: {
        school_id: schoolId,
        name: 'HTTP Spec Subject',
        class: CLASS,
        year: YEAR,
        full_mark: 100,
      },
    });
    const enrollment = await prisma.student_enrollments.create({
      data: {
        school_id: schoolId,
        student_id: student.id,
        class: CLASS,
        year: YEAR,
        section: 'Z',
        roll: 999,
      },
    });
    Object.assign(seeded, {
      examId: exam.id,
      subjectId: subject.id,
      enrollmentId: enrollment.id,
      studentId: student.id,
    });
  });
});

afterAll(async () => {
  await asSuperAdmin(async () => {
    const where = { school_id: schoolId, year: YEAR };
    await prisma.marks.deleteMany({ where: { school_id: schoolId, exam_id: seeded.examId } });
    await prisma.exam_class_stats.deleteMany({
      where: { school_id: schoolId, exam_id: seeded.examId },
    });
    await prisma.marksheet_files.deleteMany({
      where: { school_id: schoolId, exam_id: seeded.examId },
    });
    await prisma.marksheet_bundles.deleteMany({
      where: { school_id: schoolId, exam_id: seeded.examId },
    });
    await prisma.marksheet_sessions.deleteMany({ where });
    await prisma.student_enrollments.deleteMany({ where: { ...where, id: seeded.enrollmentId } });
    await prisma.subjects.deleteMany({ where: { ...where, id: seeded.subjectId } });
    await prisma.exams.deleteMany({ where: { school_id: schoolId, id: seeded.examId } });
  });
  // Redis is shared with dev: drop any marksheet job the saves queued for the temp year.
  const jobs = await marksheetQueue().getJobs(['waiting', 'delayed', 'paused', 'failed']);
  await Promise.all(jobs.filter((j) => j?.data?.year === YEAR).map((j) => j.remove()));

  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await Promise.all([marksheetQueue().close(), attendanceSheetQueue.close(), prisma.$disconnect()]);
  redis.disconnect();
}, 30_000); // cleanup is ~10 sequential queries; slow when http specs run in parallel

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
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

test.each([
  ['PUT', '/api/marks'],
  ['GET', '/api/marks?class=6&year=2097&exam=x'],
  ['GET', '/api/marks/roster?class=6&year=2097'],
  ['GET', '/api/marks/students/1?year=2097&exam=x'],
  ['GET', '/api/marks/students/1/session?year=2097'],
  ['PATCH', '/api/marks/students/1/fourth-subject'],
  ['PATCH', '/api/marks/fourth-subjects'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await call(method, path, {
    body: ['GET'].includes(method) ? undefined : {},
  });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test.each([
  ['PUT', '/api/marks', {}, 'students must be an array'],
  [
    'PUT',
    '/api/marks',
    { students: [], examName: EXAM, year: YEAR, x: 1 },
    'property x should not exist',
  ],
  ['GET', '/api/marks?class=x&year=2097&exam=a', undefined, 'class must be an integer number'],
  ['GET', '/api/marks/roster?class=6', undefined, 'year must be an integer number'],
  ['GET', '/api/marks/students/abc?year=2097&exam=a', undefined, 'numeric string is expected'],
  [
    'PATCH',
    '/api/marks/fourth-subjects',
    { class: 8, year: YEAR, group: 'Science' },
    'class must be 9 or 10',
  ],
  [
    'PATCH',
    '/api/marks/students/1/fourth-subject',
    { subjectId: 1 },
    'year must be an integer number',
  ],
])('%s %s %j → 400', async (method, path, payload, message) => {
  const { status, body } = await call(method, path, { auth: true, body: payload });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('marks lifecycle: roster → save → read → unchanged save → 4th subject', async () => {
  const { subjectId, studentId } = seeded;

  const roster = await call('GET', `/api/marks/roster?class=${CLASS}&year=${YEAR}`, { auth: true });
  expect(roster.status).toBe(200);
  expect(roster.body.data).toEqual([
    expect.objectContaining({ student_id: studentId, roll: 999, section: 'Z', class: CLASS }),
  ]);

  const body = {
    examName: EXAM,
    year: YEAR,
    students: [{ studentId, subjectMarks: [{ subjectId, marks: 77 }] }],
  };
  const saved = await call('PUT', '/api/marks', { auth: true, body });
  expect(saved.status).toBe(200);
  expect(saved.body.data).toMatchObject({ success: true, count: 1 });

  const classMarks = await call(
    'GET',
    `/api/marks?class=${CLASS}&year=${YEAR}&exam=${encodeURIComponent(EXAM)}`,
    {
      auth: true,
    },
  );
  expect(classMarks.status).toBe(200);
  expect(classMarks.body.data[0].marks).toEqual([
    expect.objectContaining({ subject_id: subjectId, marks: 77 }),
  ]);

  const one = await call(
    'GET',
    `/api/marks/students/${studentId}?year=${YEAR}&exam=${encodeURIComponent(EXAM)}`,
    {
      auth: true,
    },
  );
  expect(one.status).toBe(200);
  expect(one.body.data).toEqual([{ subject: 'HTTP Spec Subject', marks: 77 }]);

  const again = await call('PUT', '/api/marks', { auth: true, body });
  expect(again.body.data.count).toBe(0);

  const fourth = await call('PATCH', `/api/marks/students/${studentId}/fourth-subject`, {
    auth: true,
    body: { year: YEAR, subjectId },
  });
  expect(fourth.status).toBe(200);
  expect(fourth.body.data.fourth_subject_id).toBe(subjectId);
  const cleared = await call('PATCH', `/api/marks/students/${studentId}/fourth-subject`, {
    auth: true,
    body: { year: YEAR, subjectId: null },
  });
  expect(cleared.body.data.fourth_subject_id).toBeNull();
});
