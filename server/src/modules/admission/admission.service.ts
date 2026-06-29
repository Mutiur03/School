import path from "path";
import { prisma } from "@/config/prisma.js";
import { getRlsContext } from "@/config/rlsContextStore.js";
import { deleteFromR2, getUploadUrl } from "@/config/r2.js";
import { redis } from "@/config/redis.js";
import { SHORT_TERM_CACHE_TTL } from "@/utils/globalVars.js";
import { ApiError } from "@/utils/ApiError.js";
import type {
  AdmissionNoticeUploadData,
  AdmissionSettingsData,
} from "@school/shared-schemas";

const defaultAdmission = {
  id: 0,
  preview_url: null,
  download_url: null,
  public_id: null,
  admission_open: false,
  admission_year: new Date().getFullYear(),
  instruction: "Please follow the instructions carefully",
  attachment_instruction_class6: null,
  attachment_instruction_class7: null,
  attachment_instruction_class8: null,
  attachment_instruction_class9: null,
  ingikar: null,
  class_list: null,
  list_type_class6: null,
  list_type_class7: null,
  list_type_class8: null,
  list_type_class9: null,
  user_id_class6: null,
  user_id_class7: null,
  user_id_class8: null,
  user_id_class9: null,
  serial_no_class6: null,
  serial_no_class7: null,
  serial_no_class8: null,
  serial_no_class9: null,
  notice_key: null,
};

export class AdmissionService {
  private static getCacheKey() {
    const schoolId = getRlsContext()?.schoolId;
    return schoolId ? `admission:${schoolId}` : "admission";
  }

  private static async clearCache() {
    await redis.del(this.getCacheKey());
  }

  static formatAdmission(record: Record<string, unknown> | null) {
    if (!record) return defaultAdmission;

    return {
      ...record,
      notice_key: record.preview_url,
      preview_url: record.preview_url,
      download_url: record.preview_url
    };
  }

  static async createOrUpdateAdmission(data: AdmissionSettingsData) {
    const updateData: Record<string, unknown> = {};

    if (data.admission_year !== undefined && data.admission_year !== null) {
      updateData.admission_year = Number(data.admission_year);
    }

    if (data.admission_open !== undefined) {
      updateData.admission_open =
        data.admission_open === true ||
        data.admission_open === "true" ||
        data.admission_open === "1";
    }

    const stringFields = [
      "instruction",
      "attachment_instruction_class6",
      "attachment_instruction_class7",
      "attachment_instruction_class8",
      "attachment_instruction_class9",
      "ingikar",
      "class_list",
      "list_type_class6",
      "list_type_class7",
      "list_type_class8",
      "list_type_class9",
      "user_id_class6",
      "user_id_class7",
      "user_id_class8",
      "user_id_class9",
      "serial_no_class6",
      "serial_no_class7",
      "serial_no_class8",
      "serial_no_class9",
    ] as const;

    for (const field of stringFields) {
      if (data[field] !== undefined) {
        updateData[field] = String(data[field]);
      }
    }

    if (data.notice_key) {
      const existing = await prisma.admission.findFirst();
      const existingKey = existing?.preview_url;

      if (existingKey && existingKey !== data.notice_key) {
        await deleteFromR2(existingKey);
      }

      updateData.public_id = data.notice_key;
      updateData.preview_url = data.notice_key;
      updateData.download_url = data.notice_key;
    }

    const notice = await prisma.admission.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        preview_url: (updateData.preview_url as string | null | undefined) ?? null,
        download_url:
          (updateData.download_url as string | null | undefined) ?? null,
        public_id: (updateData.public_id as string | null | undefined) ?? null,
        admission_year:
          (updateData.admission_year as number | null | undefined) ?? null,
        admission_open:
          (updateData.admission_open as boolean | null | undefined) ?? false,
        instruction:
          (updateData.instruction as string | null | undefined) ?? null,
        attachment_instruction_class6:
          (updateData.attachment_instruction_class6 as
            | string
            | null
            | undefined) ?? null,
        attachment_instruction_class7:
          (updateData.attachment_instruction_class7 as
            | string
            | null
            | undefined) ?? null,
        attachment_instruction_class8:
          (updateData.attachment_instruction_class8 as
            | string
            | null
            | undefined) ?? null,
        attachment_instruction_class9:
          (updateData.attachment_instruction_class9 as
            | string
            | null
            | undefined) ?? null,
        ingikar: (updateData.ingikar as string | null | undefined) ?? null,
        class_list:
          (updateData.class_list as string | null | undefined) ?? null,
        list_type_class6:
          (updateData.list_type_class6 as string | null | undefined) ?? null,
        list_type_class7:
          (updateData.list_type_class7 as string | null | undefined) ?? null,
        list_type_class8:
          (updateData.list_type_class8 as string | null | undefined) ?? null,
        list_type_class9:
          (updateData.list_type_class9 as string | null | undefined) ?? null,
        user_id_class6:
          (updateData.user_id_class6 as string | null | undefined) ?? null,
        user_id_class7:
          (updateData.user_id_class7 as string | null | undefined) ?? null,
        user_id_class8:
          (updateData.user_id_class8 as string | null | undefined) ?? null,
        user_id_class9:
          (updateData.user_id_class9 as string | null | undefined) ?? null,
        serial_no_class6:
          (updateData.serial_no_class6 as string | null | undefined) ?? null,
        serial_no_class7:
          (updateData.serial_no_class7 as string | null | undefined) ?? null,
        serial_no_class8:
          (updateData.serial_no_class8 as string | null | undefined) ?? null,
        serial_no_class9:
          (updateData.serial_no_class9 as string | null | undefined) ?? null,
      },
    });

    await this.clearCache();
    return this.formatAdmission(notice as Record<string, unknown>);
  }

  static async getAdmission() {
    const cacheKey = this.getCacheKey();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await prisma.admission.findFirst();
    const formatted = this.formatAdmission(
      (data as Record<string, unknown> | null) ?? null,
    );

    await redis.set(cacheKey, JSON.stringify(formatted), "EX", SHORT_TERM_CACHE_TTL);
    return formatted;
  }

  static async deleteAdmissionNotice() {
    const existing = await prisma.admission.findFirst();
    if (!existing) {
      throw new ApiError(404, "Admission not found");
    }

    const storageKey = existing.preview_url;
    if (storageKey) {
      await deleteFromR2(storageKey);
    }

    const updated = await prisma.admission.update({
      where: { id: existing.id },
      data: {
        preview_url: null,
        download_url: null,
        public_id: null,
      },
    });

    await this.clearCache();
    return this.formatAdmission(updated as Record<string, unknown>);
  }

  static async getNoticeUploadUrl(data: AdmissionNoticeUploadData) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, "Filename and filetype are required");
    }

    const ext = path.extname(filename) || ".pdf";
    const key = `notices/admission-notice-${Date.now()}${ext}`;
    const uploadUrl = await getUploadUrl(key, filetype);

    return { uploadUrl, key };
  }
}
