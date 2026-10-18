import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import { attendanceSheetQueue } from '../../modules/attendence/attendence-sheet.queue.js';
import { MARKSHEET_QUEUE } from '../modules/marksheets/jobs/marksheet.queue.js';
import type { MarksheetQueue } from '../modules/marksheets/jobs/marksheet.queue.js';
import { asSuperAdmin } from './http-test.js';
import { nestApp } from './nest-app.js';

export const FIXTURE_PASSWORD = 'Fixture-pass-1';
export const FIXTURE_YEAR = 2026;

export interface FixtureSchool {
  schoolId: number;
  name: string;
  host: string;
  admin: { id: number; username: string };
  student: { id: number; login_id: string; name: string };
}

/**
 * Two isolated schools (A and B), each with one admin and one enrolled student, for http specs
 * that need cross-tenant checks. Real DB; `cleanup()` deletes everything (cascades from School).
 */
export async function seedTwoSchools(tag = randomBytes(4).toString('hex')) {
  const password = await bcrypt.hash(FIXTURE_PASSWORD, 4);
  const schools: FixtureSchool[] = await asSuperAdmin(async () => {
    const out: FixtureSchool[] = [];
    for (const k of ['a', 'b']) {
      const school = await prisma.school.create({
        data: {
          name: `Fixture ${k.toUpperCase()} ${tag}`,
          shortName: k.toUpperCase(),
          subdomain: `fx${tag}${k}`,
        },
      });
      await prisma.school_subscriptions.create({
        data: {
          school_id: school.id,
          status: 'active',
          current_period_ends_at: new Date(Date.now() + 365 * 86_400_000),
        },
      });
      const admin = await prisma.admin.create({
        data: { username: `fx-admin-${tag}-${k}`, password, school_id: school.id },
      });
      const loginId = BigInt(`0x${randomBytes(5).toString('hex')}`) * 10n + BigInt(out.length);
      const student = await prisma.students.create({
        data: {
          login_id: loginId,
          name: `Student ${k.toUpperCase()} ${tag}`,
          batch: String(FIXTURE_YEAR),
          password,
          school_id: school.id,
        },
      });
      await prisma.student_enrollments.create({
        data: {
          student_id: student.id,
          class: 6,
          roll: 1,
          section: 'A',
          year: FIXTURE_YEAR,
          school_id: school.id,
        },
      });
      out.push({
        schoolId: school.id,
        name: school.name,
        host: `${school.subdomain}.localhost`,
        admin: { id: admin.id, username: admin.username },
        student: { id: student.id, login_id: loginId.toString(), name: student.name },
      });
    }
    return out;
  });

  return {
    a: schools[0],
    b: schools[1],
    async cleanup() {
      await asSuperAdmin(
        async () =>
          await prisma.school.deleteMany({ where: { id: { in: schools.map((s) => s.schoolId) } } }),
      );
    },
  };
}

/** Same teardown as http-test.ts. */
export async function closeAppResources() {
  await Promise.all([
    nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE).close(),
    attendanceSheetQueue.close(),
    prisma.$disconnect(),
  ]);
  redis.disconnect();
}
