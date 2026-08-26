/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';
import {
  getDefaultTenantHost,
  getDevTenantHost,
  isBareLocalHost,
  isTenantHost,
  isTenantLocalDevHost,
  isVercelAppHost,
  resolveBackendBaseUrl,
  serverBackendUrl,
} from './resolveBackend';

// Re-exported from cdn.ts so Server Components can still import from one place.
export { cdn, getFileUrl } from './cdn';
export { resolveClientAxiosBaseUrl } from './resolveBackend';

const envBackend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') || '';
const debugApi = process.env.NEXT_PUBLIC_API_DEBUG === 'true';

/** Per-attempt deadline. Serverless + Cloudflare often reset idle keepalives; fail fast and retry. */
const FETCH_TIMEOUT_MS = Number(process.env.API_FETCH_TIMEOUT_MS || 8_000);

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const api = { get };

function logApiRequest(
  method: string,
  url: string,
  backendBase: string,
  details?: Record<string, unknown>,
) {
  if (!debugApi) return;

  console.log('[API request]', {
    method,
    url,
    backend: backendBase,
    ...details,
  });
}

function logApiResponse(method: string, url: string, details: Record<string, unknown>) {
  if (!debugApi) return;

  console.log('[API response]', {
    method,
    url,
    ...details,
  });
}

function previewBody(body: unknown) {
  if (body === undefined || body === null) return body;

  try {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
  } catch {
    return '[unserializable body]';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getFetchErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object' && 'code' in cause) {
    return String((cause as { code?: unknown }).code);
  }

  return undefined;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('aborted') ||
      error.message.toLowerCase().includes('timeout'))
  );
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isAbortError(error)) return true;

  const code = getFetchErrorCode(error);
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT'
  ) {
    return true;
  }

  return error.message.toLowerCase().includes('fetch failed');
}

function mergeAbortSignals(
  ...signals: Array<AbortSignal | null | undefined>
): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }
  return active[0];
}

function createAttemptSignal(userSignal?: AbortSignal | null): {
  signal?: AbortSignal;
  cleanup: () => void;
} {
  const timeoutSignal =
    typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined;

  if (!timeoutSignal && !userSignal) {
    return { signal: undefined, cleanup: () => undefined };
  }

  return {
    signal: mergeAbortSignals(userSignal, timeoutSignal),
    cleanup: () => undefined,
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: { retries?: number; backoffMs?: number },
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const backoffMs = options?.backoffMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, cleanup } = createAttemptSignal(init.signal);
    try {
      // Do not set keepalive: true — dead sockets on Vercel serverless cause
      // ECONNRESET / UND_ERR_SOCKET against Cloudflare-fronted backends.
      const res = await fetch(url, {
        ...init,
        signal,
      });

      if (attempt < retries && [502, 503, 504, 524].includes(res.status)) {
        await sleep(backoffMs * (attempt + 1));
        continue;
      }

      return res;
    } catch (error) {
      lastError = error;

      if (attempt < retries && isRetryableFetchError(error)) {
        await sleep(backoffMs * (attempt + 1));
        continue;
      }

      throw error;
    } finally {
      cleanup();
    }
  }

  throw lastError;
}

type RequestContext = {
  host?: string;
  proto?: string;
  tenantHost?: string;
};

/** True when Next threw because headers() was used during static generation. */
function isDynamicServerUsageError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    (error as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
  );
}

const getRequestContext = cache(async (): Promise<RequestContext> => {
  try {
    const incomingHeaders = await headers();
    const tenantHost = incomingHeaders.get('x-tenant-host')?.trim() || undefined;
    const host = (
      tenantHost ||
      incomingHeaders.get('x-forwarded-host') ||
      incomingHeaders.get('host') ||
      ''
    )
      .split(',')[0]
      ?.trim();

    const forwardedProto = incomingHeaders.get('x-forwarded-proto') || undefined;
    const proto =
      forwardedProto || (host?.includes('localhost') ? 'http' : host ? 'https' : undefined);

    return { host: host || undefined, proto, tenantHost };
  } catch (error) {
    // During `next build` static generation there is no request; fall back to env.
    if (!isDynamicServerUsageError(error)) {
      console.warn('[backend] failed to read request headers:', error);
    }
    return {};
  }
});

async function getRequestOrigin() {
  const { host, proto } = await getRequestContext();
  if (!host || !proto) return undefined;
  return `${proto}://${host}`;
}

export async function getBackendBaseUrl(): Promise<string> {
  const origin = await getRequestOrigin();

  if (!origin) {
    return envBackend || serverBackendUrl();
  }

  try {
    const { hostname, protocol } = new URL(origin);
    const effectiveHostname =
      isVercelAppHost(hostname) && !isTenantHost(hostname)
        ? (getDefaultTenantHost() ?? hostname)
        : hostname;

    return resolveBackendBaseUrl(effectiveHostname, protocol.replace(':', ''));
  } catch {
    return envBackend || serverBackendUrl();
  }
}

