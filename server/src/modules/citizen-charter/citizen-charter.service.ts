import { prisma } from '@/config/prisma.js';
import { ApiError } from '@/utils/ApiError.js';
import { fileDocFields, presignTenantUpload, swapR2Key } from '@/utils/r2Key.util.js';

export class CitizenCharterService {
  async getPresignedUploadUrl(filename: string, contentType: string) {
    if (contentType !== 'application/pdf') {
      throw new ApiError(400, 'Only PDF files are allowed');
    }
    return presignTenantUpload('citizen-charter', filename, contentType);
  }

  async upsertCharter(key: string, schoolId?: number) {
    const existing = await prisma.citizenCharter.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: 'desc' },
    });

    if (existing) await swapR2Key(existing.public_id, key);

    const data = {
      ...fileDocFields(key),
      ...(schoolId ? { school_id: schoolId } : {}),
      updated_at: new Date(),
    };

    return existing
      ? await prisma.citizenCharter.update({ where: { id: existing.id }, data })
      : await prisma.citizenCharter.create({ data });
  }

  async getCharter(schoolId?: number) {
    const charter = await prisma.citizenCharter.findFirst({
      where: schoolId ? { school_id: schoolId } : undefined,
      orderBy: { updated_at: 'desc' },
    });

    if (!charter) {
      throw new ApiError(404, 'Citizen charter not found');
    }
    return charter;
  }
}
