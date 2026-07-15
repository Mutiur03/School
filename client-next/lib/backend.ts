/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from "react";
import { headers } from "next/headers";
import {
  getDefaultTenantHost,
  getDevTenantHost,
  isBareLocalHost,
  isTenantHost,
  isTenantLocalDevHost,
  isVercelAppHost,
  resolveBackendBaseUrl,
  serverBackendUrl,
} from "./resolveBackend";

// Re-exported from cdn.ts so Server Components can still import from one place.
export { cdn, getFileUrl } from "./cdn";
export { resolveClientAxiosBaseUrl } from "./resolveBackend";

const envBackend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") || "";
const debugApi = process.env.NEXT_PUBLIC_API_DEBUG === "true";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const api = {
  get,
  post,
  put,
  delete: del,
  patch,
};

function logApiRequest(
  method: string,
  url: string,
  backendBase: string,
  details?: Record<string, unknown>,
) {
  if (!debugApi) return;

  console.log("[API request]", {
    method,
    url,
    backend: backendBase,
    ...details,
  });
}

function logApiResponse(
  method: string,
  url: string,
  details: Record<string, unknown>,
) {
  if (!debugApi) return;

  console.log("[API response]", {
    method,
    url,
    ...details,
  });
}

function previewBody(body: unknown) {
  if (body === undefined || body === null) return body;

  try {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
  } catch {
    return "[unserializable body]";
  }
}

type RequestContext = {
  host?: string;
  proto?: string;
  tenantHost?: string;
};

/** True when Next threw because headers() was used during static generation. */
function isDynamicServerUsageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

const getRequestContext = cache(async (): Promise<RequestContext> => {
  try {
    const incomingHeaders = await headers();
    const tenantHost = incomingHeaders.get("x-tenant-host")?.trim() || undefined;
    const host = (
      tenantHost ||
      incomingHeaders.get("x-forwarded-host") ||
      incomingHeaders.get("host") ||
      ""
    )
      .split(",")[0]
      ?.trim();

    const forwardedProto = incomingHeaders.get("x-forwarded-proto") || undefined;
    const proto =
      forwardedProto ||
      (host?.includes("localhost") ? "http" : host ? "https" : undefined);

    return { host: host || undefined, proto, tenantHost };
  } catch (error) {
    // During `next build` static generation there is no request; fall back to env.
    if (!isDynamicServerUsageError(error)) {
      console.warn("[backend] failed to read request headers:", error);
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
        ? getDefaultTenantHost() ?? hostname
        : hostname;

    return resolveBackendBaseUrl(
      effectiveHostname,
      protocol.replace(":", ""),
    );
  } catch {
    return envBackend || serverBackendUrl();
  }
}

async function getApiFetchHeaders(): Promise<HeadersInit | undefined> {
  const { host, proto, tenantHost } = await getRequestContext();

  if (tenantHost) {
    const protocol = proto || (tenantHost.includes("localhost") ? "http" : "https");
    return {
      Origin: `${protocol}://${tenantHost}`,
      "x-forwarded-host": tenantHost,
      "x-tenant-host": tenantHost,
    };
  }

  if (!host || !proto) return undefined;

  try {
    const requestOrigin = `${proto}://${host}`;
    const { hostname, protocol } = new URL(requestOrigin);
    const resolvedProto = protocol.replace(":", "");

    if (isBareLocalHost(hostname)) {
      const resolvedTenantHost = getDevTenantHost();
      return {
        Origin: `${resolvedProto}://${resolvedTenantHost}`,
        "x-forwarded-host": resolvedTenantHost,
        "x-tenant-host": resolvedTenantHost,
      };
    }

    if (isTenantLocalDevHost(hostname) || isTenantHost(hostname)) {
      return {
        Origin: `${resolvedProto}://${hostname}`,
        "x-forwarded-host": hostname,
        "x-tenant-host": hostname,
      };
    }

    if (isVercelAppHost(hostname)) {
      const defaultTenantHost = getDefaultTenantHost();
      if (defaultTenantHost) {
        return {
          Origin: `https://${defaultTenantHost}`,
          "x-forwarded-host": defaultTenantHost,
          "x-tenant-host": defaultTenantHost,
        };
      }
    }

    return {
      Origin: requestOrigin,
      "x-forwarded-host": host,
    };
  } catch {
    return undefined;
  }
}

function normalizeApiResponse<T>(payload: unknown): ApiResponse<T> {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "message" in payload &&
    "data" in payload
  ) {
    const typedPayload = payload as ApiResponse<T>;
    return typedPayload;
  }

  return {
    success: true,
    message: "OK",
    data: payload as T,
  };
}

async function get<T>(url: string, options?: any) {
  const { params, revalidate = 60, cache } = options || {};
  const backend = await getBackendBaseUrl();

  if (!backend) {
    logApiRequest("GET", url, backend, {
      skipped: true,
      reason: "backend base URL is not set",
      params,
    });
    return normalizeApiResponse<T>(null);
  }

  const sanitizedParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      )
    : undefined;

  const query =
    sanitizedParams && Object.keys(sanitizedParams).length > 0
      ? "?" +
        new URLSearchParams(
          sanitizedParams as Record<string, string>,
        ).toString()
      : "";
  const requestUrl = `${backend}${url}${query}`;
  const apiHeaders = await getApiFetchHeaders();

  logApiRequest("GET", requestUrl, backend, {
    params: sanitizedParams,
    revalidate,
    cache,
    apiHeaders,
  });

  try {
    const res = await fetch(requestUrl, {
      method: "GET",
      headers: apiHeaders,
      cache,
      next: cache === "no-store" ? undefined : { revalidate }, // SSR caching
    });
    const text = await res.text();

    logApiResponse("GET", requestUrl, {
      status: res.status,
      ok: res.ok,
      bodyPreview: previewBody(text),
    });

    if (!res.ok) {
      return normalizeApiResponse<T>(null);
    }

    return normalizeApiResponse<T>(JSON.parse(text));
  } catch (error) {
    logApiResponse("GET", requestUrl, {
      error: error instanceof Error ? error.message : String(error),
    });
    return normalizeApiResponse<T>(null);
  }
}

