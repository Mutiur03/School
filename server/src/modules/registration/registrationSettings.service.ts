import path from 'path';
import { prisma } from '@/config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '@/config/r2.js';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';
import {
  parseRegistrationYear,
  resolveRegistrationClassmates,
} from '@/modules/registration/registrationSettings.util.js';

export type RegistrationSettingsConfig = {
  studentClass: 6 | 8 | 9;
  model: 'class6_reg' | 'class8_reg' | 'junior_scholarship_reg' | 'ssc_reg';
  yearField: 'class6_year' | 'class8_year' | 'jse_year' | 'ssc_year';
  uniqueWhereKey:
    'school_id_class6_year' | 'school_id_class8_year' | 'school_id_jse_year' | 'school_id_ssc_year';
  bodyYearKeys: string[];
  queryYearKeys: string[];
  yearRequiredMessage: string;
  noticeKeyPrefix: string;
  enrollmentYearFromStored: (storedYear: number | null) => number | null;
  /** Extra response fields mirroring the stored year (class 9: class9_year). */
  responseYearAliases?: string[];
};

function pickYear(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] != null && source[key] !== '') return source[key];
  }
  return undefined;
}

export function createRegistrationSettingsService(cfg: RegistrationSettingsConfig) {
  const table = () => prisma[cfg.model] as any;

  async function createOrUpdate(data: any) {
    const {
      a_sec_roll,
      b_sec_roll,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
      notice_key,
      classmates,
      classmates_source,
    } = data;

    const resolvedYear = parseRegistrationYear(
      pickYear(data, cfg.bodyYearKeys),
      cfg.yearRequiredMessage,
    );

    const updateData: any = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      [cfg.yearField]: resolvedYear,
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
      const existing = await table().findFirst({
        where: { school_id: schoolId, [cfg.yearField]: resolvedYear },
      });
      if (existing?.notice && existing.notice !== notice_key) {
        await deleteFromR2(existing.notice);
      }
      updateData.notice = notice_key;
    }

    return await table().upsert({
      where: {
        [cfg.uniqueWhereKey]: { school_id: schoolId, [cfg.yearField]: resolvedYear },
      },
      update: updateData,
      create: { ...updateData, school_id: schoolId },
    });
  }

  async function get(query: any = {}) {
    const schoolId = requireSchoolId();
    const requestedYear = pickYear(query ?? {}, cfg.queryYearKeys);
    const row = requestedYear
      ? await table().findFirst({
          where: {
            school_id: schoolId,
            [cfg.yearField]: parseInt(String(requestedYear), 10),
          },
        })
      : await table().findFirst({
          where: { school_id: schoolId },
          orderBy: [{ reg_open: 'desc' }, { [cfg.yearField]: 'desc' }, { id: 'desc' }],
        });

    if (!row) {
      const fallbackYear = requestedYear
        ? parseInt(String(requestedYear), 10)
        : new Date().getFullYear();
      const fallback: Record<string, unknown> = {
        id: 0,
        a_sec_roll: null,
        b_sec_roll: null,
        [cfg.yearField]: fallbackYear,
        reg_open: false,
        instruction_for_a: 'Please follow the instructions carefully',
        instruction_for_b: 'Please follow the instructions carefully',
        attachment_instruction: 'Please attach all required documents',
        notice: null,
        classmates: null,
        classmates_source: 'default',
      };
      for (const alias of cfg.responseYearAliases ?? []) {
        fallback[alias] = fallbackYear;
      }
      return fallback;
    }

    const storedYear = row[cfg.yearField] as number | null;
    const classmates = await resolveRegistrationClassmates(
      schoolId,
      row.classmates,
      row.classmates_source,
      cfg.enrollmentYearFromStored(storedYear),
      cfg.studentClass,
    );

    const result: Record<string, unknown> = { ...row, classmates };
    for (const alias of cfg.responseYearAliases ?? []) {
      result[alias] = storedYear;
    }
    return result;
  }

  /** Last 3 years (most recent first) that have registration settings configured. */
  async function getYears() {
    const rows = await table().findMany({
      where: { school_id: requireSchoolId() },
      select: { [cfg.yearField]: true },
      distinct: [cfg.yearField],
      orderBy: { [cfg.yearField]: 'desc' },
      take: 3,
    });
    return rows.map((row: any) => row[cfg.yearField]).filter((y: any) => y != null);
  }

  async function deleteNotice(query: any = {}) {
    const row = await get(query);
    if (!row?.id || !row.notice) {
      throw new ApiError(404, 'No notice found to delete');
    }
    await deleteFromR2(row.notice as string);
    await table().update({
      where: { id: row.id },
      data: { notice: null },
    });
    return true;
  }

  async function getNoticeUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, 'Filename and filetype are required');
    }
    const ext = path.extname(filename);
    const key = tenantR2Key(`notices/registrations/${cfg.noticeKeyPrefix}-${Date.now()}${ext}`);
    const url = await getUploadUrl(key, filetype);
    return { uploadUrl: url, key };
  }

  return { createOrUpdate, get, getYears, deleteNotice, getNoticeUploadUrl };
}

export type RegistrationSettingsService = ReturnType<typeof createRegistrationSettingsService>;

export const class6SettingsConfig: RegistrationSettingsConfig = {
  studentClass: 6,
  model: 'class6_reg',
  yearField: 'class6_year',
  uniqueWhereKey: 'school_id_class6_year',
  bodyYearKeys: ['class6_year'],
  queryYearKeys: ['class6_year', 'year'],
  yearRequiredMessage: 'Academic year is required for Class 6 registration settings',
  noticeKeyPrefix: 'notice-class-6',
  enrollmentYearFromStored: (y) => y,
};

export const class8SettingsConfig: RegistrationSettingsConfig = {
  studentClass: 8,
  model: 'class8_reg',
  yearField: 'class8_year',
  uniqueWhereKey: 'school_id_class8_year',
  bodyYearKeys: ['class8_year'],
  queryYearKeys: ['class8_year', 'year'],
  yearRequiredMessage: 'Academic year is required for Class 8 registration settings',
  noticeKeyPrefix: 'notice-class-8',
  enrollmentYearFromStored: (y) => y,
};

export const juniorScholarshipSettingsConfig: RegistrationSettingsConfig = {
  studentClass: 8,
  model: 'junior_scholarship_reg',
  yearField: 'jse_year',
  uniqueWhereKey: 'school_id_jse_year',
  bodyYearKeys: ['jse_year'],
  queryYearKeys: ['jse_year', 'year'],
  yearRequiredMessage: 'Exam year is required for Junior Scholarship settings',
  noticeKeyPrefix: 'notice-junior-scholarship',
  enrollmentYearFromStored: (y) => y,
};

export const class9SettingsConfig: RegistrationSettingsConfig = {
  studentClass: 9,
  model: 'ssc_reg',
  yearField: 'ssc_year',
  uniqueWhereKey: 'school_id_ssc_year',
  bodyYearKeys: ['ssc_year', 'class9_year'],
  queryYearKeys: ['ssc_year', 'class9_year', 'year'],
  yearRequiredMessage: 'SSC year is required for Class 9 registration settings',
  noticeKeyPrefix: 'notice-class-9',
  enrollmentYearFromStored: (y) => (y ? y - 2 : null),
  responseYearAliases: ['class9_year'],
};
