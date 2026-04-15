import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";
import { getUploadUrl, deleteFromR2 } from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";
import {
  LONG_TERM_CACHE_TTL,
  SHORT_TERM_CACHE_TTL,
} from "@/utils/globalVars.js";

const CACHE_KEY_LIMIT = "notices_limit";
const CACHE_KEY_ALL = "notices_all";

export class NoticeService {
  async getNotices(limit?: number) {
    const cacheKey = limit ? `${CACHE_KEY_LIMIT}_${limit}` : CACHE_KEY_ALL;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const notices = await prisma.notices.findMany({
      orderBy: { created_at: "desc" },
      ...(limit ? { take: limit } : {}),
    });

    await redis.set(
      cacheKey,
      JSON.stringify(notices),
      "EX",
      limit ? LONG_TERM_CACHE_TTL : SHORT_TERM_CACHE_TTL,
    );

    return notices;
  }

  async getPresignedUploadUrl(filename: string, contentType: string) {
    const key = `notices/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  async createNotice(data: {
    title: string;
    key: string;
    created_at?: string;
  }) {
    const notice = await prisma.notices.create({
      data: {
        title: data.title,
        file: data.key, // Store just the key in the DB
        download_url: data.key,
        public_id: data.key,
        ...(data.created_at && { created_at: new Date(data.created_at) }),
      },
    });

    await this.invalidateCache();
    return notice;
  }

  async updateNotice(
    id: number,
    data: { title?: string; key?: string; created_at?: string },
  ) {
    const existing = await prisma.notices.findUnique({ where: { id } });
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

    await this.invalidateCache();
    return updated;
  }

  async deleteNotice(id: number) {
    const existing = await prisma.notices.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Notice not found");

    await prisma.notices.delete({ where: { id } });

    if (existing.public_id) {
      await deleteFromR2(existing.public_id);
    }

    await this.invalidateCache();
  }

  private async invalidateCache() {
    const keys = await redis.keys("notices_*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
