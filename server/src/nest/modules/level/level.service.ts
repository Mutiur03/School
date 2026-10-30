import { Injectable } from '@nestjs/common';
import { prisma } from '@/config/prisma.js';
import { MarksheetCacheService } from '../marksheets/cache/marksheet-cache.service.js';
import { type LevelFormSchemaData } from '@school/shared-schemas';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';

@Injectable()
export class LevelService {
  constructor(private readonly marksheetCache: MarksheetCacheService) {}

  private async invalidateMarksheetsForLevel(
    className: number,
    section: string,
    year: number,
  ): Promise<void> {
    try {
      await this.marksheetCache.invalidateForClassSection(
        requireSchoolId(),
        className,
        section,
        year,
      );
    } catch (err) {
      console.warn(
        'Marksheet invalidation failed after level change:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /** FK checks bypass RLS, so a teacher id from another school must be refused explicitly. */
  private async assertTeacherInSchool(teacherId: number) {
    const teacher = await prisma.teachers.findFirst({
      where: { id: teacherId, school_id: requireSchoolId() },
      select: { id: true },
    });
    if (!teacher) throw new ApiError(404, 'Teacher not found');
  }

  async addLevel(data: LevelFormSchemaData) {
    await this.assertTeacherInSchool(data.teacher_id);
    const result = await prisma.levels.create({
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });
    await this.invalidateMarksheetsForLevel(result.class_name, result.section, result.year);
    return result;
  }

  async getAllLevels() {
    const result = await prisma.levels.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            available: true,
          },
        },
      },
      orderBy: [{ class_name: 'asc' }, { section: 'asc' }],
    });

    return result.map((level) => ({
      id: level.id,
      class_name: level.class_name,
      section: level.section,
      year: level.year,
      teacher_name: level.teacher?.name || 'Unknown',
      teacher_id: level.teacher?.id,
      teacher_available: level.teacher?.available ?? false,
    }));
  }

  /** PATCH may send any subset of the form (missing = keep). */
  async updateLevel(id: number, patch: Partial<LevelFormSchemaData>) {
    // Check if level exists
    const existingLevel = await prisma.levels.findUnique({ where: { id } });
    if (!existingLevel) {
      throw new ApiError(404, 'Level assignment not found');
    }
    if (patch.teacher_id !== undefined) await this.assertTeacherInSchool(patch.teacher_id);
    const data = {
      class_name: patch.class_name ?? existingLevel.class_name,
      section: patch.section ?? existingLevel.section,
      year: patch.year ?? existingLevel.year,
      teacher_id: patch.teacher_id ?? existingLevel.teacher_id,
    };

    const result = await prisma.levels.update({
      where: { id },
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });

    await this.invalidateMarksheetsForLevel(
      existingLevel.class_name,
      existingLevel.section,
      existingLevel.year,
    );
    if (
      existingLevel.class_name !== data.class_name ||
      existingLevel.section !== data.section ||
      existingLevel.year !== data.year
    ) {
      await this.invalidateMarksheetsForLevel(data.class_name, data.section, data.year);
    }

    return result;
  }

  async deleteLevel(id: number) {
    // Check if level exists
    const existingLevel = await prisma.levels.findUnique({ where: { id } });
    if (!existingLevel) {
      throw new ApiError(404, 'Level assignment not found');
    }

    const result = await prisma.levels.delete({
      where: { id },
    });

    await this.invalidateMarksheetsForLevel(
      existingLevel.class_name,
      existingLevel.section,
      existingLevel.year,
    );

    return result;
  }
}
