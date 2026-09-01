import type { Prisma } from '@/generated/prisma/client.js';
import { prisma } from '@/config/prisma.js';
import { ApiError } from '@/utils/ApiError.js';
import { planYearEndCascade } from './exam-year-end.js';

type ExamTypeInput = {
  name: string;
  is_year_end?: boolean;
  sort_order?: number;
  assign_to_new_schools?: boolean;
  school_ids?: number[];
};

export class ExamTypeService {
  static async listAll() {
    const types = await prisma.exam_types.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: {
        assignments: { select: { school_id: true } },
        exams: {
          select: {
            exam_year: true,
            exam_name: true,
            levels: true,
            school: { select: { id: true, name: true } },
          },
          orderBy: [{ exam_year: 'desc' }, { id: 'asc' }],
        },
      },
    });

    return types.map(({ assignments, exams, ...type }) => ({
      ...type,
      school_ids: assignments.map((row) => row.school_id),
      exam_count: exams.length,
      used_by: exams.map((exam) => ({
        school_id: exam.school.id,
        school_name: exam.school.name,
        exam_year: exam.exam_year,
        exam_name: exam.exam_name,
        levels: exam.levels,
      })),
    }));
  }

  static async listAssigned() {
    const rows = await prisma.school_exam_types.findMany({
      include: { exam_type: true },
    });

    return rows
      .map((row) => row.exam_type)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  static async create(data: ExamTypeInput) {
    const name = data.name.trim();
    const exists = await prisma.exam_types.findFirst({ where: { name } });
    if (exists) {
      throw new ApiError(400, `Exam type "${name}" already exists`);
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.exam_types.create({
        data: {
          name,
          is_year_end: data.is_year_end ?? false,
          sort_order: data.sort_order ?? 0,
          assign_to_new_schools: data.assign_to_new_schools ?? false,
        },
      });

      if (data.school_ids) {
        await ExamTypeService.replaceAssignments(tx, created.id, data.school_ids);
      }
      return created;
    });
  }

  static async update(id: number, data: ExamTypeInput) {
    const existing = await prisma.exam_types.findFirst({ where: { id } });
    if (!existing) {
      throw new ApiError(404, 'Exam type not found');
    }

    const name = data.name.trim();
    const clash = await prisma.exam_types.findFirst({
      where: { name, id: { not: id } },
    });
    if (clash) {
      throw new ApiError(400, `Exam type "${name}" already exists`);
    }

    const nextFlag = data.is_year_end ?? false;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.exam_types.update({
        where: { id },
        data: {
          name,
          is_year_end: nextFlag,
          sort_order: data.sort_order ?? 0,
          assign_to_new_schools: data.assign_to_new_schools ?? false,
        },
      });

      if (data.school_ids) {
        await ExamTypeService.replaceAssignments(tx, id, data.school_ids);
      }

      const instances = await tx.exams.findMany({
        where: { exam_type_id: id },
        select: {
          id: true,
          school_id: true,
          exam_year: true,
          levels: true,
          result_date: true,
          is_year_end: true,
        },
      });
      const others = nextFlag
        ? await tx.exams.findMany({
            where: { is_year_end: true, exam_type_id: { not: id } },
            select: {
              school_id: true,
              exam_year: true,
              exam_name: true,
              levels: true,
            },
          })
        : [];

      const plan = planYearEndCascade(nextFlag, instances, others);
      if (plan.updateIds.length > 0) {
        await tx.exams.updateMany({
          where: { id: { in: plan.updateIds } },
          data: { is_year_end: nextFlag },
        });
      }

      return {
        ...updated,
        cascade: {
          updated: plan.updateIds.length,
          skipped_frozen: plan.skippedFrozen,
          skipped_overlap: plan.skippedOverlap,
        },
      };
    });
  }

  static async delete(id: number) {
    const existing = await prisma.exam_types.findFirst({ where: { id } });
    if (!existing) {
      throw new ApiError(404, 'Exam type not found');
    }

    const examCount = await prisma.exams.count({ where: { exam_type_id: id } });
    if (examCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete "${existing.name}": ${examCount} existing exam${examCount === 1 ? '' : 's'} still use it`,
      );
    }

    await prisma.exam_types.delete({ where: { id } });
    return existing;
  }

  static async setSchoolTypes(schoolId: number, examTypeIds: number[]) {
    const school = await prisma.school.findFirst({ where: { id: schoolId } });
    if (!school) {
      throw new ApiError(404, 'School not found');
    }

    if (examTypeIds.length > 0) {
      const found = await prisma.exam_types.count({ where: { id: { in: examTypeIds } } });
      if (found !== examTypeIds.length) {
        throw new ApiError(400, 'One or more exam types do not exist');
      }
    }

    const uniqueIds = [...new Set(examTypeIds)];
    await prisma.$transaction(async (tx) => {
      await tx.school_exam_types.deleteMany({ where: { school_id: schoolId } });
      if (uniqueIds.length === 0) return;
      await tx.school_exam_types.createMany({
        data: uniqueIds.map((exam_type_id) => ({ school_id: schoolId, exam_type_id })),
      });
    });

    return { school_id: schoolId, exam_type_ids: uniqueIds };
  }

  private static async replaceAssignments(
    tx: Prisma.TransactionClient,
    examTypeId: number,
    schoolIds: number[],
  ) {
    await tx.school_exam_types.deleteMany({ where: { exam_type_id: examTypeId } });
    if (schoolIds.length === 0) return;
    await tx.school_exam_types.createMany({
      data: schoolIds.map((school_id) => ({ school_id, exam_type_id: examTypeId })),
    });
  }
}
