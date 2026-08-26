import { prisma } from '@/config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '@/config/r2.js';
import path from 'path';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';
import {
  parseRegistrationYear,
  resolveRegistrationClassmates,
} from '@/modules/registration/registrationSettings.util.js';

export class RegistrationSettingsClass8Service {
  static async createOrUpdateClass8Reg(data: any) {
    const {
      a_sec_roll,
      b_sec_roll,
      class8_year,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
      notice_key,
      classmates,
      classmates_source,
    } = data;

    const resolvedYear = parseRegistrationYear(
      class8_year,
      'Academic year is required for Class 8 registration settings',
    );

    const updateData: any = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      class8_year: resolvedYear,
      reg_open: reg_open === 'true' || reg_open === true,
      instruction_for_a: instruction_for_a || 'Please follow the instructions carefully',
      instruction_for_b: instruction_for_b || 'Please follow the instructions carefully',
      attachment_instruction: attachment_instruction || 'Please attach all required documents',
      classmates: classmates || null,
      classmates_source: classmates_source || 'default',
      notice: null,
    };

    const schoolId = requireSchoolId();

    if (notice_key) {
      const existing = await prisma.class8_reg.findFirst({
        where: { school_id: schoolId, class8_year: resolvedYear },
      });
      if (existing?.notice && existing.notice !== notice_key) {
        await deleteFromR2(existing.notice);
      }
      updateData.notice = notice_key;
    }

    return await prisma.class8_reg.upsert({
      where: {
        school_id_class8_year: { school_id: schoolId, class8_year: resolvedYear },
      },
      update: updateData,
      create: { ...updateData, school_id: schoolId },
    });
  }

  static async getClass8Reg(query: any = {}) {
    const schoolId = requireSchoolId();
    const requestedYear = query?.class8_year ?? query?.year;
    const class8Reg = requestedYear
      ? await prisma.class8_reg.findFirst({
          where: { school_id: schoolId, class8_year: parseInt(String(requestedYear), 10) },
        })
      : await prisma.class8_reg.findFirst({
          where: { school_id: schoolId },
          orderBy: [{ reg_open: 'desc' }, { class8_year: 'desc' }, { id: 'desc' }],
        });

    if (!class8Reg) {
      const fallbackYear = requestedYear
        ? parseInt(String(requestedYear), 10)
        : new Date().getFullYear();

      return {
        id: 0,
        a_sec_roll: null,
        b_sec_roll: null,
        class8_year: fallbackYear,
        reg_open: false,
        instruction_for_a: 'Please follow the instructions carefully',
        instruction_for_b: 'Please follow the instructions carefully',
        attachment_instruction: 'Please attach all required documents',
        notice: null,
        classmates: null,
        classmates_source: 'default',
      };
    }

    const classmates = await resolveRegistrationClassmates(
      schoolId,
      class8Reg.classmates,
      class8Reg.classmates_source,
      class8Reg.class8_year,
      8,
    );

    return { ...class8Reg, classmates };
  }

  static async deleteClass8RegNotice(query: any = {}) {
    const class8Reg = await RegistrationSettingsClass8Service.getClass8Reg(query);

    if (!class8Reg?.id || !class8Reg.notice) {
      throw new ApiError(404, 'No notice found to delete');
    }

    await deleteFromR2(class8Reg.notice);

    await prisma.class8_reg.update({
      where: { id: class8Reg.id },
      data: { notice: null },
    });

    return true;
  }

  static async getClass8NoticeUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, 'Filename and filetype are required');
    }

    const ext = path.extname(filename);
    const key = tenantR2Key(`notices/registrations/notice-class-8-${Date.now()}${ext}`);
    const url = await getUploadUrl(key, filetype);

    return { uploadUrl: url, key };
  }
}
