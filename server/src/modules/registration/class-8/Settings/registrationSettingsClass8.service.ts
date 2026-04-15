import { prisma } from "@/config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "@/config/r2.js";
import path from "path";
import { removeInitialZeros } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";

export class RegistrationSettingsClass8Service {
  static async createOrUpdateClass8Reg(data: any) {
    const {
      a_sec_roll,
      b_sec_roll,
      class8_year,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
      notice_key,
      classmates,
      classmates_source,
    } = data;

    let updateData: any = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      class8_year: class8_year ? parseInt(class8_year, 10) : null,
      reg_open: reg_open === "true" || reg_open === true,
      instruction_for_a:
        instruction_for_a || "Please follow the instructions carefully",
      instruction_for_b:
        instruction_for_b || "Please follow the instructions carefully",
      attachment_instruction:
        attachment_instruction || "Please attach all required documents",
      classmates: classmates || null,
      classmates_source: classmates_source || "default",
      notice: null,
    };

    if (notice_key) {
      const existingRecord = await prisma.class8_reg.findFirst();
      if (
        existingRecord &&
        existingRecord.notice &&
        existingRecord.notice !== notice_key
      ) {
        await deleteFromR2(existingRecord.notice);
      }
      updateData.notice = notice_key;
    }

    return await prisma.class8_reg.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...updateData,
      },
    });
  }

  static async getClass8Reg() {
    const class8Reg = await prisma.class8_reg.findFirst();

    if (!class8Reg) {
      return {
        id: 0,
        a_sec_roll: null,
        b_sec_roll: null,
        class8_year: new Date().getFullYear(),
        reg_open: false,
        instruction_for_a: "Please follow the instructions carefully",
        instruction_for_b: "Please follow the instructions carefully",
        attachment_instruction: "Please attach all required documents",
        notice: null,
        classmates: null,
        classmates_source: "default",
        resolvedClassmates: "",
      };
    }

    let resolvedClassmates = class8Reg.classmates;

    // If classmates_source is 'default', resolve from student enrollments
    if (class8Reg.classmates_source === "default" && class8Reg.class8_year) {
      const enrollments = await prisma.student_enrollments.findMany({
        where: {
          year: class8Reg.class8_year as number,
          class: 8,
        },
        include: {
          student: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          student: {
            name: "asc",
          },
        },
      });

      resolvedClassmates = enrollments
        .map((en: any) => {
          const name = en.student.name;
          const section = en.section || "";
          const roll = en.roll ? removeInitialZeros(String(en.roll)) : "";
          return section && roll ? `${name}/${section}-${roll}` : name;
        })
        .join(", ");
    }

    return {
      ...class8Reg,
      resolvedClassmates,
    };
  }

  static async deleteClass8RegNotice() {
    const class8Reg = await prisma.class8_reg.findFirst();

    if (!class8Reg || !class8Reg.notice) {
      throw new ApiError(404, "No notice found to delete");
    }

    await deleteFromR2(class8Reg.notice);

    await prisma.class8_reg.update({
      where: { id: class8Reg.id },
      data: { notice: null },
    });

    return true;
  }

  static async getClass8NoticeUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, "Filename and filetype are required");
    }

    const ext = path.extname(filename);
    const key = `notices/registrations/notice-class8-${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    return { uploadUrl: url, key };
  }
}
