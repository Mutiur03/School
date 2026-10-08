import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { PublicResultVerifyDto } from './dto/public-result.dto.js';
import { signPublicResultToken } from './public-result.guard.js';

/** Days between a "YYYY-MM-DD" date and today; Infinity when unparseable. */
function daysFromToday(isoDate: string | null): number {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return Math.abs(time - Date.now()) / 86_400_000;
}

/** Public result lookup (no login; school comes from the host). */
@Injectable()
export class PublicResultsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Exams of a session year that include the class, the one whose result date is nearest
   * to today first. Includes unpublished exams so the form can list them; visibility is
   * enforced when fetching marks / marksheets.
   */
  async listExams(schoolId: number, year: number, cls: number) {
    const exams = await this.prisma.exams.findMany({
      where: { school_id: schoolId, exam_year: year, levels: { has: cls } },
      select: { exam_name: true, result_date: true, visible: true },
      orderBy: [{ result_date: 'desc' }, { exam_name: 'asc' }],
    });
    // Distinct by name (levels uniqueness can yield the same name across level arrays).
    const seen = new Set<string>();
    return exams
      .filter((e) => !seen.has(e.exam_name) && !!seen.add(e.exam_name))
      .sort(
        (a, b) =>
          daysFromToday(a.result_date) - daysFromToday(b.result_date) ||
          a.exam_name.localeCompare(b.exam_name),
      );
  }

  /** Match year/class/section/roll + father or mother phone; returns a 15-minute token. */
  async verify(schoolId: number, dto: PublicResultVerifyDto) {
    const { year, class: cls, section, roll, phone } = dto;
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: {
        school_id: schoolId,
        year,
        class: cls,
        section,
        roll,
        student: { available: true, OR: [{ father_phone: phone }, { mother_phone: phone }] },
      },
      select: { student: { select: { id: true, name: true } } },
    });
    if (!enrollment) {
      throw new UnauthorizedException('Invalid session, class, section, roll, or phone number');
    }
    const { student } = enrollment;
    return {
      token: signPublicResultToken(student.id, schoolId),
      student: { id: student.id, name: student.name },
      sessions: [{ year, exams: await this.listExams(schoolId, year, cls) }],
    };
  }

  /** Exam must exist and be published (visible). */
  async assertPublished(schoolId: number, exam: string) {
    const row = await this.prisma.exams.findFirst({
      where: { school_id: schoolId, exam_name: exam, visible: true },
      select: { id: true },
    });
    if (!row) throw new ForbiddenException('The results have not been published yet.');
  }

  /** On-screen marks table (papers summed into their main subject) for one published exam. */
  async getExamResult(schoolId: number, studentId: number, year: number, exam: string) {
    await this.assertPublished(schoolId, exam);
    const marks = await this.prisma.marks.findMany({
      where: {
        school_id: schoolId,
        enrollment: { student_id: studentId, year },
        exam: { exam_name: exam, visible: true },
      },
      include: {
        enrollment: { include: { student: { select: { name: true } } } },
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
    if (!marks.some((m) => m.marks !== null)) {
      throw new NotFoundException('No result found for this student');
    }

    const totals = new Map<string, { marks: number; full_mark: number; priority: number }>();
    for (const m of marks) {
      const name = m.subject.parent?.name || m.subject.name;
      const t = totals.get(name) ?? { marks: 0, full_mark: 0, priority: m.subject.priority ?? 0 };
      t.marks += m.marks ?? 0;
      t.full_mark += m.subject.full_mark ?? 0;
      totals.set(name, t);
    }
    const rows = [...totals]
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([subject, t]) => ({ subject, marks: t.marks, full_mark: t.full_mark }));

    const { enrollment } = marks[0];
    return {
      student: {
        name: enrollment.student.name,
        roll: enrollment.roll,
        class: enrollment.class,
        section: enrollment.section,
        year: enrollment.year,
      },
      exam_name: exam,
      result_date: marks[0].exam?.result_date ?? null,
      rows,
      total: rows.reduce((sum, r) => sum + r.marks, 0),
      total_full: rows.reduce((sum, r) => sum + r.full_mark, 0),
    };
  }
}
