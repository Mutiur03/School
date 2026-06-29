import { prisma } from "@/config/prisma.js";
import { deleteFromR2, getUploadUrl } from "@/config/r2.js";
import { redis } from "@/config/redis.js";
import { LONG_TERM_CACHE_TTL } from "@/utils/globalVars.js";
import { ApiError } from "@/utils/ApiError.js";


export class CitizenCharterService {
  async getPresignedUploadUrl(filename: string, contentType: string) {
    if (contentType !== "application/pdf") {
      throw new ApiError(400, "Only PDF files are allowed");
    }

    const key = `citizen-charter/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  async upsertCharter(key: string, schoolId?: number) {
    const existing = await prisma.citizenCharter.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: "desc" },
    });

    if (existing?.public_id && existing.public_id!=key) {
      await deleteFromR2(existing.public_id);
    }

    const data = {
      file: key,
      download_url: key,
      public_id: key,
      ...(schoolId ? { school_id: schoolId } : {}),
      updated_at: new Date(),
    };

    const result = existing
      ? await prisma.citizenCharter.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.citizenCharter.create({ data });

    return result;
  }

  async getCharter(schoolId?: number) {
    const charter = await prisma.citizenCharter.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: "desc" },
    });

    if (!charter) {
      throw new ApiError(404, "Citizen charter not found");
    }
    return charter;
  }
}
