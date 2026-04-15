/* eslint-disable @typescript-eslint/no-explicit-any */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");
export default backend;
export const cdn = process.env.NEXT_PUBLIC_CDN_URL;

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Shared Axios client for all backend API requests.
// export const api = axios.create({
//   baseURL: backend,
// });

export const api = {
  get,
  post,
  put,
  delete: del,
  patch,
};
export const getFileUrl = (key: string | null): string => {
  if (!key) return "";
  if (key.startsWith("http") || key.startsWith("blob:")) return key;
  if (key.startsWith("/")) return `${cdn}${key}`;
  return `${cdn}/${key}`;
};

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
  const { params, revalidate = 60 } = options || {};
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

  const res = await fetch(`${backend}${url}${query}`, {
    method: "GET",
    next: { revalidate }, // SSR caching
  });

  return normalizeApiResponse<T>(await res.json());
}

async function post<T>(url: string, body?: any) {
  const res = await fetch(`${backend}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return normalizeApiResponse<T>(await res.json());
}

async function put<T>(url: string, body?: any) {
  const res = await fetch(`${backend}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return normalizeApiResponse<T>(await res.json());
}

async function del<T>(url: string) {
  const res = await fetch(`${backend}${url}`, {
    method: "DELETE",
  });

  return normalizeApiResponse<T>(await res.json());
}

async function patch<T>(url: string, body?: any) {
  const res = await fetch(`${backend}${url}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return normalizeApiResponse<T>(await res.json());
}
