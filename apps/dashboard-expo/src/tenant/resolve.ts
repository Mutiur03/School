/**
 * Which school is this app instance talking to, and how?
 *
 * The backend decides the tenant from the request hostname (server/src/middlewares/
 * tenant.middleware.ts + utils/tenantHost.util.ts). In production it reads X-Forwarded-Host,
 * which the tenant-router / auth-bff workers set from the host the client called. The client
 * never sends a school id, and this module never invents one: it only predicts which host the
 * API will see, so caches and storage can be namespaced by it.
 *
 * Order:
 * 1. Local development: EXPO_PUBLIC_DEV_TENANT_HOST, sent as `x-tenant-host` (honoured by the
 *    backend only when NODE_ENV !== 'production').
 * 2. EXPO_PUBLIC_API_BASE_URL: a build pinned to one school (school codes do not apply).
 * 3. Web, same-origin: the page host, e.g. `<school>-dashboard.mutiurrahman.com` or a custom
 *    domain. It beats a stored school-code selection so web auth stays on first-party cookies.
 *    A bare localhost / 127.0.0.1 is never a school (the server 404s it).
 * 4. The school the user picked with a school code (host returned by the server lookup).
 * Otherwise unresolved: the app asks for a school code.
 */
import type { AppConfig, RuntimePlatform } from '@/config/build-config';

export type TenantSource = 'dev-override' | 'school-code' | 'api-host' | 'page-host' | 'unresolved';

export interface TenantResolution {
  /** Stable cache/storage namespace. Lowercase host without port, or 'unresolved'. */
  tenantKey: string;
  host: string | null;
  source: TenantSource;
}

/** Where requests go for a resolution. */
export interface TenantConnection {
  /** API origin without `/api`; '' = same-origin. */
  baseUrl: string;
  /** Value for `x-tenant-host` (local development only), else null. */
  tenantHeader: string | null;
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

const isBareLocalHost = (host: string) => host === 'localhost' || host === '127.0.0.1';

export function resolveTenant(input: {
  platform: RuntimePlatform;
  pageHost: string | null;
  apiBaseUrl: string;
  devTenantHost: string | null;
  /** Host from a confirmed school-code lookup. */
  selectedHost?: string | null;
}): TenantResolution {
  const dev = normalizeHost(input.devTenantHost);
  if (dev) return { tenantKey: dev, host: dev, source: 'dev-override' };

  const apiHost = normalizeHost(input.apiBaseUrl);
  if (apiHost) return { tenantKey: apiHost, host: apiHost, source: 'api-host' };

  if (input.platform === 'web') {
    const page = normalizeHost(input.pageHost);
    if (page && !isBareLocalHost(page)) return { tenantKey: page, host: page, source: 'page-host' };
  }

  const selected = normalizeHost(input.selectedHost);
  if (selected) return { tenantKey: selected, host: selected, source: 'school-code' };

  return { tenantKey: 'unresolved', host: null, source: 'unresolved' };
}

export function tenantConnection(
  resolution: TenantResolution,
  config: Pick<AppConfig, 'appEnv' | 'apiBaseUrl' | 'directoryUrl'>,
  selectedApiBaseUrl: string | null,
): TenantConnection {
  switch (resolution.source) {
    case 'dev-override':
      return { baseUrl: config.apiBaseUrl, tenantHeader: resolution.host };
    case 'school-code':
      // Local dev servers are reached through one origin and pick the school from the header;
      // real deployments are called on the school's own host (the edge resolves it from there).
      return config.appEnv === 'local'
        ? { baseUrl: config.directoryUrl, tenantHeader: resolution.host }
        : { baseUrl: selectedApiBaseUrl ?? '', tenantHeader: null };
    case 'api-host':
      return { baseUrl: config.apiBaseUrl, tenantHeader: null };
    case 'page-host':
      return { baseUrl: '', tenantHeader: null };
    default:
      return { baseUrl: config.directoryUrl, tenantHeader: null };
  }
}
