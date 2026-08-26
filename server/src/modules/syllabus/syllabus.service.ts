import { prisma } from '@/config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '@/config/r2.js';
import { redis } from '@/config/redis.js';
import { env } from '@/config/env.js';
import { ApiError } from '@/utils/ApiError.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';

const cacheKey = (schoolId?: number, classNum?: string, year?: string) =>
  `syllabus_${schoolId ?? 'global'}_${classNum ?? 'all'}_${year ?? 'all'}`;

const invalidateCache = (schoolId?: number) => {
  redis.del(cacheKey(schoolId)).catch(() => {});
};

export class SyllabusService {
  static async getPresignedUploadUrl(filename: string, contentType: string) {
    const key = tenantR2Key(`syllabus/${Date.now()}-${filename}`);
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  static async createSyllabus(
    data: { key: string; class: number; year: number },
    schoolId?: number,
  ) {
    const syllabus = await prisma.syllabus.create({
      data: {
        class: data.class,
        year: data.year,
        pdf_url: data.key,
        download_url: data.key,
        public_id: data.key,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });

    invalidateCache(schoolId);
    return syllabus;
  }

  static async listSyllabus(filters: { class?: string; year?: string }, schoolId?: number) {
    const key = cacheKey(schoolId, filters.class, filters.year);
    const cached = await redis.get(key).catch(() => null);

    if (cached) {
      return JSON.parse(cached);
    }

    const where: Record<string, unknown> = {};
    if (filters.class) where.class = parseInt(filters.class, 10);
    if (filters.year) where.year = parseInt(filters.year, 10);
    if (schoolId) where.school_id = schoolId;

    const syllabuses = await prisma.syllabus.findMany({ where });
    await redis.set(key, JSON.stringify(syllabuses), 'EX', env.LONG_TERM_CACHE_TTL).catch(() => {});

    return syllabuses;
  }

  static async deleteSyllabus(id: number, schoolId?: number) {
    const syllabus = await prisma.syllabus.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });

    if (!syllabus) {
      throw new ApiError(404, 'Syllabus not found');
    }

    await deleteFromR2(syllabus.public_id);
    await prisma.syllabus.delete({ where: { id } });
    invalidateCache(schoolId);
  }

  static async updateSyllabus(
    id: number,
    data: { class: number; year: number; key?: string },
    schoolId?: number,
  ) {
    const syllabus = await prisma.syllabus.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });

    if (!syllabus) {
      throw new ApiError(404, 'Syllabus not found');
    }

    let pdf_url = syllabus.pdf_url;
    let public_id = syllabus.public_id;
    let download_url = syllabus.download_url;

    if (data.key) {
      await deleteFromR2(syllabus.public_id);
      pdf_url = data.key;
      download_url = data.key;
      public_id = data.key;
    }

    const updated = await prisma.syllabus.update({
      where: { id },
      data: {
        class: data.class,
        year: data.year,
        pdf_url,
        download_url,
        public_id,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });

    invalidateCache(schoolId);
    return updated;
  }
}
