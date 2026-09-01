import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { getRlsContext, patchRlsContext } from '../../config/rlsContextStore.js';
import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import generatePassword from '../../utils/pwgenerator.js';
import { ApiError } from '../../utils/ApiError.js';

const schoolInfoKey = (id: number) => `school:info:${id}`;

function sheetToBuffer(rows: Record<string, unknown>[], sheetName: string): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export class SchoolService {
  static async createSchool(data: any) {
    return prisma.$transaction(async (tx) => {
      const school = await tx.school.create({ data });
      const defaults = await tx.exam_types.findMany({
        where: { assign_to_new_schools: true },
        select: { id: true },
      });
      if (defaults.length) {
        await tx.school_exam_types.createMany({
          data: defaults.map((type) => ({ school_id: school.id, exam_type_id: type.id })),
          skipDuplicates: true,
        });
      }
      return school;
    });
  }

  static async getSchools() {
    return prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSchoolById(id: number) {
    return prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            exams: true,
            notices: true,
          },
        },
      },
    });
  }

  static async updateSchool(id: number, data: any) {
    const updated = await prisma.school.update({
      where: { id },
      data,
    });
    redis.del(schoolInfoKey(id)).catch(() => {});
    return updated;
  }

  static async getSchoolInfo(id: number) {
    const key = schoolInfoKey(id);
    const cached = await redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached);

    const info = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        shortName: true,
        nameBn: true,
        eiin: true,
        centerCode: true,
        schoolCode: true,
        subjectGroups: true,
        medium: true,
        board: true,
        ownership: true,
        gender: true,
        logo: true,
        headerLogo: true,
        bannerUrls: true,
        district: true,
        upazila: true,
        address: true,
        phone: true,
        email: true,
        subdomain: true,
        customDomain: true,
        mapEmbedUrl: true,
        establishedIn: true,
        nationalizedYear: true,
        resultsUrl: true,
        teacherLoginUrl: true,
        studentLoginUrl: true,
        gaMeasurementId: true,
        descriptions: true,
        academicProfile: true,
        seo: true,
      },
    });

    if (info) redis.set(key, JSON.stringify(info), 'EX', 300).catch(() => {});
    return info;
  }

  static async getCurrentSchoolInfo({ schoolId }: { schoolId?: number }) {
    if (!schoolId) return null;

    return this.getSchoolInfo(schoolId);
  }

  /** Rotate the password of every student belonging to a school; returns an .xlsx of new credentials. */
  static async rotateStudentPasswords(schoolId: number) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new ApiError(404, 'School not found');

    const students = await prisma.students.findMany({
      where: { school_id: schoolId },
      select: {
        id: true,
        login_id: true,
        name: true,
        batch: true,
        religion: true,
      },
    });

    if (students.length === 0) {
      throw new ApiError(404, 'No students found for this school');
    }

    const processed = await Promise.all(
      students.map(async (student) => {
        const password = generatePassword(8);
        const hashedPassword = await bcrypt.hash(password, 10);
        return { ...student, password, hashedPassword };
      }),
    );

    // Outer $transaction without inRlsTransaction makes the RLS extension nest a
    // new txn per update; the outer txn idles and dies (~5s) → "Transaction not found".
    const rls = getRlsContext();
    await prisma.$transaction(
      async (tx) => {
        if (rls) {
          await tx.$executeRaw`
            SELECT
              set_config('app.is_super_admin', ${rls.isSuperAdmin ? '1' : '0'}, true),
              set_config('app.school_id', ${rls.schoolId ? String(rls.schoolId) : ''}, true)
          `;
        }
        patchRlsContext({ inRlsTransaction: true });
        try {
          await Promise.all(
            processed.map((student) =>
              tx.students.update({
                where: { id: student.id },
                data: {
                  password: student.hashedPassword,
                  tokenVersion: { increment: 1 },
                },
              }),
            ),
          );
        } finally {
          patchRlsContext({ inRlsTransaction: false });
        }
      },
      { timeout: 120_000 },
    );

    return sheetToBuffer(
      processed.map((student) => ({
        'Login ID': student.login_id.toString(),
        Name: student.name,
        Batch: student.batch,
        'New Password': student.password,
      })),
      'Rotated Passwords',
    );
  }

  /** Build an .xlsx of all students for a school. */
  static async exportStudentsExcel(schoolId: number) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new ApiError(404, 'School not found');

    const students = await prisma.students.findMany({
      where: { school_id: schoolId },
      include: {
        enrollments: { orderBy: { year: 'desc' }, take: 1 },
      },
      orderBy: { login_id: 'asc' },
    });

    return sheetToBuffer(
      students.map((student) => {
        const enrollment = student.enrollments[0];
        return {
          'Login ID': student.login_id.toString(),
          Name: student.name,
          'Father Name': student.father_name ?? '',
          'Mother Name': student.mother_name ?? '',
          Batch: student.batch,
          Class: enrollment?.class ?? '',
          Section: enrollment?.section ?? '',
          Roll: enrollment?.roll ?? '',
          Religion: student.religion,
          'Father Phone': student.father_phone ?? '',
          'Mother Phone': student.mother_phone ?? '',
          DOB: student.dob ?? '',
          Village: student.village ?? '',
          'Post Office': student.post_office ?? '',
          Upazila: student.upazila ?? '',
          District: student.district ?? '',
          Available: student.available ? 'Yes' : 'No',
        };
      }),
      'Students',
    );
  }
}
