import { z } from 'zod';
import { districts, upazilas } from './location.js';
import { PHONE_NUMBER, VALID_GROUPS } from './regex.js';

const currentYear = new Date().getFullYear();
const districtIds = new Set(districts.map((d) => d.id));
const upazilaIds = new Set(upazilas.map((u) => u.id));

/** Education boards (same set as public sidebar Important links). */
export const SCHOOL_BOARDS = [
  'Dhaka Education Board',
  'Rajshahi Education Board',
  'Chattogram Education Board',
  'Cumilla Education Board',
  'Jashore Education Board',
  'Barishal Education Board',
  'Sylhet Education Board',
  'Dinajpur Education Board',
  'Mymensingh Education Board',
  'Bangladesh Technical Education Board',
  'Bangladesh Madrasah Education Board',
] as const;

export const SCHOOL_MEDIUMS = ['Bangla', 'English', 'Bangla & English'] as const;

export const SCHOOL_OWNERSHIPS = ['Government', 'Non-Government'] as const;

export const SCHOOL_GENDERS = ['Boys', 'Girls', 'Co-education'] as const;

// ─── helpers ────────────────────────────────────────────────────────────────
// Zod 4: missing object keys are not the same as `undefined`. Helpers that
// transform must be `.nullish()` (or `.optional()`) or unmounted RHF fields
// fail with "expected nonoptional, received undefined".

const optionalTrimmedString = (maxLength: number, label: string) =>
  z
    .string()
    .nullish()
    .superRefine((raw, ctx) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length > 0 && value.length > maxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: maxLength,
          origin: 'string',
          inclusive: true,
          message: `${label} cannot exceed ${maxLength} characters`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return value.length === 0 ? null : value;
    });

const isUploadPath = (value: string) => /^\/?uploads\/.+/.test(value);
const isR2Key = (value: string) => /^[a-z0-9][a-z0-9\-._/]+$/i.test(value);
const isPendingUpload = (value: string) => /^pending-[a-z0-9\-._/]+$/i.test(value);
/** Site-public static asset (e.g. /biwta.jpeg in client-next/public). */
const isPublicSitePath = (value: string) =>
  /^\/[a-z0-9][a-z0-9\-._/]*\.(jpe?g|png|webp|gif|svg)$/i.test(value);

const isAllowedImageRef = (value: string) =>
  isUploadPath(value) || isR2Key(value) || isPendingUpload(value) || isPublicSitePath(value);

const optionalImageKey = (label: string) =>
  z
    .string()
    .nullish()
    .superRefine((raw, ctx) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) return;
      if (isAllowedImageRef(value)) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be uploaded (no external image URL)`,
      });
    })
    .transform((raw) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return value.length === 0 ? null : value;
    });

const requiredImageKey = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required — upload an image`)
    .superRefine((value, ctx) => {
      if (isAllowedImageRef(value)) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be uploaded (no external image URL)`,
      });
    });

const optionalUrl = (label: string) =>
  z
    .string()
    .nullish()
    .superRefine((raw, ctx) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) return;
      if (isUploadPath(value) || isR2Key(value) || isPendingUpload(value)) return;
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid URL starting with http:// or https://`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return value.length === 0 ? null : value;
    });

const hasProtocol = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

const withHttps = (value: string) => (hasProtocol(value) ? value : `https://${value}`);

/**
 * For links opened in a browser (portals). Accepts an absolute http(s) link or a
 * same-site path like "/result"; unlike optionalUrl it rejects storage keys,
 * which would otherwise render as a broken relative link on the public site.
 */
const optionalExternalUrl = (label: string) =>
  z
    .string()
    .nullish()
    .superRefine((raw, ctx) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0 || value.startsWith('/')) return;
      try {
        const url = new URL(withHttps(value));
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
          throw new Error();
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a full link such as https://portal.example.com, or a path such as /result`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) return null;
      return value.startsWith('/') ? value : withHttps(value);
    });

const requiredPhone = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .refine((value) => PHONE_NUMBER.test(value), {
    message: 'Phone number must be 11 digits and start with 01',
  });

const requiredEmail = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Email format is invalid');

const optionalEiin = z
  .string()
  .nullish()
  .superRefine((raw, ctx) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length > 0 && !/^\d{6}$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EIIN must be exactly 6 digits',
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value.length === 0 ? null : value;
  });

