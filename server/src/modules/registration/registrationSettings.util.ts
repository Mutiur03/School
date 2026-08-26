import { prisma } from '@/config/prisma.js';
import { removeInitialZeros } from '@school/shared-schemas';
import { ApiError } from '@/utils/ApiError.js';

export function parseRegistrationYear(raw: unknown, label: string): number {
  const year = raw ? parseInt(String(raw), 10) : NaN;
  if (!Number.isInteger(year)) {
    throw new ApiError(400, label);
  }
  return year;
}

export function parseOptionalRegistrationYear(raw: unknown): number | undefined {
  const year = Number(raw);
  return Number.isInteger(year) ? year : undefined;
}

export async function resolveRegistrationClassmates(
  schoolId: number,
  stored: string | null,
  source: string | null | undefined,
  enrollmentYear: number | null | undefined,
  studentClass: number,
): Promise<string | null> {
  if (source !== 'default' || !enrollmentYear) {
    return stored;
  }

  const enrollments = await prisma.student_enrollments.findMany({
    where: { school_id: schoolId, year: enrollmentYear, class: studentClass },
    include: { student: { select: { name: true } } },
    orderBy: { student: { name: 'asc' } },
  });

  return enrollments
    .map((en) => {
      const name = en.student.name;
      const section = en.section || '';
      const roll = en.roll ? removeInitialZeros(String(en.roll)) : '';
      return section && roll ? `${name}/${section}-${roll}` : name;
    })
    .join('\n');
}
