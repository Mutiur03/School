import jwt from "jsonwebtoken";
import { prisma } from "@/config/prisma.js";
import { env } from "@/config/env.js";
import { ApiError } from "@/utils/ApiError.js";

const PUBLIC_RESULT_ROLE = "public_result";
const TOKEN_TTL = "15m";

export interface PublicResultTokenPayload {
  id: number;
  role: typeof PUBLIC_RESULT_ROLE;
}

function signPublicResultToken(studentId: number): string {
  return jwt.sign(
    { id: studentId, role: PUBLIC_RESULT_ROLE },
    env.JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

/** Verify a public-result token. Throws ApiError(401) on any problem. */
export function verifyPublicResultToken(
  token: string | undefined,
): PublicResultTokenPayload {
  if (!token) throw new ApiError(401, "Unauthorized");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as PublicResultTokenPayload;
    if (!decoded || decoded.role !== PUBLIC_RESULT_ROLE || !decoded.id) {
      throw new ApiError(401, "Invalid token");
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Session expired. Please log in again.");
    }
    throw new ApiError(401, "Invalid token");
  }
}

export class PublicResultService {
  /**
   * Match a student by login_id + (father_phone OR mother_phone) within the
   * current school (Prisma queries are RLS-scoped by resolved subdomain).
   * Returns a short-lived token plus the published sessions/exams available.
   */
  static async verify(loginId: string, phone: string) {
    const login = String(loginId ?? "").trim();
    const phoneTrim = String(phone ?? "").trim();

    if (!/^\d+$/.test(login)) {
      throw new ApiError(400, "Login ID must be numeric");
    }
    if (!/^\d{11}$/.test(phoneTrim)) {
      throw new ApiError(400, "Phone number must be 11 digits");
    }

    let loginBig: bigint;
    try {
      loginBig = BigInt(login);
    } catch {
      throw new ApiError(400, "Invalid login ID");
    }

    const student = await prisma.students.findFirst({
      where: {
        login_id: loginBig,
        available: true,
        OR: [{ father_phone: phoneTrim }, { mother_phone: phoneTrim }],
      },
      select: { id: true, name: true },
    });

    if (!student) {
      throw new ApiError(401, "Invalid login ID or phone number");
    }

    // Only published exams (visible=true) with actual marks.
    const marks = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: student.id },
        exam: { visible: true },
        marks: { not: null },
      },
      select: {
        enrollment: { select: { year: true } },
        exam: { select: { exam_name: true, result_date: true } },
      },
    });

    const byYear = new Map<
      number,
      Map<string, string | null>
    >();
    for (const m of marks) {
      const year = m.enrollment.year;
      const name = m.exam.exam_name;
      if (!byYear.has(year)) byYear.set(year, new Map());
      const exams = byYear.get(year)!;
      if (!exams.has(name)) exams.set(name, m.exam.result_date ?? null);
    }

    const sessions = Array.from(byYear.entries())
      .map(([year, exams]) => ({
        year,
        exams: Array.from(exams.entries()).map(([exam_name, result_date]) => ({
          exam_name,
          result_date,
        })),
      }))
      .sort((a, b) => b.year - a.year);

    if (sessions.length === 0) {
      throw new ApiError(404, "No published result found for this student");
    }

    return {
      token: signPublicResultToken(student.id),
      student: { id: student.id, name: student.name },
      sessions,
    };
  }

  /** Guard: exam must exist and be published (visible). Throws otherwise. */
  private static async assertPublished(exam: string) {
    const examRow = await prisma.exams.findFirst({
      where: { exam_name: exam, visible: true },
      select: { id: true },
    });
    if (!examRow) {
      throw new ApiError(404, "Result not published");
    }
  }

  /** On-screen marks table for a single published exam. */
  static async getExamResult(studentId: number, year: string, exam: string) {
    await this.assertPublished(exam);
    const yearInt = parseInt(year);

    const marks = await prisma.marks.findMany({
      where: {
        enrollment: { student_id: studentId, year: yearInt },
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
      throw new ApiError(404, "No result found for this student");
    }

    const first = marks[0];
    const subjectTotals: Record<
      string,
      { marks: number; full_mark: number; priority: number }
    > = {};

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
    return { id: studentId, role: "student" };
  }

  static async assertExamPublished(exam: string) {
    return this.assertPublished(exam);
  }
}