async function post<T>(url: string, body?: any) {
  const backend = await getBackendBaseUrl();
  const requestUrl = `${backend}${url}`;
  const apiHeaders = await getApiFetchHeaders();

  logApiRequest("POST", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  logApiResponse("POST", requestUrl, {
    status: res.status,
    ok: res.ok,
    bodyPreview: previewBody(text),
  });

  return normalizeApiResponse<T>(JSON.parse(text));
}

async function put<T>(url: string, body?: any) {
  const backend = await getBackendBaseUrl();
  const requestUrl = `${backend}${url}`;
  const apiHeaders = await getApiFetchHeaders();

  logApiRequest("PUT", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  logApiResponse("PUT", requestUrl, {
    status: res.status,
    ok: res.ok,
    bodyPreview: previewBody(text),
  });

  return normalizeApiResponse<T>(JSON.parse(text));
}

async function del<T>(url: string) {
  const backend = await getBackendBaseUrl();
  const requestUrl = `${backend}${url}`;
  const apiHeaders = await getApiFetchHeaders();

  logApiRequest("DELETE", requestUrl, backend);

  const res = await fetch(requestUrl, {
    method: "DELETE",
    headers: apiHeaders,
  });
  const text = await res.text();

  logApiResponse("DELETE", requestUrl, {
    status: res.status,
    ok: res.ok,
    bodyPreview: previewBody(text),
  });

  return normalizeApiResponse<T>(JSON.parse(text));
}

async function patch<T>(url: string, body?: any) {
  const backend = await getBackendBaseUrl();
  const requestUrl = `${backend}${url}`;
  const apiHeaders = await getApiFetchHeaders();

  logApiRequest("PATCH", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  logApiResponse("PATCH", requestUrl, {
    status: res.status,
    ok: res.ok,
    bodyPreview: previewBody(text),
  });

  return normalizeApiResponse<T>(JSON.parse(text));
}
