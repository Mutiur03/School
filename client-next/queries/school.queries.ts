import { cache } from 'react';
import { api, getFileUrl } from '@/lib/backend';
import { defaultSchoolSidebarConfig } from '@school/shared-schemas';
import type { SchoolConfig } from '@/types';

/** Tenant-neutral shell — never hardcode a real school's identity. */
const emptySchoolConfig: SchoolConfig = {
  name: {
    en: '',
    bn: '',
    shortEn: '',
  },
  contact: {
    website: '',
    email: '',
    phone: '',
    address: '',
    district: '',
    upazila: '',
  },
  identifiers: {
    eiin: '',
    centerCode: '',
    schoolCode: '',
  },
  history: {
    established: '',
    nationalized: '',
  },
  academic: {
    grades: '',
    ageRange: '',
    subjects: '',
    enrollment: '',
    studentTeacherRatio: '',
    medium: '',
    board: '',
    ownership: '',
    gender: '',
    headmaster: '',
    colors: '',
    campusArea: '',
    playgroundArea: '',
  },
  links: {
    results: '/result',
  },
  sidebarLinks: {
    important: defaultSchoolSidebarConfig.important.map((l) => ({ ...l })),
    quick: defaultSchoolSidebarConfig.quick.map((l) => ({ ...l })),
    useful: defaultSchoolSidebarConfig.useful.map((l) => ({ ...l })),
    hotlines: defaultSchoolSidebarConfig.hotlines.map((l) => ({ ...l })),
  },
  map: {
    embedUrl: undefined,
  },
  assets: {
    logo: undefined,
    headerLogo: undefined,
    banners: [],
  },
  descriptions: {
    main: '',
    sub: '',
  },
  gaMeasurementId: undefined,
};

const getString = (value: unknown, fallback: string | undefined) =>
  typeof value === 'string' && value.trim() ? value : (fallback ?? '');

const getOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;

const getStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const resolveBannerUrls = (info: Record<string, unknown>): string[] => {
  const raw = info.bannerUrls ?? info.banners;
  const list = getStringArray(raw) ?? [];
  return list.map((item) => getFileUrl(item) || item).filter(Boolean);
};

