import { prisma } from '@/config/prisma.js';
import { getUploadUrl } from '@/config/r2.js';
import path from 'path';
import { removeInitialZeros } from '@school/shared-schemas';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';

export class RegistrationSettingsClass9Service {
  private static resolveYear(data: any) {
    const rawYear = data?.ssc_year ?? data?.class9_year ?? data?.year;
    const year = rawYear ? parseInt(String(rawYear), 10) : NaN;
    if (!Number.isInteger(year)) {
      throw new ApiError(400, 'SSC year is required for Class 9 registration settings');
    }
    return year;
  }

  static async createOrUpdateClass9Reg(data: any) {
    const {
      a_sec_roll,
      b_sec_roll,
      ssc_year,
      class9_year,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
      notice_key,
      classmates,
      classmates_source,
    } = data;

    const resolvedYear = RegistrationSettingsClass9Service.resolveYear({
      ssc_year,
      class9_year,
    });

    const updateData: any = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      ssc_year: resolvedYear,
      reg_open: reg_open === 'true' || reg_open === true,
      instruction_for_a: instruction_for_a || 'Please follow the instructions carefully',
      instruction_for_b: instruction_for_b || 'Please follow the instructions carefully',
      attachment_instruction: attachment_instruction || 'Please attach all required documents',
      classmates: classmates || null,
      classmates_source: classmates_source || 'default',
      notice: null,
    };

    if (notice_key) {
      updateData.notice = notice_key;
    }

    const schoolId = requireSchoolId();
    const existing = await prisma.ssc_reg.findFirst({
      where: { school_id: schoolId, ssc_year: resolvedYear },
    });

    if (existing) {
      return await prisma.ssc_reg.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return await prisma.ssc_reg.create({
      data: { ...updateData, school_id: schoolId },
    });
  }

  static async getClass9Reg(query: any = {}) {
    const schoolId = requireSchoolId();
    const requestedYear = query?.ssc_year ?? query?.class9_year ?? query?.year;
    const class9Reg = requestedYear
      ? await prisma.ssc_reg.findFirst({
          where: { school_id: schoolId, ssc_year: parseInt(String(requestedYear), 10) },
        })
      : await prisma.ssc_reg.findFirst({
          where: { school_id: schoolId },
          orderBy: [{ reg_open: 'desc' }, { ssc_year: 'desc' }, { id: 'desc' }],
        });

    if (!class9Reg) {
      const fallbackYear = requestedYear
        ? parseInt(String(requestedYear), 10)
        : new Date().getFullYear();

      return {
        id: 0,
        a_sec_roll: null,
        b_sec_roll: null,
        ssc_year: fallbackYear,
        class9_year: fallbackYear,
        reg_open: false,
        instruction_for_a: 'Please follow the instructions carefully',
        instruction_for_b: 'Please follow the instructions carefully',
        attachment_instruction: 'Please attach all required documents',
        notice: null,
        classmates: null,
        classmates_source: 'default',
      };
    }

    let resolvedClassmates = class9Reg.classmates;

    if (class9Reg.classmates_source === 'default' && class9Reg.ssc_year) {
      const enrollments = await prisma.student_enrollments.findMany({
        where: {
          year: (class9Reg.ssc_year as number) - 2,
          class: 9,
        },
        include: {
          student: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          student: {
            name: 'asc',
          },
        },
      });

      resolvedClassmates = enrollments
        .map((en: any) => {
          const name = en.student.name;
          const section = en.section || '';
          const roll = en.roll ? removeInitialZeros(String(en.roll)) : '';
          return section && roll ? `${name}/${section}-${roll}` : name;
        })
        .join('\n');
    }

    return {
      ...class9Reg,
      ssc_year: class9Reg.ssc_year,
      class9_year: class9Reg.ssc_year,
      classmates: resolvedClassmates,
    };
  }

  static async deleteClass9RegNotice(query: any = {}) {
    const class9Reg = await RegistrationSettingsClass9Service.getClass9Reg(query);

    if (!class9Reg || !class9Reg.notice) {
      throw new ApiError(404, 'No notice found to delete');
    }

    await prisma.ssc_reg.update({
      where: { id: class9Reg.id },
      data: { notice: null },
    });

    return true;
  }

  static async getClass9NoticeUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, 'Filename and filetype are required');
    }

    const ext = path.extname(filename);
    const key = tenantR2Key(`notices/registrations/notice-class-9-${Date.now()}${ext}`);
    const url = await getUploadUrl(key, filetype);

    return { uploadUrl: url, key };
  }
}
