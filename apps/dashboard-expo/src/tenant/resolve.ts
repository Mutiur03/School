/**
 * Which school is this app instance talking to?
 *
 * The backend decides the tenant from the request hostname (server/src/middlewares/
 * tenant.middleware.ts + utils/tenantHost.util.ts). In production it reads X-Forwarded-Host,
 * which the tenant-router / auth-bff workers set from the host the client called. The client
 * never sends a school id, and this module never invents one: it only predicts which host the
 * API will see, so caches and storage can be namespaced by it.
 *
 * - Web, same-origin (EXPO_PUBLIC_API_BASE_URL empty): the page host, e.g.
 *   `<school>-dashboard.mutiurrahman.com` or a school's custom domain.
 * - Web or native with EXPO_PUBLIC_API_BASE_URL: that host.
 * - Local development: EXPO_PUBLIC_DEV_TENANT_HOST, which the client sends as `x-tenant-host`
 *   (honoured by the backend only when NODE_ENV !== 'production').
 */
import type { RuntimePlatform } from '@/config/build-config';

export type TenantSource = 'dev-override' | 'api-host' | 'page-host' | 'unresolved';

export interface TenantResolution {
  /** Stable cache/storage namespace. Lowercase host without port, or 'unresolved'. */
  tenantKey: string;
  host: string | null;
  source: TenantSource;
}

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  let host = trimmed;
  if (trimmed.includes('://')) {
    const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/.exec(trimmed);
    host = match?.[1] ?? '';
  }
  host = host.replace(/^[^@]*@/, '').replace(/:\d+$/, '');
  return /^[a-z0-9.-]+$/.test(host) ? host : null;
}

export function resolveTenant(input: {
  platform: RuntimePlatform;
  pageHost: string | null;
  apiBaseUrl: string;
  devTenantHost: string | null;
}): TenantResolution {
  const dev = normalizeHost(input.devTenantHost);
  if (dev) return { tenantKey: dev, host: dev, source: 'dev-override' };

  const apiHost = normalizeHost(input.apiBaseUrl);
  if (apiHost) return { tenantKey: apiHost, host: apiHost, source: 'api-host' };

  if (input.platform === 'web') {
    const page = normalizeHost(input.pageHost);
    if (page) return { tenantKey: page, host: page, source: 'page-host' };
  }

  return { tenantKey: 'unresolved', host: null, source: 'unresolved' };
}
