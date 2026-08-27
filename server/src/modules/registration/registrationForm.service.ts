import { prisma } from '@/config/prisma.js';
import {
  getUploadUrl,
  deleteFromR2,
  uploadToR2,
  getFileBuffer,
  resolveR2FileBuffer,
} from '@/config/r2.js';
import path from 'path';
import * as XLSX from 'xlsx';
import archiver from 'archiver';
import fs from 'fs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { removeInitialZeros } from '@school/shared-schemas';
import { ApiError } from '@/utils/ApiError.js';
import { requireSchoolId } from '@/utils/requireSchoolId.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';
import { schoolPublicOrigin, schoolWebsiteHost } from '@/utils/schoolPublicOrigin.util.js';
import {
  assertRegistrationOpen,
  parseOptionalRegistrationYear,
} from '@/modules/registration/registrationSettings.util.js';

export const formatDateLong = (dateStr: string) => {
  if (!dateStr) return '';
  let d, m, y;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    [d, m, y] = dateStr.split('/');
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [y, m, d] = dateStr.split('-');
  } else {
    return dateStr;
  }
  const dateObj = new Date(`${y}-${m}-${d}`);
  if (isNaN(dateObj.getTime())) return dateStr;
  return dateObj
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    .replace(/(\w+)\s(\d{4})/, '$1, $2');
};

type PdfRowHelpers = {
  wrapBnEn: (text: string) => string;
  joinAddr: (v: any, po: any, pc: any, upz: any, dist: any) => string;
};

const UI_ONLY_KEYS = [
  'same_as_permanent',
  'guardian_address_same_as_permanent',
  'guardian_is_not_father',
] as const;

export type RegistrationFormConfig = {
  studentModel:
    'student_registration_class6' | 'student_registration_class8' | 'student_registration_ssc';
  settingsModel: 'class6_reg' | 'class8_reg' | 'ssc_reg';
  yearField: 'class6_year' | 'class8_year' | 'ssc_batch';
  settingsYearField: 'class6_year' | 'class8_year' | 'ssc_year';
  yearKind: 'int' | 'string';
  photoField: 'photo' | 'photo_path';
  photoKeyStyle: 'section-roll' | 'timestamp';
  photoYearFallback: 'current' | 'unknown';
  r2ClassSlug: string;
  previewPath: string;
  alwaysPaginate: boolean;
  label: string;
  nearbyLabelBn: string;
  nearbyField: 'nearby_student_info' | 'nearby_nine_student_info';
  pdfTitle: (year: string | number) => string;
  pdfDocTitle: string;
  documentsHeaderBn: string;
  importClassNumber: 6 | 8 | 9;
  yearRequiredMessage: string;
  bodyYearKeys: string[];
  queryYearKeys: string[];
  deletePdfOnUpdate: boolean;
  mapOutgoing?: (row: any) => any;
  /** Map API `photo` → DB photo field; strip alias year keys from create/update payload. */
  mapIncoming?: (data: any) => any;
  buildImportExtra?: (reg: any) => { group: any; has_stipend: string };
  buildPdfDetailRows: (registration: any, h: PdfRowHelpers) => Array<[string, string]>;
};

function pickYear(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] != null && source[key] !== '') return source[key];
  }
  return undefined;
}

function normalizeBirthDate(data: any) {
  if (data.birth_day && data.birth_month && data.birth_year) {
    data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
  } else if (data.birth_date && data.birth_date.includes('/')) {
    const [d, m, y] = data.birth_date.split('/');
    data.birth_day = d;
    data.birth_month = m;
    data.birth_year = y;
  }
}

function stripUiKeys(data: any) {
  const out = { ...data };
  for (const key of UI_ONLY_KEYS) delete out[key];
  return out;
}

