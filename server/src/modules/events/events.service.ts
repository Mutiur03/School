import { prisma } from '@/config/prisma.js';
import { getUploadUrl } from '@/config/r2.js';
import { ApiError } from '@/utils/ApiError.js';
import { assertTenantR2Key, deleteFromR2IfPresent, tenantR2Key } from '@/utils/r2Key.util.js';

export class EventService {
  static async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    type: 'image' | 'file',
  ) {
    const folder = type === 'image' ? 'events/images' : 'events/files';
    const key = tenantR2Key(`${folder}/${Date.now()}-${filename}`);
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  static async getEvents(schoolId?: number) {
    return prisma.events.findMany({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { date: 'desc' },
    });
  }

  static async createEvent(
    data: {
      title: string;
      details?: string;
      location?: string;
      date: string;
      imageKey?: string;
      fileKey?: string;
    },
    schoolId?: number,
  ) {
    if (data.fileKey) assertTenantR2Key(data.fileKey);
    if (data.imageKey) assertTenantR2Key(data.imageKey);
    const date = new Date(data.date).toISOString().slice(0, 10);

    return prisma.events.create({
      data: {
        title: data.title,
        details: data.details,
        location: data.location,
        date,
        image: data.imageKey ?? null,
        file: data.fileKey ?? null,
        download_url: data.fileKey ?? null,
        public_id: data.fileKey ?? null,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });
  }

  static async updateEvent(
    id: number,
    data: {
      title?: string;
      details?: string;
      location?: string;
      date?: string;
      imageKey?: string;
      fileKey?: string;
    },
    schoolId?: number,
  ) {
    const existing = await prisma.events.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, 'Event not found');

    const updateData: Record<string, any> = {
      title: data.title,
      details: data.details,
      location: data.location,
    };

    if (data.date) {
      updateData.date = new Date(data.date).toISOString().slice(0, 10);
    }

    if (data.fileKey) {
      assertTenantR2Key(data.fileKey);
      updateData.file = data.fileKey;
      updateData.public_id = data.fileKey;
      updateData.download_url = data.fileKey;
      if (existing.file) await deleteFromR2IfPresent(existing.file);
    }

    if (data.imageKey) {
      assertTenantR2Key(data.imageKey);
      updateData.image = data.imageKey;
      if (existing.image) await deleteFromR2IfPresent(existing.image);
    }

    return prisma.events.update({ where: { id }, data: updateData });
  }

  static async deleteEvent(id: number, schoolId?: number) {
    const existing = await prisma.events.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, 'Event not found');

    await prisma.events.delete({ where: { id } });

    await deleteFromR2IfPresent(existing.image);
    await deleteFromR2IfPresent(existing.file);
  }
}
