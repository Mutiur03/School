import { prisma } from "@/config/prisma.js";
import { type LevelFormSchemaData } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";

export class LevelService {
  static async addLevel(data: LevelFormSchemaData) {
    return await prisma.levels.create({
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });
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

    return await prisma.levels.update({
      where: { id },
      data: {
        class_name: data.class_name,
        section: data.section,
        year: data.year,
        teacher_id: data.teacher_id,
      },
    });
  }

  static async deleteLevel(id: number) {
    // Check if level exists
    const existingLevel = await prisma.levels.findUnique({ where: { id } });
    if (!existingLevel) {
      throw new ApiError(404, "Level assignment not found");
    }

    return await prisma.levels.delete({
      where: { id },
    });
  }
}