const optionalSubdomain = z
  .string()
  .nullish()
  .superRefine((raw, ctx) => {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (value.length > 0 && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Subdomain can contain lowercase letters, numbers, and hyphens only',
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    return value.length === 0 ? null : value;
  });

const optionalCustomDomain = z
  .string()
  .nullish()
  .superRefine((raw, ctx) => {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (value.length > 0 && !/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom domain must be a valid domain (e.g. school.edu)',
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    return value.length === 0 ? null : value;
  });

// ─── JSON profile shapes ─────────────────────────────────────────────────────

const optionalProfileString = (maxLength: number, label: string) =>
  optionalTrimmedString(maxLength, label);

const optionalEnumValue = <T extends string>(values: readonly [T, ...T[]], label: string) =>
  z
    .enum(values)
    .or(z.literal(''))
    .nullish()
    .superRefine((raw, ctx) => {
      if (raw === '' || raw == null) return;
      if (!(values as readonly string[]).includes(raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be one of: ${values.join(', ')}`,
        });
      }
    })
    .transform((raw) => (raw === '' || raw == null ? null : raw));

const optionalGroupsValue = z
  .string()
  .nullish()
  .transform((raw) => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const parts = [
      ...new Set(
        raw
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ];
    return parts.length === 0 ? null : parts.join(', ');
  })
  .superRefine((value, ctx) => {
    if (!value) return;
    for (const group of value.split(', ')) {
      if (!VALID_GROUPS.includes(group as (typeof VALID_GROUPS)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid group: ${group}. Allowed: ${VALID_GROUPS.join(', ')}`,
        });
      }
    }
  });

export const schoolSubjectsSchema = optionalGroupsValue;
export const schoolMediumSchema = optionalEnumValue(SCHOOL_MEDIUMS, 'Medium');
export const schoolBoardSchema = optionalEnumValue(SCHOOL_BOARDS, 'Board');
export const schoolOwnershipSchema = optionalEnumValue(SCHOOL_OWNERSHIPS, 'Ownership');
export const schoolGenderSchema = optionalEnumValue(SCHOOL_GENDERS, 'School for');

export const schoolDescriptionsSchema = z
  .object({
    main: optionalProfileString(5000, 'Main description'),
    sub: optionalProfileString(5000, 'Sub description'),
  })
  .partial()
  .nullable()
  .optional();

export const schoolAcademicProfileSchema = z
  .object({
    grades: optionalProfileString(100, 'Grades'),
    ageRange: optionalProfileString(50, 'Age range'),
    enrollment: optionalProfileString(100, 'Enrollment'),
    studentTeacherRatio: optionalProfileString(50, 'Student-teacher ratio'),
    colors: optionalProfileString(200, 'Uniform colors'),
    campusArea: optionalProfileString(200, 'Campus area'),
    playgroundArea: optionalProfileString(200, 'Playground area'),
  })
  .partial()
  .nullable()
  .optional();

export const defaultSchoolSidebarConfig = {
  /** All education boards (hardcoded). */
  important: [
    {
      title: 'Dhaka Education Board',
      url: 'https://www.dhakaeducationboard.gov.bd/',
    },
    {
      title: 'Rajshahi Education Board',
      url: 'https://rajshahieducationboard.gov.bd/',
    },
    {
      title: 'Chattogram Education Board',
      url: 'https://web.bise-ctg.gov.bd/bisectg',
    },
    {
      title: 'Cumilla Education Board',
      url: 'https://comillaboard.gov.bd/',
    },
    {
      title: 'Jashore Education Board',
      url: 'https://www.jessoreboard.gov.bd/',
    },
    {
      title: 'Barishal Education Board',
      url: 'https://www.barisalboard.gov.bd/',
    },
    {
      title: 'Sylhet Education Board',
      url: 'https://www.sylhetboard.gov.bd/',
    },
    {
      title: 'Dinajpur Education Board',
      url: 'https://dinajpurboard.gov.bd/',
    },
    {
      title: 'Mymensingh Education Board',
      url: 'https://mymensingheducationboard.gov.bd/',
    },
    {
      title: 'Bangladesh Technical Education Board',
      url: 'https://bteb.gov.bd/',
    },
    {
      title: 'Bangladesh Madrasah Education Board',
      url: 'https://bmeb.gov.bd/',
    },
  ],
  /** Government offices & ministries. */
  quick: [
    { title: 'প্রধানমন্ত্রীর কার্যালয়', url: 'https://pmo.gov.bd/' },
    {
      title: 'রাষ্ট্রপতির কার্যালয়',
      url: 'https://bangabhaban.gov.bd/',
    },
    { title: 'মন্ত্রিপরিষদ বিভাগ', url: 'https://cabinet.gov.bd/' },
    { title: 'জনপ্রশাসন মন্ত্রণালয়', url: 'https://mopa.gov.bd/' },
    { title: 'অর্থ মন্ত্রণালয়', url: 'https://mof.gov.bd/' },
    { title: 'শিক্ষা মন্ত্রণালয়', url: 'https://moedu.gov.bd/' },
    { title: 'মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর', url: 'https://dshe.gov.bd/' },
    { title: 'জাতীয় পোর্টাল', url: 'https://bangladesh.gov.bd/' },
    {
      title: 'জাতীয় শিক্ষা ব্যবস্থাপনা একাডেমি (নায়েম)',
      url: 'https://naem.gov.bd/',
    },
    {
      title: 'বাংলাদেশ শিক্ষাতথ্য ও পরিসংখ্যান ব্যুরো (ব্যানবেইস)',
      url: 'https://banbeis.gov.bd/',
    },
    { title: 'ই-নথি', url: 'https://www.nothi.gov.bd/' },
  ],
  /** National education tools, services & citizen portals (no zone/area-specific links). */
  useful: [
    { title: 'Education Board Results', url: 'http://www.educationboard.gov.bd/' },
    { title: 'National University', url: 'https://www.nu.ac.bd/' },
    { title: 'Muktopaath', url: 'https://muktopaath.gov.bd/' },
    { title: 'Shikkhak Batayon', url: 'https://www.teachers.gov.bd/' },
    { title: 'eksheba', url: 'https://eksheba.gov.bd/' },
    { title: 'EMIS | DSHE', url: 'http://emis.gov.bd/' },
    {
      title: 'IBAS++ Version Selector',
      url: 'https://ibas.finance.gov.bd/',
    },
    {
      title: 'ইমিগ্রেশন ও পাসপোর্ট অধিদপ্তর',
      url: 'https://dip.gov.bd/',
    },
    { title: 'বাংলাদেশ ফরম / myGov', url: 'https://www.mygov.bd/' },
  ],
  hotlines: [
    {
      title: 'Emergency Hotline',
      image: '/biwta.jpeg',
    },
    {
      title: 'National Helpline',
      image: '/National-Helpline.jpg',
    },
  ],
} as const;

