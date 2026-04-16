import { prisma } from "@/config/prisma.js";

import { getUploadUrl, deleteFromR2 } from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";

export class NoticeService {
  async getNotices(limit?: number, schoolId?: number) {
    const notices = await prisma.notices.findMany({
      where: { school_id: schoolId },
      orderBy: { created_at: "desc" },
      ...(limit ? { take: limit } : {}),
    });

    return notices;
  }

  async getPresignedUploadUrl(filename: string, contentType: string) {
    const key = `notices/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
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
        file: data.key,
        download_url: data.key,
        public_id: data.key,
        ...(schoolId ? { school_id: schoolId } : {}),
        ...(data.created_at && { created_at: new Date(data.created_at) }),
      },
    });

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
    if (!existing) throw new ApiError(404, "Notice not found");

    let updateData: any = { ...data };
    delete updateData.key;

    if (data.key) {
      updateData.file = data.key;
      updateData.download_url = data.key;
      updateData.public_id = data.key;
      if (existing.public_id) {
        await deleteFromR2(existing.public_id);
      }
    }

    if (data.created_at) {
      updateData.created_at = new Date(data.created_at);
    }

    const updated = await prisma.notices.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async deleteNotice(id: number, schoolId?: number) {
    const existing = await prisma.notices.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, "Notice not found");

    await prisma.notices.delete({ where: { id } });

    if (existing.public_id) {
      await deleteFromR2(existing.public_id);
    }
  }
}
