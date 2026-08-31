import { prisma } from '@/config/prisma.js';
import { redis } from '@/config/redis.js';
import { ApiError } from '@/utils/ApiError.js';
import {
  deleteFromR2IfPresent,
  fileDocFields,
  presignTenantUpload,
  swapR2Key,
} from '@/utils/r2Key.util.js';

const noticesKey = (schoolId?: number) => `notices:${schoolId ?? 'none'}`;

export class NoticeService {
  async getNotices(limit?: number, schoolId?: number) {
    const key = noticesKey(schoolId);
    const cached = await redis.get(key).catch(() => null);
    const notices = cached
      ? JSON.parse(cached)
      : await prisma.notices.findMany({
          where: { school_id: schoolId },
          orderBy: { created_at: 'desc' },
        });

    if (!cached) redis.set(key, JSON.stringify(notices), 'EX', 120).catch(() => {});

    return limit ? notices.slice(0, limit) : notices;
  }

  getPresignedUploadUrl(filename: string, contentType: string) {
    return presignTenantUpload('notices', filename, contentType);
  }

  async createNotice(
    data: {
      title: string;
      key: string;
      created_at?: string;
    },
    schoolId?: number,
  ) {
    const notice = await prisma.notices.create({
      data: {
        title: data.title,
        ...fileDocFields(data.key),
        ...(schoolId ? { school_id: schoolId } : {}),
        ...(data.created_at && { created_at: new Date(data.created_at) }),
      },
    });

    await redis.del(noticesKey(schoolId)).catch(() => {});
    return notice;
  }

  async updateNotice(
    id: number,
    data: { title?: string; key?: string; created_at?: string },
    schoolId?: number,
  ) {
    const existing = await prisma.notices.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, 'Notice not found');

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;

    if (data.key) {
      await swapR2Key(existing.public_id, data.key);
      Object.assign(updateData, fileDocFields(data.key));
    }

    if (data.created_at) {
      updateData.created_at = new Date(data.created_at);
    }

    const updated = await prisma.notices.update({
      where: { id },
      data: updateData,
    });

    await redis.del(noticesKey(schoolId)).catch(() => {});
    return updated;
  }

  async deleteNotice(id: number, schoolId?: number) {
    const existing = await prisma.notices.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, 'Notice not found');

    await prisma.notices.delete({ where: { id } });
    await redis.del(noticesKey(schoolId)).catch(() => {});
    await deleteFromR2IfPresent(existing.public_id);
  }
}
