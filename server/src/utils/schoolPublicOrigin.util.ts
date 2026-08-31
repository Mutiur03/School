import { ApiError } from '@/utils/ApiError.js';
import { env } from '@/config/env.js';

export function schoolWebsiteHost(raw?: string | null): string {
  const value = raw?.trim();
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).hostname || '';
    return value.replace(/\/+$/, '').replace(/:\d+$/, '').split('/')[0] || '';
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0] || '';
  }
}

/** Public site origin for QR links — per-tenant, not a global frontend URL. */
export function schoolPublicOrigin(school: {
  customDomain?: string | null;
  subdomain?: string | null;
}): string {
  const custom = school.customDomain?.trim();
  if (custom) {
    return /^https?:\/\//i.test(custom)
      ? custom.replace(/\/+$/, '')
      : `https://${custom.replace(/\/+$/, '')}`;
  }

  const subdomain = school.subdomain?.trim();
  const domain = (env.DOMAIN || '').trim();
  if (subdomain && domain) {
    // Tenant public site is `{subdomain}-school{DOMAIN}` (e.g. foo-school.mutiurrahman.com)
    const suffix = domain.startsWith('.') ? domain : `.${domain}`;
    const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${subdomain}-school${suffix}`;
  }

  throw new ApiError(500, 'School public URL not configured');
}