const mapPublicSchoolInfoToConfig = (info: Record<string, unknown> | null) => {
  if (!info || typeof info !== 'object') return null;

  const seo =
    info.seo && typeof info.seo === 'object' ? (info.seo as Record<string, unknown>) : info;
  const academicProfile = asRecord(info.academicProfile) ?? {};
  const descriptions = asRecord(info.descriptions) ?? {};

  const gaMeasurementId =
    getOptionalString(info.gaMeasurementId) ??
    getOptionalString(info.ga4MeasurementId) ??
    getOptionalString(info.googleAnalyticsMeasurementId);

  const banners = resolveBannerUrls(info);
  const logoUrl = getFileUrl(getString(info.logo, '')) || undefined;
  const headerLogoUrl = getFileUrl(getString(info.headerLogo, '')) || undefined;
  const customDomain = getOptionalString(info.customDomain);
  const website = customDomain
    ? customDomain.startsWith('http')
      ? customDomain
      : `https://${customDomain}`
    : '';

  return {
    ...emptySchoolConfig,
    gaMeasurementId,
    name: {
      en: getString(info.name, emptySchoolConfig.name.en),
      bn: getString(info.nameBn, emptySchoolConfig.name.bn),
      shortEn: getString(info.shortName, emptySchoolConfig.name.shortEn),
    },
    contact: {
      website,
      email: getString(info.email, emptySchoolConfig.contact.email),
      phone: getString(info.phone, emptySchoolConfig.contact.phone),
      address: getString(info.address, emptySchoolConfig.contact.address),
      district: getString(info.district, emptySchoolConfig.contact.district),
      upazila: getString(info.upazila, emptySchoolConfig.contact.upazila),
    },
    identifiers: {
      eiin: getString(info.eiin, emptySchoolConfig.identifiers.eiin),
      centerCode: getString(info.centerCode, emptySchoolConfig.identifiers.centerCode),
      schoolCode: getString(info.schoolCode, emptySchoolConfig.identifiers.schoolCode),
    },
    history: {
      established: info.establishedIn
        ? String(info.establishedIn)
        : emptySchoolConfig.history.established,
      nationalized: getString(info.nationalizedYear, emptySchoolConfig.history.nationalized),
    },
    academic: {
      grades: getString(academicProfile.grades, emptySchoolConfig.academic.grades),
      ageRange: getString(academicProfile.ageRange, emptySchoolConfig.academic.ageRange),
      subjects: getString(
        info.subjectGroups ?? academicProfile.subjects,
        emptySchoolConfig.academic.subjects,
      ),
      enrollment: getString(academicProfile.enrollment, emptySchoolConfig.academic.enrollment),
      studentTeacherRatio: getString(
        academicProfile.studentTeacherRatio,
        emptySchoolConfig.academic.studentTeacherRatio,
      ),
      medium: getString(info.medium ?? academicProfile.medium, emptySchoolConfig.academic.medium),
      board: getString(info.board ?? academicProfile.board, emptySchoolConfig.academic.board),
      ownership: getString(
        info.ownership ?? academicProfile.ownership,
        emptySchoolConfig.academic.ownership,
      ),
      gender: getString(info.gender ?? academicProfile.gender, emptySchoolConfig.academic.gender),
      headmaster: '',
      colors: getString(academicProfile.colors, emptySchoolConfig.academic.colors),
      campusArea: getString(academicProfile.campusArea, emptySchoolConfig.academic.campusArea),
      playgroundArea: getString(
        academicProfile.playgroundArea,
        emptySchoolConfig.academic.playgroundArea,
      ),
    },
    descriptions: {
      main: getString(descriptions.main, emptySchoolConfig.descriptions.main),
      sub: getString(descriptions.sub, emptySchoolConfig.descriptions.sub),
    },
    assets: {
      ...emptySchoolConfig.assets,
      logo: logoUrl,
      headerLogo: headerLogoUrl,
      banners,
    },
    map: {
      embedUrl: getOptionalString(info.mapEmbedUrl),
    },
    sidebarLinks: emptySchoolConfig.sidebarLinks,
    seo: {
      title:
        getOptionalString(seo.title) ??
        getOptionalString(seo.metaTitle) ??
        getOptionalString(info.name),
      description:
        getOptionalString(seo.description) ??
        getOptionalString(seo.metaDescription) ??
        getOptionalString(descriptions.main) ??
        getOptionalString(descriptions.sub),
      keywords: getStringArray(seo.keywords) ?? getStringArray(seo.metaKeywords),
      image:
        getOptionalString(seo.image) ??
        getOptionalString(seo.ogImage) ??
        getOptionalString(seo.twitterImage) ??
        logoUrl,
      canonicalUrl: getOptionalString(seo.canonicalUrl) ?? (website || undefined),
      noIndex: Boolean(seo.noIndex),
    },
    links: {
      results: getOptionalString(info.resultsUrl) ?? '/result',
      teacherLogin: getOptionalString(info.teacherLoginUrl),
      studentLogin: getOptionalString(info.studentLoginUrl),
    },
  } satisfies SchoolConfig;
};

/** Deduped per RSC request (layout metadata + body + Footer). */
export const fetchSchoolConfig = cache(async () => {
  try {
    const primary = await api.get<Record<string, unknown>>('/api/schools/public', {
      revalidate: 300,
    });
    const mappedPrimary = mapPublicSchoolInfoToConfig(primary?.data);
    if (mappedPrimary) return mappedPrimary;
  } catch (error) {
    console.warn(
      'Error fetching school config from /api/schools/public:',
      error instanceof Error ? error.message : error,
    );
  }

  return emptySchoolConfig;
});
