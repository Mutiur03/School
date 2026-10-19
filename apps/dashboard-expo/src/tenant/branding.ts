/**
 * Tenant branding derived from GET /api/schools/public. Pure functions, unit-tested.
 */
import type { PublicSchoolInfo } from '@/lib/api/school';
import type { TenantThemeOverrides } from '@/theme/ThemeProvider';

export interface TenantBranding {
  /** The tenant this branding belongs to. Checked before any cached value is used. */
  tenantKey: string;
  displayName: string;
  shortName: string | null;
  nameBn: string | null;
  logoUrl: string | null;
  /** Empty today: the backend exposes no theme settings. */
  theme: TenantThemeOverrides;
}

export type BrandingSource = 'server' | 'cache' | 'default';

export const DEFAULT_DISPLAY_NAME = 'School Dashboard';

export function defaultBranding(tenantKey: string): TenantBranding {
  return {
    tenantKey,
    displayName: DEFAULT_DISPLAY_NAME,
    shortName: null,
    nameBn: null,
    logoUrl: null,
    theme: {},
  };
}

export const PLATFORM_DISPLAY_NAME = 'Platform administration';

/** Platform (super-admin) mode has no school: fixed, local branding, nothing fetched. */
export function platformBranding(tenantKey: string): TenantBranding {
  return {
    ...defaultBranding(tenantKey),
    displayName: PLATFORM_DISPLAY_NAME,
    shortName: 'Platform',
  };
}

/**
 * Same rules as getFileUrl() in dashboard/src/lib/backend.ts, except that a bare key with no
 * CDN configured yields null instead of a broken relative URL.
 */
export function resolveFileUrl(key: string | null | undefined, cdnUrl: string): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  if (!cdnUrl) return null;
  return key.startsWith('/') ? `${cdnUrl}${key}` : `${cdnUrl}/${key}`;
}

const clean = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function mapSchoolInfoToBranding(
  info: PublicSchoolInfo,
  cdnUrl: string,
  tenantKey: string,
): TenantBranding {
  return {
    tenantKey,
    displayName: clean(info.name) ?? DEFAULT_DISPLAY_NAME,
    shortName: clean(info.shortName),
    nameBn: clean(info.nameBn),
    logoUrl: resolveFileUrl(clean(info.logo) ?? clean(info.headerLogo), cdnUrl),
    theme: {},
  };
}

export function serializeBranding(branding: TenantBranding): string {
  return JSON.stringify({ v: 1, ...branding });
}

/** Returns null unless the cached value is well-formed AND belongs to `expectedTenantKey`. */
export function parseCachedBranding(
  raw: string | null,
  expectedTenantKey: string,
): TenantBranding | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TenantBranding> & { v?: number };
    if (parsed.v !== 1 || parsed.tenantKey !== expectedTenantKey) return null;
    if (typeof parsed.displayName !== 'string') return null;
    return {
      tenantKey: parsed.tenantKey,
      displayName: parsed.displayName,
      shortName: typeof parsed.shortName === 'string' ? parsed.shortName : null,
      nameBn: typeof parsed.nameBn === 'string' ? parsed.nameBn : null,
      logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null,
      theme: {},
    };
  } catch {
    return null;
  }
}