async function getApiFetchHeaders(): Promise<HeadersInit | undefined> {
  const { host, proto, tenantHost } = await getRequestContext();

  if (tenantHost) {
    const protocol = proto || (tenantHost.includes('localhost') ? 'http' : 'https');
    return {
      Origin: `${protocol}://${tenantHost}`,
      'x-forwarded-host': tenantHost,
      'x-tenant-host': tenantHost,
    };
  }

  if (!host || !proto) return undefined;

  try {
    const requestOrigin = `${proto}://${host}`;
    const { hostname, protocol } = new URL(requestOrigin);
    const resolvedProto = protocol.replace(':', '');

    if (isBareLocalHost(hostname)) {
      const resolvedTenantHost = getDevTenantHost();
      return {
        Origin: `${resolvedProto}://${resolvedTenantHost}`,
        'x-forwarded-host': resolvedTenantHost,
        'x-tenant-host': resolvedTenantHost,
      };
    }

    if (isTenantLocalDevHost(hostname) || isTenantHost(hostname)) {
      return {
        Origin: `${resolvedProto}://${hostname}`,
        'x-forwarded-host': hostname,
        'x-tenant-host': hostname,
      };
    }

    if (isVercelAppHost(hostname)) {
      const defaultTenantHost = getDefaultTenantHost();
      if (defaultTenantHost) {
        return {
          Origin: `https://${defaultTenantHost}`,
          'x-forwarded-host': defaultTenantHost,
          'x-tenant-host': defaultTenantHost,
        };
      }
    }

    return {
      Origin: requestOrigin,
      'x-forwarded-host': host,
    };
  } catch {
    return undefined;
  }
}

function normalizeApiResponse<T>(payload: unknown): ApiResponse<T> {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'message' in payload &&
    'data' in payload
  ) {
    const typedPayload = payload as ApiResponse<T>;
    return typedPayload;
  }

  return {
    success: true,
    message: 'OK',
    data: payload as T,
  };
}

async function get<T>(url: string, options?: any) {
  const { params, revalidate = 120, cache: fetchCache } = options || {};
  const backend = await getBackendBaseUrl();
  const { host, tenantHost } = await getRequestContext();
  // Same backend URL is shared across tenants; key cache by tenant host.
  const tenantKey = (tenantHost || host || 'default').toLowerCase();

  if (!backend) {
    logApiRequest('GET', url, backend, {
      skipped: true,
      reason: 'backend base URL is not set',
      params,
    });
    return normalizeApiResponse<T>(null);
  }

  const sanitizedParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
      )
    : undefined;

  const query =
    sanitizedParams && Object.keys(sanitizedParams).length > 0
      ? '?' + new URLSearchParams(sanitizedParams as Record<string, string>).toString()
      : '';
  const requestUrl = `${backend}${url}${query}`;
  const apiHeaders = await getApiFetchHeaders();
  // Serializable so unstable_cache revalidation does not reuse another tenant's closure.
  const headersJson = JSON.stringify(apiHeaders ?? {});

  logApiRequest('GET', requestUrl, backend, {
    params: sanitizedParams,
    revalidate,
    cache: fetchCache,
    tenantKey,
    apiHeaders,
  });

  const runFetch = async (
    cachedUrl: string,
    cachedTenant: string,
    cachedHeadersJson: string,
  ): Promise<ApiResponse<T>> => {
    const cachedHeaders = JSON.parse(cachedHeadersJson) as HeadersInit;
    try {
      const res = await fetchWithRetry(cachedUrl, {
        method: 'GET',
        headers: cachedHeaders,
        // Tenant isolation is via unstable_cache key args, not Next fetch cache.
        cache: 'no-store',
      });
      const text = await res.text();

      logApiResponse('GET', cachedUrl, {
        status: res.status,
        ok: res.ok,
        bodyPreview: previewBody(text),
        tenantKey: cachedTenant,
      });

      if (!res.ok) {
        return normalizeApiResponse<T>(null);
      }

      return normalizeApiResponse<T>(JSON.parse(text));
    } catch (error) {
      const code = getFetchErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);
      if (debugApi) {
        logApiResponse('GET', cachedUrl, {
          error: message,
          code,
          tenantKey: cachedTenant,
        });
      } else if (isRetryableFetchError(error)) {
        console.warn(`[API] GET soft-fail ${url}: ${code || message}`);
      } else {
        console.warn(`[API] GET soft-fail ${url}: ${message}`);
      }
      return normalizeApiResponse<T>(null);
    }
  };

  if (fetchCache === 'no-store') {
    return runFetch(requestUrl, tenantKey, headersJson);
  }

  // Args are part of the cache key → lbphs.gov.bd ≠ other-school.mutiurrahman.com
  const cachedGet = unstable_cache(runFetch, ['api-get'], {
    revalidate,
    tags: [`tenant:${tenantKey}`, `api:${url}`],
  });

  return cachedGet(requestUrl, tenantKey, headersJson);
}

