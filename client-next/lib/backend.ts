/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from "next/headers";
import { resolveBackendBaseUrl } from "./resolveBackend";

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

async function getRequestOrigin() {
  try {
    const incomingHeaders = await headers();
    const host = incomingHeaders.get("x-forwarded-host") || incomingHeaders.get("host");

    if (!host) return undefined;

    const forwardedProto = incomingHeaders.get("x-forwarded-proto");
    const protocol =
      forwardedProto || (host.includes("localhost") ? "http" : "https");

    return `${protocol}://${host}`;
  } catch {
    return undefined;
  }
}

export async function getBackendBaseUrl(): Promise<string> {
  const origin = await getRequestOrigin();

  if (!origin) {
    return envBackend;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    return resolveBackendBaseUrl(hostname, protocol.replace(":", ""));
  } catch {
    return envBackend;
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

  const origin = await getRequestOrigin();
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

  logApiRequest("GET", requestUrl, backend, {
    params: sanitizedParams,
    revalidate,
    cache,
    origin,
  });

  try {
    const res = await fetch(requestUrl, {
      method: "GET",
      headers: origin ? { Origin: origin } : undefined,
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

  logApiRequest("POST", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

  logApiRequest("PUT", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
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

  logApiRequest("DELETE", requestUrl, backend);

  const res = await fetch(requestUrl, {
    method: "DELETE",
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

  logApiRequest("PATCH", requestUrl, backend, {
    bodyPreview: previewBody(body),
  });

  const res = await fetch(requestUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
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
