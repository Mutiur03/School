import jwt from 'jsonwebtoken';
import type { PublicResultVerifyData } from '@school/shared-schemas';
import { prisma } from '@/config/prisma.js';
import { env } from '@/config/env.js';
import { ApiError } from '@/utils/ApiError.js';

const PUBLIC_RESULT_ROLE = 'public_result';
const TOKEN_TTL = '15m';

export interface PublicResultTokenPayload {
  id: number;
  role: typeof PUBLIC_RESULT_ROLE;
}

function signPublicResultToken(studentId: number): string {
  return jwt.sign({ id: studentId, role: PUBLIC_RESULT_ROLE }, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/** Days between a "YYYY-MM-DD" date and today; Infinity when unparseable. */
function daysFromToday(isoDate: string | null): number {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return Math.abs(time - Date.now()) / 86_400_000;
}

/** Verify a public-result token. Throws ApiError(401) on any problem. */
export function verifyPublicResultToken(token: string | undefined): PublicResultTokenPayload {
  if (!token) throw new ApiError(401, 'Unauthorized');
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as PublicResultTokenPayload;
    if (!decoded || decoded.role !== PUBLIC_RESULT_ROLE || !decoded.id) {
      throw new ApiError(401, 'Invalid token');
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Session expired. Please verify again.');
    }
    throw new ApiError(401, 'Invalid token');
  }
}

export class PublicResultService {
  /**
   * Exams for a session year whose `levels` include the given class, ordered so
   * the exam with the result date nearest to today comes first — that is the one
   * a visitor is most likely checking. Includes unpublished exams so the public
   * form can list them; visibility is enforced when fetching marks / marksheets.
   */
  static async listExams(year: number, classInt: number) {
    const exams = await prisma.exams.findMany({
      where: {
        exam_year: year,
        levels: { has: classInt },
      },
      select: {
        exam_name: true,
        result_date: true,
        visible: true,
      },
      orderBy: [{ result_date: 'desc' }, { exam_name: 'asc' }],
    });

    // Distinct by name (levels uniqueness can yield same name across level arrays).
    const seen = new Set<string>();
    const distinct = exams.filter((e) => {
      if (seen.has(e.exam_name)) return false;
      seen.add(e.exam_name);
      return true;
    });

    return distinct.sort((a, b) => {
      const diff = daysFromToday(a.result_date) - daysFromToday(b.result_date);
      if (diff !== 0) return diff;
      return a.exam_name.localeCompare(b.exam_name);
    });
  }

  /** @deprecated Prefer listExams — kept name alias for older call sites. */
  static async listPublishedExams(year: number, classInt: number) {
    return this.listExams(year, classInt);
  }

  /**
   * Match enrollment by year/class/section/roll + (father_phone OR mother_phone)
   * within the current school (Prisma queries are RLS-scoped by subdomain).
   * Returns a short-lived token plus exams for that session (published or not).
   */
  static async verify(input: PublicResultVerifyData) {
    const { year, class: classInt, section, roll, phone } = input;

    const enrollment = await prisma.student_enrollments.findFirst({
      where: {
        year,
        class: classInt,
        section,
        roll,
        student: {
          available: true,
          OR: [{ father_phone: phone }, { mother_phone: phone }],
        },
      },
      select: {
        student: { select: { id: true, name: true } },
      },
    });

    if (!enrollment) {
      throw new ApiError(401, 'Invalid session, class, section, roll, or phone number');
    }

    const student = enrollment.student;
    const exams = await this.listExams(year, classInt);

    return {
      token: signPublicResultToken(student.id),
      student: { id: student.id, name: student.name },
      sessions: [{ year, exams }],
    };
  }

  /** Guard: exam must exist and be published (visible). Throws otherwise. */
  private static async assertPublished(exam: string) {
    const examRow = await prisma.exams.findFirst({
      where: { exam_name: exam, visible: true },
      select: { id: true },
    });
    if (!examRow) {
      throw new ApiError(403, 'The results have not been published yet.');
    }
  }

  /** On-screen marks table for a single published exam. */
  static async getExamResult(studentId: number, year: number, exam: string) {
    await this.assertPublished(exam);

    const marks = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: studentId, year },
        exam: { exam_name: exam, visible: true },
      },
      include: {
        enrollment: {
          include: { student: { select: { name: true } } },
        },
        subject: {
          select: {
            name: true,
            priority: true,
            full_mark: true,
            parent_id: true,
            parent: { select: { name: true } },
          },
        },
        exam: { select: { exam_name: true, result_date: true } },
      },
    });

    if (marks.length === 0 || !marks.some((m) => m.marks !== null)) {
      throw new ApiError(404, 'No result found for this student');
    }

    const first = marks[0];
    const subjectTotals: Record<string, { marks: number; full_mark: number; priority: number }> =
      {};

    for (const m of marks) {
      const subjectName = m.subject.parent?.name || m.subject.name;
      if (!subjectTotals[subjectName]) {
        subjectTotals[subjectName] = {
          marks: 0,
          full_mark: 0,
          priority: m.subject.priority ?? 0,
        };
      }
      subjectTotals[subjectName].marks += m.marks ?? 0;
      subjectTotals[subjectName].full_mark += m.subject.full_mark ?? 0;
    }

    const rows = Object.entries(subjectTotals)
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([subject, v]) => ({
        subject,
        marks: v.marks,
        full_mark: v.full_mark,
      }));

    const total = rows.reduce((sum, r) => sum + r.marks, 0);
    const total_full = rows.reduce((sum, r) => sum + (r.full_mark ?? 0), 0);

    return {
      student: {
        name: first.enrollment.student.name,
        roll: first.enrollment.roll,
        class: first.enrollment.class,
        section: first.enrollment.section,
        year: first.enrollment.year,
      },
      exam_name: exam,
      result_date: first.exam?.result_date ?? null,
      rows,
      total,
      total_full,
    };
  }

  /** Synthetic student user so generateMarksheetPDF's checkAccess passes. */
  static synthUser(studentId: number) {
    return { id: studentId, role: 'student' };
  }

  static async assertExamPublished(exam: string) {
    return this.assertPublished(exam);
  }
}
