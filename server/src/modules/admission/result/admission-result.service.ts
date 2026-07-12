import path from "path";
import crypto from "crypto";
import { prisma } from "@/config/prisma.js";
import {
  completeMultipartUpload,
  createMultipartUpload,
  deleteFromR2,
  getMultipartPartUrl,
  getUploadUrl,
} from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";
import type {
  AdmissionResultCreateData,
  AdmissionResultMultipartCompleteData,
  AdmissionResultMultipartSignData,
  AdmissionResultUpdateData,
  AdmissionResultUploadRequestData,
} from "@school/shared-schemas";

const CONFIG = {
  MULTIPART_THRESHOLD: 50 * 1024 * 1024,
  CHUNK_SIZE: 10 * 1024 * 1024,
} as const;

const VALID_RESULT_TYPES = [
  "merit_list",
  "waiting_list_1",
  "waiting_list_2",
] as const;

type ResultType = (typeof VALID_RESULT_TYPES)[number];

function generateKey(
  filename: string,
  className: string,
  admissionYear: number | string,
  type: string,
) {
  const safeClassName = String(className)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_");
  const safeYear = String(admissionYear).trim();
  const ext = path.extname(filename);
  const safeFilename = `${type}-${safeYear}-${Date.now()}-${crypto.randomUUID()}${ext}`;
  return `admission-results/${safeYear}/class-${safeClassName}/${safeFilename}`;
}

export class AdmissionResultService {
  static async getAdmissionResults(filters: {
    class_name?: string;
    admission_year?: string;
  }) {
    const whereCondition: {
      class_name?: string;
      admission_year?: number;
    } = {};

    if (filters.class_name) {
      whereCondition.class_name = filters.class_name;
    }
    if (filters.admission_year) {
      whereCondition.admission_year = parseInt(filters.admission_year, 10);
    }

    return prisma.admission_result.findMany({
      where: whereCondition,
      orderBy: [{ admission_year: "desc" }, { class_name: "asc" }],
    });
  }

  static async getAdmissionResultById(id: number) {
    const result = await prisma.admission_result.findUnique({
      where: { id },
    });

    if (!result) {
      throw new ApiError(404, "Admission result not found");
    }

    return result;
  }

  static async createAdmissionResult(data: AdmissionResultCreateData) {
    const existingResult = await prisma.admission_result.findFirst({
      where: {
        class_name: data.class_name,
        admission_year: data.admission_year,
      },
    });

    if (existingResult) {
      throw new ApiError(
        409,
        `Result already exists for Class ${data.class_name} - Year ${data.admission_year}. Please update the existing result instead.`,
      );
    }

    return prisma.admission_result.create({
      data: {
        class_name: data.class_name,
        admission_year: data.admission_year,
        merit_list: data.merit_list ?? null,
        merit_list_public_id: data.merit_list ? "r2" : null,
        waiting_list_1: data.waiting_list_1 ?? null,
        waiting_list_1_public_id: data.waiting_list_1 ? "r2" : null,
        waiting_list_2: data.waiting_list_2 ?? null,
        waiting_list_2_public_id: data.waiting_list_2 ? "r2" : null,
      },
    });
  }

  static async updateAdmissionResult(
    id: number,
    data: AdmissionResultUpdateData,
  ) {
    const existingResult = await prisma.admission_result.findUnique({
      where: { id },
    });

    if (!existingResult) {
      throw new ApiError(404, "Admission result not found");
    }

    const updateData: Record<string, string | number | null> = {};

    if (data.class_name) {
      updateData.class_name = data.class_name;
    }
    if (data.admission_year) {
      updateData.admission_year = data.admission_year;
    }

    if (data.merit_list !== undefined) {
      if (
        existingResult.merit_list &&
        existingResult.merit_list !== data.merit_list
      ) {
        await deleteFromR2(existingResult.merit_list);
      }
      updateData.merit_list = data.merit_list;
      updateData.merit_list_public_id = data.merit_list ? "r2" : null;
    }

    if (data.waiting_list_1 !== undefined) {
      if (
        existingResult.waiting_list_1 &&
        existingResult.waiting_list_1 !== data.waiting_list_1
      ) {
        await deleteFromR2(existingResult.waiting_list_1);
      }
      updateData.waiting_list_1 = data.waiting_list_1;
      updateData.waiting_list_1_public_id = data.waiting_list_1 ? "r2" : null;
    }

    if (data.waiting_list_2 !== undefined) {
      if (
        existingResult.waiting_list_2 &&
        existingResult.waiting_list_2 !== data.waiting_list_2
      ) {
        await deleteFromR2(existingResult.waiting_list_2);
      }
      updateData.waiting_list_2 = data.waiting_list_2;
      updateData.waiting_list_2_public_id = data.waiting_list_2 ? "r2" : null;
    }

    return prisma.admission_result.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteAdmissionResult(id: number) {
    const existingResult = await prisma.admission_result.findUnique({
      where: { id },
    });

    if (!existingResult) {
      throw new ApiError(404, "Admission result not found");
    }

    if (existingResult.merit_list) {
      await deleteFromR2(existingResult.merit_list);
    }
    if (existingResult.waiting_list_1) {
      await deleteFromR2(existingResult.waiting_list_1);
    }
    if (existingResult.waiting_list_2) {
      await deleteFromR2(existingResult.waiting_list_2);
    }

    await prisma.admission_result.delete({
      where: { id },
    });
  }

  static async handleUploadRequest(data: AdmissionResultUploadRequestData) {
    const results = await Promise.all(
      data.files.map(async (file) => {
        const { filename, contentType, fileSize, type } = file;

        if (!VALID_RESULT_TYPES.includes(type as ResultType)) {
          return {
            success: false,
            filename,
            error: `Invalid result type: ${type}`,
          };
        }

        const key = generateKey(
          filename,
          data.className,
          data.admissionYear,
          type,
        );

        if (fileSize > CONFIG.MULTIPART_THRESHOLD) {
          try {
            const uploadId = await createMultipartUpload(key, contentType);
            return {
              success: true,
              mode: "multipart" as const,
              filename,
              type,
              key,
              uploadId,
              chunkSize: CONFIG.CHUNK_SIZE,
              endpoints: {
                signPart: "/api/admission-result/multipart/sign-part",
                complete: "/api/admission-result/multipart/complete",
              },
            };
          } catch (err) {
            console.error("Multipart init error:", err);
            return {
              success: false,
              filename,
              error: "Failed to init multipart upload",
            };
          }
        }

        try {
          const url = await getUploadUrl(key, contentType);
          return {
            success: true,
            mode: "simple" as const,
            filename,
            type,
            key,
            uploadUrl: url,
          };
        } catch (err) {
          console.error("Simple auth error:", err);
          return {
            success: false,
            filename,
            error: "Failed to generate upload URL",
          };
        }
      }),
    );

    return {
      success: !results.some((result) => !result.success),
      data: results,
    };
  }

  static async signMultipartUploadPart(data: AdmissionResultMultipartSignData) {
    const url = await getMultipartPartUrl(
      data.key,
      data.uploadId,
      data.partNumber,
    );
    return { success: true, url };
  }

  static async completeMultipartUploadHandler(
    data: AdmissionResultMultipartCompleteData,
  ) {
    await completeMultipartUpload(data.key, data.uploadId, data.parts);
    return { success: true, key: data.key };
  }
}