const bannerUrlItem = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    if (isAllowedImageRef(value)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Banner must be uploaded (no external image URL)',
    });
  });

export const schoolBannerUrlsSchema = z
  .array(bannerUrlItem)
  .max(12)
  .nullish()
  .transform((raw) => {
    if (!raw || !Array.isArray(raw)) return null;
    const cleaned = raw.map((v) => v.trim()).filter(Boolean);
    return cleaned.length === 0 ? null : cleaned;
  });

export const SCHOOL_ASSET_KINDS = ['logo', 'header', 'banner', 'hotline'] as const;
export type SchoolAssetKind = (typeof SCHOOL_ASSET_KINDS)[number];

export const schoolAssetUploadSchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  kind: z.enum(SCHOOL_ASSET_KINDS).default('logo'),
});

// ─── schema ──────────────────────────────────────────────────────────────────

const schoolBaseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'School name must be at least 2 characters')
      .max(200, 'School name cannot exceed 200 characters'),
    shortName: optionalTrimmedString(50, 'Short name'),
    eiin: optionalEiin,
    logo: requiredImageKey('Logo'),
    district: z
      .string()
      .trim()
      .min(1, 'District is required')
      .refine((v) => districtIds.has(v), { message: 'District is invalid' }),
    upazila: z
      .string()
      .trim()
      .min(1, 'Upazila is required')
      .refine((v) => upazilaIds.has(v), { message: 'Upazila is invalid' }),
    phone: requiredPhone,
    email: requiredEmail,
    establishedIn: z
      .union([z.number(), z.string(), z.null()])
      .nullish()
      .superRefine((raw, ctx) => {
        if (raw === null || raw === undefined || raw === '') return;
        const parsed =
          typeof raw === 'number'
            ? Number.isFinite(raw)
              ? Math.trunc(raw)
              : NaN
            : parseInt(String(raw), 10);
        if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1800 || parsed > currentYear) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Established year must be between 1800 and ${currentYear}`,
          });
        }
      })
      .transform((raw) => {
        if (raw === null || raw === undefined || raw === '') return null;
        const parsed = typeof raw === 'number' ? Math.trunc(raw) : parseInt(String(raw), 10);
        return isNaN(parsed) ? null : parsed;
      }),
    subdomain: optionalSubdomain,
    customDomain: optionalCustomDomain,
    gaMeasurementId: optionalTrimmedString(50, 'Google Analytics Measurement ID'),
    nameBn: optionalTrimmedString(300, 'Bengali Name'),
    centerCode: optionalTrimmedString(50, 'Center Code'),
    schoolCode: optionalTrimmedString(50, 'School Code'),
    subjectGroups: schoolSubjectsSchema,
    medium: schoolMediumSchema,
    board: schoolBoardSchema,
    ownership: schoolOwnershipSchema,
    gender: schoolGenderSchema,
    headerLogo: optionalImageKey('Header Logo'),
    bannerUrls: schoolBannerUrlsSchema,
    address: optionalTrimmedString(500, 'Address'),
    mapEmbedUrl: optionalTrimmedString(5000, 'Map Embed URL'),
    nationalizedYear: optionalTrimmedString(20, 'Nationalized Year'),
    resultsUrl: optionalExternalUrl('Results URL'),
    teacherLoginUrl: optionalExternalUrl('Teacher Login URL'),
    studentLoginUrl: optionalExternalUrl('Student Login URL'),
    descriptions: schoolDescriptionsSchema,
    academicProfile: schoolAcademicProfileSchema,
    seo: z.any().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.upazila && value.district) {
      const belongs = upazilas.some(
        (u) => u.id === value.upazila && u.districtId === value.district,
      );
      if (!belongs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['upazila'],
          message: 'Selected upazila does not belong to the selected district',
        });
      }
    }
  });

export const createSchoolSchema = schoolBaseSchema;
export const updateSchoolSchema = schoolBaseSchema;

export type CreateSchoolSchemaData = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolSchemaData = z.infer<typeof updateSchoolSchema>;
