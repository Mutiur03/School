import { prisma } from "@/config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "@/config/r2.js";
import path from "path";
import { removeInitialZeros } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";

export class RegistrationSettingsClass9Service {
  static async createOrUpdateClass9Reg(data: any) {
    const {
      a_sec_roll,
      b_sec_roll,
      ssc_year,
      class9_year,
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
      ssc_year: ssc_year
        ? parseInt(String(ssc_year), 10)
        : class9_year
          ? parseInt(String(class9_year), 10)
          : null,
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
      const existingRecord = await prisma.ssc_reg.findFirst();
      if (
        existingRecord &&
        existingRecord.notice &&
        existingRecord.notice !== notice_key
      ) {
        await deleteFromR2(existingRecord.notice);
      }
      updateData.notice = notice_key;
    }

    return await prisma.ssc_reg.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...updateData,
      },
    });
  }

  static async getClass9Reg() {
    const class9Reg = await prisma.ssc_reg.findFirst();

    if (!class9Reg) {
      return {
        id: 0,
        a_sec_roll: null,
        b_sec_roll: null,
        class9_year: new Date().getFullYear(),
        reg_open: false,
        instruction_for_a: "Please follow the instructions carefully",
        instruction_for_b: "Please follow the instructions carefully",
        attachment_instruction: "Please attach all required documents",
        notice: null,
        classmates: null,
        classmates_source: "default",
      };
    }

    let resolvedClassmates = class9Reg.classmates;

    if (class9Reg.classmates_source === "default" && class9Reg.ssc_year) {
      const enrollments = await prisma.student_enrollments.findMany({
        where: {
          year: (class9Reg.ssc_year as number) - 2,
          class: 9,
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
        .join("\n");
    }

    return {
      ...class9Reg,
      ssc_year: class9Reg.ssc_year,
      class9_year: class9Reg.ssc_year,
      classmates: resolvedClassmates,
    };
  }

  static async deleteClass9RegNotice() {
    const class9Reg = await prisma.ssc_reg.findFirst();

    if (!class9Reg || !class9Reg.notice) {
      throw new ApiError(404, "No notice found to delete");
    }

    await deleteFromR2(class9Reg.notice);

    await prisma.ssc_reg.update({
      where: { id: class9Reg.id },
      data: { notice: null },
    });

    return true;
  }

  static async getClass9NoticeUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, "Filename and filetype are required");
    }

    const ext = path.extname(filename);
    const key = `notices/registrations/notice-class-9-${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    return { uploadUrl: url, key };
  }
}
