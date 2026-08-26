import { prisma } from '@/config/prisma.js';
import { redis } from '@/config/redis.js';
import { getRlsContext } from '@/config/rlsContextStore.js';
import { env } from '@/config/env.js';
import { ApiError } from '@/utils/ApiError.js';
import {
  deleteFromR2IfPresent,
  pdfDocFields,
  presignTenantUpload,
  swapR2Key,
} from '@/utils/r2Key.util.js';

const cacheKey = () => {
  const schoolId = getRlsContext()?.schoolId;
  return schoolId ? `class_routine_pdfs:${schoolId}` : 'class_routine_pdfs';
};

const invalidateCache = () => {
  redis.del(cacheKey()).catch(() => {});
};

export class ClassRoutineService {
  static getPresignedUploadUrl(filename: string, contentType: string) {
    return presignTenantUpload('class_routines', filename, contentType);
  }

  static async createPdf(key: string) {
    const pdf = await prisma.class_routine_pdf.create({
      data: pdfDocFields(key),
    });

    invalidateCache();
    return pdf;
  }

  static async listPdfs() {
    const cached = await redis.get(cacheKey()).catch(() => null);
    if (cached) {
      return JSON.parse(cached);
    }

    const pdfs = await prisma.class_routine_pdf.findMany({
      orderBy: [{ id: 'desc' }],
    });

    await redis
      .set(cacheKey(), JSON.stringify(pdfs), 'EX', env.LONG_TERM_CACHE_TTL)
      .catch(() => {});
    return pdfs;
  }

  static async deletePdf(id: number) {
    const pdf = await prisma.class_routine_pdf.findUnique({ where: { id } });
    if (!pdf) {
      throw new ApiError(404, 'PDF not found');
    }

    await deleteFromR2IfPresent(pdf.public_id);
    await prisma.class_routine_pdf.delete({ where: { id } });
    invalidateCache();
  }

  static async updatePdf(id: number, key?: string) {
    const pdf = await prisma.class_routine_pdf.findUnique({ where: { id } });
    if (!pdf) {
      throw new ApiError(404, 'PDF not found');
    }

    const updateData: Record<string, string> = {};

    if (key) {
      await swapR2Key(pdf.public_id, key);
      Object.assign(updateData, pdfDocFields(key));
    }

    const updated = await prisma.class_routine_pdf.update({
      where: { id },
      data: updateData,
    });

    invalidateCache();
    return updated;
  }
}