export function createRegistrationFormService(cfg: RegistrationFormConfig) {
  const students = () => prisma[cfg.studentModel] as any;
  const settingsTable = () => prisma[cfg.settingsModel] as any;

  const PDF_SETTINGS_SELECT: Record<string, true> = {
    id: true,
    a_sec_roll: true,
    b_sec_roll: true,
    notice: true,
    [cfg.settingsYearField]: true,
    reg_open: true,
    instruction_for_a: true,
    instruction_for_b: true,
    attachment_instruction: true,
    school_id: true,
    classmates: true,
    classmates_source: true,
  };

  const coerceYear = (raw: unknown) =>
    cfg.yearKind === 'int' ? parseInt(String(raw), 10) : String(raw);

  const yearFromRow = (row: any) => row?.[cfg.yearField];

  async function checkDuplicates(
    data: any,
    excludeId: string | null = null,
    schoolId: number = requireSchoolId(),
  ) {
    const duplicates = [];
    const yearVal = data?.[cfg.yearField];
    try {
      if (data && data.birth_reg_no && yearVal != null && yearVal !== '') {
        const existing = await students().findFirst({
          where: {
            school_id: schoolId,
            birth_reg_no: data.birth_reg_no,
            [cfg.yearField]: coerceYear(yearVal),
            ...(excludeId ? { id: { not: excludeId } } : {}),
          },
          select: { id: true, student_name_en: true },
        });
        if (existing) {
          duplicates.push({
            field: 'birthRegNo',
            message: `এই জন্ম নিবন্ধন নম্বর (Birth Reg No) দিয়ে ${yearVal} শিক্ষাবর্ষে ইতিমধ্যেই একটি নিবন্ধন বিদ্যমান`,
          });
        }
      }

      if (data && data.section && data.roll && yearVal != null && yearVal !== '') {
        const existing = await students().findFirst({
          where: {
            school_id: schoolId,
            section: data.section,
            roll: data.roll,
            [cfg.yearField]: coerceYear(yearVal),
            ...(excludeId ? { id: { not: excludeId } } : {}),
          },
          select: { id: true, student_name_en: true },
        });
        if (existing) {
          duplicates.push({
            field: 'rollSection',
            message: `${yearVal} শিক্ষাবর্ষে ${data.section} শাখায় এই রোল নম্বর (${data.roll}) ইতিমধ্যেই নিবন্ধিত`,
          });
        }
      }
    } catch (err) {
      console.warn('checkDuplicates error:', err);
    }
    return duplicates;
  }

  async function getSettingsSnapshot(schoolId?: number | null, year?: string | number | null) {
    const resolvedSchoolId = Number.isInteger(schoolId) ? (schoolId as number) : requireSchoolId();
    const parsedYear = parseOptionalRegistrationYear(year);

    return await settingsTable().findFirst({
      where: {
        school_id: resolvedSchoolId,
        ...(parsedYear !== undefined ? { [cfg.settingsYearField]: parsedYear } : {}),
      },
      orderBy: [{ reg_open: 'desc' }, { [cfg.settingsYearField]: 'desc' }, { id: 'desc' }],
      select: PDF_SETTINGS_SELECT,
    });
  }

  async function findOwnedRegistration(id: string) {
    const registration = await students().findFirst({
      where: { id, school_id: requireSchoolId() },
    });
    if (!registration) {
      throw new ApiError(404, 'Registration not found');
    }
    return registration;
  }

  function assertSettingsMatchRegistrationYear(registration: any, settings: any) {
    const registrationYear =
      yearFromRow(registration) !== null && yearFromRow(registration) !== undefined
        ? String(yearFromRow(registration)).trim()
        : '';
    const settingsYear =
      settings &&
      settings[cfg.settingsYearField] !== null &&
      settings[cfg.settingsYearField] !== undefined
        ? String(settings[cfg.settingsYearField]).trim()
        : '';

    if (!registrationYear) {
      throw new ApiError(400, 'Registration year is missing; cannot attach PDF settings');
    }
    if (!settingsYear) {
      throw new ApiError(400, `${cfg.label} registration settings year is missing`);
    }
    if (registrationYear !== settingsYear) {
      throw new ApiError(
        400,
        `${cfg.label} settings year (${settingsYear}) does not match registration year (${registrationYear})`,
      );
    }
  }

  function applyIncoming(data: any) {
    return cfg.mapIncoming ? cfg.mapIncoming(data) : stripUiKeys(data);
  }

  function applyOutgoing(row: any) {
    return cfg.mapOutgoing ? cfg.mapOutgoing(row) : row;
  }

  async function createRegistration(data: any) {
    const schoolId = requireSchoolId();
    normalizeBirthDate(data);

    const requestedYear = pickYear(data, cfg.bodyYearKeys);
    const settings = await getSettingsSnapshot(schoolId, requestedYear as any);
    const resolvedYear = requestedYear ?? settings?.[cfg.settingsYearField];
    if (resolvedYear == null || resolvedYear === '') {
      throw new ApiError(400, cfg.yearRequiredMessage);
    }
    data[cfg.yearField] = coerceYear(resolvedYear);
    assertRegistrationOpen(settings);

    if (!data.photo) {
      throw new ApiError(400, 'Student photo is required');
    }

    const duplicates = await checkDuplicates(data, null, schoolId);
    if (duplicates.length > 0) {
      throw new ApiError(400, 'Duplicate information found', duplicates as any);
    }

    const dbData = applyIncoming(data);

    return await students().create({
      data: {
        ...dbData,
        school_id: schoolId,
        status: 'pending',
      },
    });
  }

  async function getAllRegistrations(query: any) {
    const schoolId = requireSchoolId();
    const { section, status, search, page, limit } = query;
    const yearRaw = pickYear(query ?? {}, cfg.queryYearKeys);

    // Class 8/9 always paginate; class 6 only when page/limit present.
    const shouldPaginate =
      cfg.alwaysPaginate ||
      (typeof page === 'string' && page.trim().length > 0) ||
      (typeof limit === 'string' && limit.trim().length > 0);

    const where: any = { school_id: schoolId };
    if (yearRaw != null && yearRaw !== '') where[cfg.yearField] = coerceYear(yearRaw);
    if (section) where.section = section;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { student_name_en: { contains: search, mode: 'insensitive' } },
        { student_name_bn: { contains: search, mode: 'insensitive' } },
        { roll: { contains: search, mode: 'insensitive' } },
        { birth_reg_no: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (shouldPaginate) {
      const pageNum = parseInt(String(page ?? 1), 10);
      const limitNum = parseInt(String(limit ?? (cfg.alwaysPaginate ? 50 : 20)), 10);

      const normalizedPage = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;
      const defaultLimit = cfg.alwaysPaginate ? 50 : 20;
      const normalizedLimit =
        Number.isFinite(limitNum) && limitNum > 0
          ? Math.min(Math.floor(limitNum), 200)
          : defaultLimit;
      const skip = (normalizedPage - 1) * normalizedLimit;

      const statsWhere: any = { school_id: schoolId };
      if (yearRaw != null && yearRaw !== '') statsWhere[cfg.yearField] = coerceYear(yearRaw);
      if (section) statsWhere.section = section;
      if (search) statsWhere.OR = where.OR;

      const [total, pending, approved, registrations] = await prisma.$transaction([
        students().count({ where }),
        students().count({ where: { ...statsWhere, status: 'pending' } }),
        students().count({ where: { ...statsWhere, status: 'approved' } }),
        students().findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: normalizedLimit,
        }),
      ]);

      return {
        data: registrations.map(applyOutgoing),
        meta: {
          total,
          pending,
          approved,
          page: normalizedPage,
          limit: normalizedLimit,
          totalPages: total === 0 ? 0 : Math.ceil(total / normalizedLimit),
        },
      };
    }

    const rows = await students().findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(applyOutgoing);
  }

  async function getRegistrationById(id: string) {
    return applyOutgoing(await findOwnedRegistration(id));
  }

  async function updateRegistration(id: string, data: any) {
    const existing = await findOwnedRegistration(id);
    const yearForSettings = pickYear(data, cfg.bodyYearKeys) ?? yearFromRow(existing);
    assertRegistrationOpen(await getSettingsSnapshot(existing.school_id, yearForSettings as any));

    if (pickYear(data, cfg.bodyYearKeys) != null) {
      data[cfg.yearField] = coerceYear(pickYear(data, cfg.bodyYearKeys));
    }

    const duplicates = await checkDuplicates(
      { ...data, [cfg.yearField]: data[cfg.yearField] ?? yearFromRow(existing) },
      id,
      existing.school_id,
    );
    if (duplicates.length > 0) {
      throw new ApiError(400, 'Duplicate information found', duplicates as any);
    }

    const existingPhoto = existing[cfg.photoField];
    if (!data.photo) {
      data.photo = existingPhoto;
    }
    if (data.photo && existingPhoto && data.photo !== existingPhoto) {
      await deleteFromR2(existingPhoto);
    }

    if (data.birth_day && data.birth_month && data.birth_year) {
      data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
    }

    const dbData = applyIncoming(data);

    if (cfg.deletePdfOnUpdate && existing.pdf_path) {
      await deleteFromR2(existing.pdf_path);
    }

    const updated = await students().update({
      where: { id },
      data: {
        ...dbData,
        pdf_path: null,
        pdf_generated_at: null,
      },
    });
    return applyOutgoing(updated);
  }

  async function updateRegistrationStatus(id: string, status: string) {
    const registration = await findOwnedRegistration(id);
    const data: any = { status };
    if (status === 'approved') {
      if (!registration.pdf_settings_snapshot) {
        const settingsSnapshot = await getSettingsSnapshot(
          registration.school_id,
          yearFromRow(registration),
        );
        assertSettingsMatchRegistrationYear(registration, settingsSnapshot);
        data.pdf_settings_snapshot = settingsSnapshot;
      }
    }

    return await students().update({ where: { id }, data });
  }

  async function deleteRegistration(id: string) {
    const existing = await findOwnedRegistration(id);
    if (existing[cfg.photoField]) {
      await deleteFromR2(existing[cfg.photoField]);
    }
    if (existing.pdf_path) {
      await deleteFromR2(existing.pdf_path);
    }
    await students().delete({ where: { id } });
    return true;
  }

  async function getRegistrationPhotoUploadUrl(data: any) {
    const { filename, filetype, roll, section } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, 'Filename and filetype are required');
    }

    const requestedYear = pickYear(data, cfg.bodyYearKeys);
    const settings = await getSettingsSnapshot(requireSchoolId(), requestedYear as any);
    assertRegistrationOpen(settings);

    const fallback =
      cfg.photoYearFallback === 'current' ? String(new Date().getFullYear()) : 'unknown';
    const year =
      String(requestedYear || settings?.[cfg.settingsYearField] || fallback)
        .trim()
        .replace(/[^\w.-]/g, '') || fallback;

    const ext = path.extname(filename);
    let key: string;
    if (cfg.photoKeyStyle === 'section-roll') {
      const safeSection = String(section || 'X')
        .trim()
        .toUpperCase();
      const safeRoll = String(roll || '00')
        .trim()
        .padStart(2, '0');
      key = tenantR2Key(
        `registrations/${cfg.r2ClassSlug}/photos/${year}/${safeSection}-${safeRoll}-${Date.now()}${ext}`,
      );
    } else {
      key = tenantR2Key(
        `registrations/${cfg.r2ClassSlug}/photos/${year}/photo-${Date.now()}${ext}`,
      );
    }

    const url = await getUploadUrl(key, filetype);
    return { uploadUrl: url, key };
  }

  async function exportRegistrations(query: any) {
    const { section, status } = query;
    const yearRaw = pickYear(query ?? {}, cfg.queryYearKeys);

    const where: any = { school_id: requireSchoolId() };
    if (yearRaw != null && yearRaw !== '') where[cfg.yearField] = coerceYear(yearRaw);
    if (section) where.section = section;
    if (status && status !== 'all') where.status = status;

    const registrations = await students().findMany({
      where,
      orderBy: [{ section: 'asc' }, { roll: 'asc' }],
    });

    const registrationsForExport = registrations.map((registration: any) => {
      const orderedRegistration: any = {};
      Object.entries(registration).forEach(([key, value]) => {
        orderedRegistration[key] = value;
        if (key === 'birth_date') {
          orderedRegistration.birth_date_formatted = formatDateLong(value as string);
        }
      });
      if (!Object.hasOwn(orderedRegistration, 'birth_date_formatted')) {
        orderedRegistration.birth_date_formatted = '';
      }
      return orderedRegistration;
    });

    const importExtra = cfg.buildImportExtra ?? (() => ({ group: '', has_stipend: 'No' }));

    const importFormatData = registrations.map((reg: any) => ({
      name: reg.student_name_en,
      father_name: reg.father_name_en,
      mother_name: reg.mother_name_en,
      father_phone: reg.father_phone,
      mother_phone: reg.mother_phone,
      village: reg.permanent_village_road,
      post_office: reg.permanent_post_office,
      upazila: reg.permanent_upazila,
      district: reg.permanent_district,
      dob: reg.birth_date,
      class: cfg.importClassNumber,
      roll: reg.roll ? removeInitialZeros(String(reg.roll)) : '',
      section: reg.section,
      ...importExtra(reg),
      religion: reg.religion,
    }));

    const worksheet = XLSX.utils.json_to_sheet(registrationsForExport);
    const importWorksheet = XLSX.utils.json_to_sheet(importFormatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    XLSX.utils.book_append_sheet(workbook, importWorksheet, 'Student List');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async function exportRegistrationPhotos(query: any) {
    const { section, status } = query;
    const yearRaw = pickYear(query ?? {}, cfg.queryYearKeys);

    const where: any = {
      school_id: requireSchoolId(),
      [cfg.photoField]: { not: '' },
    };
    if (yearRaw != null && yearRaw !== '') where[cfg.yearField] = coerceYear(yearRaw);
    if (section) where.section = section;
    if (status && status !== 'all') where.status = status;

    const registrations = await students().findMany({
      where,
      orderBy: [{ section: 'asc' }, { roll: 'asc' }],
    });

    if (registrations.length === 0) {
      throw new ApiError(404, 'No photos found for the selected filters');
    }

    return {
      archive: archiver('zip', { zlib: { level: 9 } }),
      registrations,
    };
  }

  async function downloadRegistrationPDF(id: string, previewParam: string = '') {
    const isLivePreview =
      previewParam === '1' || previewParam === 'true' || previewParam === 'inline';
    const isInlinePreview = isLivePreview || previewParam === 'stored-inline';
    const isHtmlPreview = previewParam === 'html';

    const registration = await findOwnedRegistration(id);

    const shouldUseFrozenPdf =
      !isLivePreview &&
      !isHtmlPreview &&
      Boolean(registration.pdf_settings_snapshot) &&
      String(registration.status || '')
        .trim()
        .toLowerCase() === 'approved';

    if (shouldUseFrozenPdf && registration.pdf_path) {
      const existingPdf = await getFileBuffer(registration.pdf_path);
      if (existingPdf) {
        return {
          pdfBuffer: existingPdf,
          studentName: registration.student_name_en,
          isInlinePreview,
        };
      }
    }

    let settings: any = null;
    try {
      settings =
        shouldUseFrozenPdf && registration.pdf_settings_snapshot
          ? registration.pdf_settings_snapshot
          : await getSettingsSnapshot(registration.school_id, yearFromRow(registration));
      assertSettingsMatchRegistrationYear(registration, settings);
    } catch (error) {
      console.warn(`Failed to fetch ${cfg.label} settings:`, error);
      throw error;
    }

    const getInstructionsForSection = (section: string) => {
      if (!settings) return null;
      const sectionLower = section?.toLowerCase();
      if (sectionLower === 'a' && settings.instruction_for_a) return settings.instruction_for_a;
      if (sectionLower === 'b' && settings.instruction_for_b) return settings.instruction_for_b;
      return null;
    };

    const sectionInstructions = getInstructionsForSection(registration.section || '');
    const attachmentInstructions = settings?.attachment_instruction || null;

    const school = await prisma.school.findUnique({
      where: { id: registration.school_id },
      select: {
        name: true,
        address: true,
        upazila: true,
        district: true,
        website: true,
        customDomain: true,
        subdomain: true,
        logo: true,
        headerLogo: true,
      },
    });
    if (!school) {
      throw new ApiError(404, 'School not found for this registration');
    }

    const schoolName = school.name?.trim() || 'School';
    const schoolAddr =
      school.address?.trim() ||
      [school.upazila, school.district]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(', ');
    const schoolWebHost = schoolWebsiteHost(school.customDomain || school.website);
    const schoolWeb = schoolWebHost ? `https://${schoolWebHost}` : '';

    let logoBase64 = '';
    const logoKey = school.headerLogo || school.logo;
    if (logoKey) {
      try {
        const logoBuffer = await resolveR2FileBuffer(logoKey, registration.school_id);
        if (logoBuffer?.length) {
          const ext = path.extname(logoKey).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          logoBase64 = `data:${mime};base64,${logoBuffer.toString('base64')}`;
        }
      } catch (logoError) {
        console.warn(`Failed to load school logo for ${cfg.label} PDF:`, logoError);
      }
    }

    const solaimanLipiPath = path.join('public', 'fonts', 'SolaimanLipi.woff2');
    const timesNewRomanPath = path.join('public', 'fonts', 'times.ttf');
    const solaimanLipiBase64 = fs.existsSync(solaimanLipiPath)
      ? fs.readFileSync(solaimanLipiPath).toString('base64')
      : '';
    const timesNewRomanBase64 = fs.existsSync(timesNewRomanPath)
      ? fs.readFileSync(timesNewRomanPath).toString('base64')
      : '';

    let _studentPhotoBase64 = '';
    const photoKey = registration[cfg.photoField];
    if (photoKey) {
      const photoBuffer = await resolveR2FileBuffer(photoKey, registration.school_id);
      if (photoBuffer?.length) {
        const ext = path.extname(photoKey).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        _studentPhotoBase64 = `data:${mime};base64,${photoBuffer.toString('base64')}`;
      }
    }

    const frontendDomain = schoolPublicOrigin(school);

    let qrCodeBase64 = '';
    try {
      const qrData = `${frontendDomain}${cfg.previewPath}${registration.id}`;
      qrCodeBase64 = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 600,
        color: { dark: '#111111', light: '#FFFFFF' },
      });
    } catch (qrError) {
      console.warn('Failed to generate QR code for PDF:', qrError);
    }

    const wrapBnEn = (text: string) => {
      if (!text) return '';
      text = text.normalize('NFC');
      return text.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (match, bn, nonBn) => {
          if (bn) return `<span class="bn">${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return match;
        },
      );
    };

    const handleList = (text: string) => {
      if (!text) return '';
      const normalizedText = text.normalize('NFC');
      return normalizedText.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (_, bn, nonBn) => {
          if (bn) return `<span>${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return _;
        },
      );
    };

    const row = (label: string, value: string, rowIndex: number = 0) => {
      const oddBg = 'rgba(224, 231, 239, 0.45)';
      const evenLabelBg = 'rgba(249, 250, 251, 0.35)';
      const rowBg = rowIndex % 2 === 1 ? oddBg : 'transparent';
      const labelBg = rowIndex % 2 === 1 ? oddBg : evenLabelBg;
      const valueBg = rowIndex % 2 === 1 ? oddBg : 'transparent';

      return `
        <tr style="background:${rowBg};">
          <td style="border:1px solid #bbb;padding:4px 8px;width:270px;background:${labelBg};font-weight:500;">${wrapBnEn(label)}</td>
          <td style="border:1px solid #bbb;padding:4px 8px;background:${valueBg};">${value || '<span style="color:#aaa;">N/A</span>'}</td>
        </tr>
      `;
    };

    const joinAddr = (v: any, po: any, pc: any, upz: any, dist: any) =>
      [v, po ? (pc ? `${po} (${pc})` : po) : '', upz, dist]
        .filter(Boolean)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');

    const studentDetails = cfg.buildPdfDetailRows(registration, { wrapBnEn, joinAddr });

    let tableRows = '';
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });

    const titleYear = yearFromRow(registration) || '';
    const section = registration.section || '';
    const roll = registration.roll || '';
    const religion = registration.religion || '';
    const isPendingStatus =
      String(registration.status || '')
        .trim()
        .toLowerCase() === 'pending';

    const currentDateTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
    ).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>${cfg.pdfDocTitle}</title>
        <style>
          @page { size: A4; margin: 24px; }
          ${solaimanLipiBase64 ? `@font-face { font-family: 'SolaimanLipi'; src: url('data:font/truetype;charset=utf-8;base64,${solaimanLipiBase64}') format('woff2'); font-weight: normal; font-style: normal; font-display: block; unicode-range: U+0980-U+09FF, U+0964-U+096F; }` : ''}
          ${timesNewRomanBase64 ? `@font-face { font-family: 'TimesNewRoman'; src: url('data:font/truetype;charset=utf-8;base64,${timesNewRomanBase64}') format('truetype'); font-weight: normal; font-style: normal; font-display: block; unicode-range: U+0020-U+007F, U+00A0-U+00FF; }` : ''}
          body, html { height: 100%; margin: 0; padding: 0; page-break-inside: avoid; page-break-after: avoid; font-size: 13px; }
          .page-container { position: relative; min-height: 100vh; height: 100vh; width: 100vw; box-sizing: border-box; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'" : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"}, sans-serif; background: #fff; page-break-inside: avoid; page-break-after: avoid; font-size: 1rem; }
          .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; height: 500px; opacity: 0.14; z-index: 5; pointer-events: none; user-select: none; }
          .watermark img { width: 100%; height: 100%; object-fit: contain; filter: grayscale(100%) contrast(85%) brightness(145%); }
          .pending-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-26deg); z-index: 6; pointer-events: none; user-select: none; opacity: 0.65; width: 76%; border: 8px solid #facc15; padding: 10px 18px; box-sizing: border-box; background: transparent; text-align: center; }
          .pending-watermark-text { display: block; color: #facc15; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1; white-space: nowrap; font-family: ${timesNewRomanBase64 ? "'TimesNewRoman', 'Times New Roman'" : "'Times New Roman'"}, serif; font-size: 100px; font-weight: 700; }
          .content-area { position: relative; z-index: 3; box-sizing: border-box; padding: 0 0 110px 0; min-height: 0; height: calc(100vh - 110px); font-size: 13px; }
          .bn, .bn * { font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'" : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"}, sans-serif !important; font-weight: 400 !important; font-feature-settings: "liga" 1, "kern" 1, "calt" 1; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; -webkit-text-stroke: 0.01em transparent; font-variant-ligatures: common-ligatures contextual; font-size: 1rem; }
          .en, .en * { font-family: ${timesNewRomanBase64 ? "'TimesNewRoman', 'Times New Roman'" : "'Times New Roman'"}, serif !important; letter-spacing: 0.02em; font-size: 1rem; }
          * { unicode-bidi: bidi-override; direction: ltr; font-size: 1rem; }
          .header { position: relative; text-align: center; margin-bottom: 12px; padding: 12px 0 8px 0; font-size: 1rem; }
          .header-top { display: grid; grid-template-columns: 100px 1fr 95px; align-items: start; gap: 12px; width: 100%; }
          .monogram { width: 90px; height: 90px; margin-top: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: transparent; }
          .monogram img { width: 100%; height: 100%; object-fit: contain; }
          .passport-photo { width: 90px; height: 110px; border: 1px solid #bbb; border-radius: 3px; overflow: hidden; background: rgba(255, 255, 255, 0.92); display: flex; align-items: center; justify-content: center; margin-top: 2px; }
          .passport-photo img { width: 100%; height: 100%; object-fit: cover; }
          .header-center { text-align: center; padding-top: 2px; }
          .qr-code { width: 90px; height: 90px; border: 1px solid #bbb; border-radius: 3px; overflow: hidden; background: rgba(255, 255, 255, 0.92); display: flex; align-items: center; justify-content: center; margin-top: 2px; margin-left: auto; }
          .qr-code img { width: 100%; height: 100%; object-fit: contain; image-rendering: crisp-edges; }
          .header .school { font-size: 1.9rem; font-weight: bold; margin-bottom: 4px; line-height: 1.2; }
          .header .addr { font-size: 1.5rem; margin-bottom: 4px; font-weight: 500; }
          .header .web { font-size: 1.5rem; }
          .title-row { font-size: 1.5rem; font-weight: 600; text-align: center; margin-top: 5px; }
          .section-row { background: #f1f5f9; font-size: 1.5rem; font-weight: 500; text-align: center; border: 1px solid #bbb; padding: 6px 0; }
          .section-row .en, .section-row .en * { font-size: 1.5rem !important; font-weight: 500 !important; }
          .instructions-section { border: 1px solid #000; border-radius: 4px; padding: 12px; margin: 8px 0; font-size: 1.2rem; line-height: 1; text-align: justify; }
          .instructions-content { white-space: pre-line; text-align: justify; line-height: 1; font-size: 1.2rem; }
          table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; font-size: 1.2rem; page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #bbb; padding: 4px 8px; font-size: 1.2rem; }
          th { background: #f3f6fa; }
          .document-list { margin-top: 8px; font-size: 1.2rem; }
          .document-list .bn { display: block; font-size: 1.2rem; line-height: 1.2; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali'" : "'Noto Sans Bengali'"}, sans-serif !important; }
          .signature-row { position: absolute; left: 0; right: 0; bottom: 10px; width: 100%; display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; z-index: 3; height: 85px; box-sizing: border-box; font-size: 13px; }
          .signature-cell { flex: 1 1 0; text-align: center; vertical-align: bottom; min-width: 120px; max-width: 180px; padding: 0 4px; font-size: 1rem; }
          .signature-line { border-top: 1px dotted #222; margin-bottom: 2px; width: 95%; margin-left: auto; margin-right: auto; }
          .signature-label { font-size: 1rem; font-weight: 500; margin-top: 1px; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali'" : "'Noto Sans Bengali'"}, sans-serif !important; white-space: nowrap; }
          .bottom-info { position: absolute; left: 0; right: 0; bottom: -5px; width: 100%; text-align: center; font-size: 0.9rem; color: #555; background: white; z-index: 3; padding: 4px 0; }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${logoBase64 ? `<div class="watermark"><img src="${logoBase64}" alt="School Watermark" /></div>` : ''}
          ${isPendingStatus ? '<div class="pending-watermark"><span class="pending-watermark-text">PENDING</span></div>' : ''}
          <div class="content-area">
            <div class="header">
              <div class="header-top">
                <div class="monogram">
                  ${logoBase64 ? `<img src="${logoBase64}" alt="School Logo" />` : ''}
                </div>
                <div class="header-center">
                  <div class="school en">${schoolName}</div>
                  <div class="addr en">${schoolAddr}</div>
                  <div class="web en">${schoolWeb}</div>
                  <div class="title-row en">${cfg.pdfTitle(titleYear)}</div>
                </div>
                <div class="passport-photo">
                  ${_studentPhotoBase64 ? `<img src="${_studentPhotoBase64}" alt="Student Photo" />` : '<div class="passport-placeholder">Student<br/>Photo</div>'}
                </div>
              </div>
            </div>
            <div class="section-row en">Section: <span class="en">${section}</span>, Roll No: <span class="en">${roll}</span>, Religion: <span class="en">${religion}</span></div>
            <table><tbody>${tableRows}</tbody></table>
            <br />
            ${sectionInstructions ? `<div class="instructions-section"><div class="instructions-content">${wrapBnEn(sectionInstructions)}</div></div>` : ''}
            <div class="footer">
              <div class="note" style="display: flex; align-items: flex-start; gap: 12px;">
                <div class="document-list" style="flex: 1;">
                  <span class="bn"><b>${cfg.documentsHeaderBn}</b></span>
                  ${
                    attachmentInstructions
                      ? attachmentInstructions
                          .split(/\r?\n|\r/)
                          .map((line: string) =>
                            line ? `<span class="bn">${handleList(line)}</span>` : '',
                          )
                          .filter(Boolean)
                          .join('')
                      : ''
                  }
                </div>
                <div class="qr-code" style="flex-shrink: 0; margin-top: 0;">${qrCodeBase64 ? `<img src="${qrCodeBase64}" alt="QR Code" />` : '<div class="qr-placeholder">QR<br/>Unavailable</div>'}</div>
              </div>
            </div>
          </div>
          <div class="signature-row bn" style="gap: 8px; padding-bottom: 12px;">
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">ছাত্রের স্বাক্ষর</div></div>
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">পিতা/মাতা/বৈধ অভিভাবকের স্বাক্ষর</div></div>
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">দায়িত্বপ্রাপ্ত শিক্ষকের স্বাক্ষর, তারিখ ও সিল</div></div>
          </div>
          <div class="bottom-info en">Emergency Contact: 01309-121983 | Generated: ${currentDateTime}</div>
        </div>
      </body>
      </html>
    `;

    if (isHtmlPreview) {
      return { html };
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-font-subpixel-positioning',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--font-render-hinting=medium',
        '--enable-font-antialiasing',
        '--disable-extensions',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--force-device-scale-factor=1',
        '--disable-lcd-text',
        '--lang=bn-BD',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    await page.setExtraHTTPHeaders({
      'Accept-Charset': 'utf-8',
      'Accept-Language': 'bn-BD,bn;q=0.9,en;q=0.8',
    });

    await page.setContent(html, {
      waitUntil: isLivePreview ? ['domcontentloaded'] : ['load', 'domcontentloaded'],
    });

    await page.evaluate((quickPreview) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue) node.nodeValue = node.nodeValue.normalize('NFC');
      }
      return new Promise((resolve) => {
        const fallbackDelay = quickPreview ? 80 : 1000;
        const fontDelay = quickPreview ? 120 : 500;
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => setTimeout(resolve, fontDelay));
        } else {
          setTimeout(resolve, fallbackDelay);
        }
      });
    }, isLivePreview);

    const pdfBuffer = await page.pdf({
      format: 'a4',
      printBackground: true,
      margin: { top: 24, bottom: 24, left: 24, right: 24 },
      preferCSSPageSize: true,
      pageRanges: '1',
    });

    await browser.close();

    if (shouldUseFrozenPdf) {
      const pdfKey = tenantR2Key(
        `registrations/${cfg.r2ClassSlug}/pdfs/${yearFromRow(registration) || 'unknown'}/${id}-${Date.now()}.pdf`,
      );
      await uploadToR2(pdfKey, Buffer.from(pdfBuffer), 'application/pdf');
      await students().update({
        where: { id },
        data: {
          pdf_path: pdfKey,
          pdf_generated_at: new Date(),
        },
      });
    }

    return {
      pdfBuffer,
      studentName: registration.student_name_en,
      isInlinePreview,
    };
  }

  return {
    createRegistration,
    getAllRegistrations,
    getRegistrationById,
    updateRegistration,
    updateRegistrationStatus,
    deleteRegistration,
    getRegistrationPhotoUploadUrl,
    exportRegistrations,
    exportRegistrationPhotos,
    downloadRegistrationPDF,
  };
}

export type RegistrationFormServiceInstance = ReturnType<typeof createRegistrationFormService>;

function sharedAddressRows(registration: any, h: PdfRowHelpers): Array<[string, string]> {
  return [
    [
      'Permanent Address:',
      h.wrapBnEn(
        h.joinAddr(
          registration.permanent_village_road,
          registration.permanent_post_office,
          registration.permanent_post_code,
          registration.permanent_upazila,
          registration.permanent_district,
        ),
      ),
    ],
    [
      'Present Address:',
      h.wrapBnEn(
        h.joinAddr(
          registration.present_village_road,
          registration.present_post_office,
          registration.present_post_code,
          registration.present_upazila,
          registration.present_district,
        ),
      ),
    ],
  ];
}

function sharedGuardianRows(registration: any, h: PdfRowHelpers): Array<[string, string]> {
  return [
    [
      "Guardian's Name:",
      h.wrapBnEn(
        [
          registration.guardian_name ? `Name: ${registration.guardian_name}` : 'Not Applicable',
          registration.guardian_relation ? `Relation: ${registration.guardian_relation}` : '',
          registration.guardian_phone ? `Phone: ${registration.guardian_phone}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    [
      "Guardian's Address:",
      h.wrapBnEn(
        h.joinAddr(
          registration.guardian_village_road,
          registration.guardian_post_office,
          registration.guardian_post_code,
          registration.guardian_upazila,
          registration.guardian_district,
        ) || 'Not Applicable',
      ),
    ],
  ];
}

function stripAliasYears(data: any, yearField: string, bodyYearKeys: string[]) {
  const out = stripUiKeys(data);
  for (const key of bodyYearKeys) {
    if (key !== yearField) delete out[key];
  }
  return out;
}

export const class6FormConfig: RegistrationFormConfig = {
  studentModel: 'student_registration_class6',
  settingsModel: 'class6_reg',
  yearField: 'class6_year',
  settingsYearField: 'class6_year',
  yearKind: 'int',
  photoField: 'photo',
  photoKeyStyle: 'section-roll',
  photoYearFallback: 'current',
  r2ClassSlug: 'class-6',
  previewPath: '/preview/class6/',
  alwaysPaginate: false,
  label: 'Class 6',
  nearbyLabelBn: 'ষষ্ঠ',
  nearbyField: 'nearby_student_info',
  pdfTitle: (year) => `Student's Information for Registration of Class Six ${year}`,
  pdfDocTitle: 'Class 6 Registration Info',
  documentsHeaderBn: '* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:',
  importClassNumber: 6,
  yearRequiredMessage: 'Academic year is required',
  bodyYearKeys: ['class6_year'],
  queryYearKeys: ['class6_year'],
  deletePdfOnUpdate: true,
  mapIncoming: (data) => stripAliasYears(data, 'class6_year', ['class6_year']),
  buildPdfDetailRows: (registration, h) => [
    ['ছাত্রের নাম (বাংলায়):', h.wrapBnEn(registration.student_name_bn || '')],
    ["Student's Name:", h.wrapBnEn(registration.student_name_en.toUpperCase() || '')],
    ['Birth Registration Number:', h.wrapBnEn(registration.birth_reg_no || '')],
    [
      'Date of Birth:',
      h.wrapBnEn(
        registration.birth_date
          ? `${registration.birth_date} (${formatDateLong(registration.birth_date)})`
          : '',
      ),
    ],
    ['Email Address:', h.wrapBnEn(registration.email || 'No')],
    ['পিতার নাম:', h.wrapBnEn(registration.father_name_bn || '')],
    ["Father's Name:", h.wrapBnEn(registration.father_name_en.toUpperCase() || '')],
    ["Father's National ID Number:", h.wrapBnEn(registration.father_nid || '')],
    ['মাতার নাম:', h.wrapBnEn(registration.mother_name_bn || '')],
    ["Mother's Name:", h.wrapBnEn(registration.mother_name_en.toUpperCase() || '')],
    ["Mother's National ID Number:", h.wrapBnEn(registration.mother_nid || '')],
    [
      'Mobile Numbers:',
      h.wrapBnEn(
        [registration.father_phone || '', registration.mother_phone || '']
          .filter(Boolean)
          .join(', ') || 'No',
      ),
    ],
    ...sharedAddressRows(registration, h),
    [
      'Previous School Name & Address:',
      h.wrapBnEn(
        [
          registration.prev_school_name,
          registration.prev_school_upazila,
          registration.prev_school_district,
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    [
      'Previous School Information:',
      h.wrapBnEn(
        [
          registration.section_in_prev_school
            ? `Section: ${registration.section_in_prev_school}`
            : '',
          registration.roll_in_prev_school ? `Roll: ${registration.roll_in_prev_school}` : '',
          registration.prev_school_passing_year
            ? `Year: ${registration.prev_school_passing_year}`
            : '',
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    ...sharedGuardianRows(registration, h),
    [
      'বাসার নিকটবর্তী ষষ্ঠ শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
      h.wrapBnEn(registration.nearby_student_info || 'Not Applicable'),
    ],
  ],
};

export const class8FormConfig: RegistrationFormConfig = {
  studentModel: 'student_registration_class8',
  settingsModel: 'class8_reg',
  yearField: 'class8_year',
  settingsYearField: 'class8_year',
  yearKind: 'int',
  photoField: 'photo',
  photoKeyStyle: 'timestamp',
  photoYearFallback: 'unknown',
  r2ClassSlug: 'class-8',
  previewPath: '/preview/class8/',
  alwaysPaginate: true,
  label: 'Class 8',
  nearbyLabelBn: 'অষ্টম',
  nearbyField: 'nearby_student_info',
  pdfTitle: (year) => `Student's Information for Registration of Class Eight ${year}`,
  pdfDocTitle: 'Class 8 Registration Info',
  documentsHeaderBn: '* প্রিন্টকৃত ফরমের সাথে সাথে যেসব স্পষ্ট কাগজপত্র সংযুক্ত করেত হবে:',
  importClassNumber: 8,
  yearRequiredMessage: 'Academic year is required',
  bodyYearKeys: ['class8_year'],
  queryYearKeys: ['class8_year'],
  deletePdfOnUpdate: true,
  mapIncoming: (data) => stripAliasYears(data, 'class8_year', ['class8_year']),
  buildPdfDetailRows: (registration, h) => [
    ['ছাত্রের নাম (বাংলায়):', h.wrapBnEn(registration.student_name_bn || '')],
    ["Student's Name:", h.wrapBnEn(registration.student_name_en.toUpperCase() || '')],
    ['Registration Number:', h.wrapBnEn(registration.registration_no || '')],
    ['Birth Registration Number:', h.wrapBnEn(registration.birth_reg_no || '')],
    [
      'Date of Birth:',
      h.wrapBnEn(
        registration.birth_date
          ? `${registration.birth_date} (${formatDateLong(registration.birth_date)})`
          : '',
      ),
    ],
    ['Email Address:', h.wrapBnEn(registration.email || 'No')],
    ['পিতার নাম:', h.wrapBnEn(registration.father_name_bn || '')],
    ["Father's Name:", h.wrapBnEn(registration.father_name_en.toUpperCase() || '')],
    ["Father's National ID Number:", h.wrapBnEn(registration.father_nid || '')],
    ['মাতার নাম:', h.wrapBnEn(registration.mother_name_bn || '')],
    ["Mother's Name:", h.wrapBnEn(registration.mother_name_en.toUpperCase() || '')],
    ["Mother's National ID Number:", h.wrapBnEn(registration.mother_nid || '')],
    [
      'Mobile Numbers:',
      h.wrapBnEn(
        [registration.father_phone || '', registration.mother_phone || '']
          .filter(Boolean)
          .join(', ') || 'No',
      ),
    ],
    ...sharedAddressRows(registration, h),
    [
      'Previous School Name & Address:',
      h.wrapBnEn(
        [
          registration.prev_school_name,
          registration.prev_school_upazila,
          registration.prev_school_district,
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    ...sharedGuardianRows(registration, h),
    [
      'বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
      h.wrapBnEn(registration.nearby_student_info || 'Not Applicable'),
    ],
  ],
};

export const class9FormConfig: RegistrationFormConfig = {
  studentModel: 'student_registration_ssc',
  settingsModel: 'ssc_reg',
  yearField: 'ssc_batch',
  settingsYearField: 'ssc_year',
  yearKind: 'string',
  photoField: 'photo_path',
  photoKeyStyle: 'timestamp',
  photoYearFallback: 'unknown',
  r2ClassSlug: 'class-9',
  previewPath: '/preview/class9/',
  alwaysPaginate: true,
  label: 'Class 9',
  nearbyLabelBn: 'নবম',
  nearbyField: 'nearby_nine_student_info',
  pdfTitle: (year) => `Student's Information for Registration of SSC Exam ${year}`,
  pdfDocTitle: 'SSC Registration Info',
  documentsHeaderBn: '* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:',
  importClassNumber: 9,
  yearRequiredMessage: 'SSC year is required',
  bodyYearKeys: ['ssc_batch', 'ssc_year', 'class9_year'],
  queryYearKeys: ['ssc_batch', 'ssc_year', 'class9_year'],
  deletePdfOnUpdate: true,
  mapOutgoing: (row) => ({ ...row, photo: row.photo_path }),
  mapIncoming: (data) => {
    const {
      photo,
      ssc_year: _ssc_year,
      class9_year: _class9_year,
      ...rest
    } = stripAliasYears(data, 'ssc_batch', ['ssc_batch', 'ssc_year', 'class9_year']);
    return {
      ...rest,
      photo_path: photo || '',
    };
  },
  buildImportExtra: (reg) => ({
    group: reg.group_class_nine,
    has_stipend: reg.upobritti === 'Yes' ? 'Yes' : 'No',
  }),
  buildPdfDetailRows: (registration, h) => [
    [
      'ছাত্রের নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
      h.wrapBnEn(registration.student_name_bn || ''),
    ],
    ["Student's Name:", h.wrapBnEn(registration.student_name_en || '')],
    ['Birth Registration Number:', h.wrapBnEn(registration.birth_reg_no || '')],
    [
      'Date of Birth (According to JSC/JDC/Class 8):',
      h.wrapBnEn(formatDateLong(registration.birth_date || '')),
    ],
    ['Email Address:', h.wrapBnEn(registration.email || 'No')],
    [
      'Mobile Numbers:',
      h.wrapBnEn(
        [`${registration.father_phone}` || '', `${registration.mother_phone}` || '']
          .filter(Boolean)
          .join(', ') || 'No',
      ),
    ],
    [
      'পিতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
      h.wrapBnEn(registration.father_name_bn || ''),
    ],
    ["Father's Name:", h.wrapBnEn(registration.father_name_en || '')],
    ["Father's National ID Number:", h.wrapBnEn(registration.father_nid || '')],
    [
      'মাতার নাম (JSC/JDC/Class 8 রেজিস্ট্রেশন অনুযায়ী):',
      h.wrapBnEn(registration.mother_name_bn || ''),
    ],
    ["Mother's Name:", h.wrapBnEn(registration.mother_name_en || '')],
    ["Mother's National ID Number:", h.wrapBnEn(registration.mother_nid || '')],
    ...sharedGuardianRows(registration, h),
    ...sharedAddressRows(registration, h),
    [
      'Previous School Name & Address:',
      h.wrapBnEn(
        [
          registration.prev_school_name,
          registration.prev_school_upazila,
          registration.prev_school_district,
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    [
      'Information of JSC/JDC/Class 8:',
      h.wrapBnEn(
        [
          registration.jsc_reg_no ? `Reg No: ${registration.jsc_reg_no}` : '',
          registration.jsc_roll_no ? `Roll No: ${registration.jsc_roll_no}` : '',
          registration.jsc_passing_year ? `${registration.jsc_passing_year}` : '',
          registration.jsc_board ? `${registration.jsc_board}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      ),
    ],
    [
      'Main and 4th Subject:',
      h.wrapBnEn(
        [
          registration.group_class_nine || '',
          registration.main_subject ? `, ${registration.main_subject}` : '',
          registration.fourth_subject ? `, 4th: ${registration.fourth_subject}` : '',
        ]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(' '),
      ),
    ],
    [
      'বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:',
      h.wrapBnEn(registration.nearby_nine_student_info || ''),
    ],
  ],
};

export const RegistrationFormClass6Service = createRegistrationFormService(class6FormConfig);
export const RegistrationFormClass8Service = createRegistrationFormService(class8FormConfig);
export const RegistrationFormClass9Service = createRegistrationFormService(class9FormConfig);
