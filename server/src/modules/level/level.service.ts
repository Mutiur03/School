import { prisma } from "@/config/prisma.js";
import { type LevelFormSchemaData } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";

async function invalidateMarksheetsForLevel(
  className: number,
  section: string,
  year: number,
): Promise<void> {
  try {
    const { MarksheetService } = await import(
      "../marks/marksheet.service.js"
    );
    await MarksheetService.invalidateForClassSection(className, section, year);
  } catch (err) {
    console.warn(
      "Marksheet invalidation failed after level change:",
      err instanceof Error ? err.message : err,
    );
  }
}

export class LevelService {
  static async addLevel(data: LevelFormSchemaData) {
    const result = await prisma.levels.create({
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });
    await invalidateMarksheetsForLevel(
      result.class_name,
      result.section,
      result.year,
    );
    return result;
  }

  static async getAllLevels() {
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
      orderBy: [{ class_name: "asc" }, { section: "asc" }],
    });

    return result.map((level) => ({
      id: level.id,
      class_name: level.class_name,
      section: level.section,
      year: level.year,
      teacher_name: level.teacher?.name || "Unknown",
      teacher_id: level.teacher?.id,
      teacher_available: level.teacher?.available ?? false,
    }));
  }

  static async updateLevel(id: number, data: LevelFormSchemaData) {
    // Check if level exists
    const existingLevel = await prisma.levels.findUnique({ where: { id } });
    if (!existingLevel) {
      throw new ApiError(404, "Level assignment not found");
    }

    const result = await prisma.levels.update({
      where: { id },
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });

    await invalidateMarksheetsForLevel(
      existingLevel.class_name,
      existingLevel.section,
      existingLevel.year,
    );
    if (
      existingLevel.class_name !== data.class_name ||
      existingLevel.section !== data.section ||
      existingLevel.year !== data.year
    ) {
      await invalidateMarksheetsForLevel(
        data.class_name,
        data.section,
        data.year,
      );
    }

    return result;
  }

  static async deleteLevel(id: number) {
    // Check if level exists
    const existingLevel = await prisma.levels.findUnique({ where: { id } });
    if (!existingLevel) {
      throw new ApiError(404, "Level assignment not found");
    }

    const result = await prisma.levels.delete({
      where: { id },
    });

    await invalidateMarksheetsForLevel(
      existingLevel.class_name,
      existingLevel.section,
      existingLevel.year,
    );

    return result;
  }
}
