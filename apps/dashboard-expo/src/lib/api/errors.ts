/**
 * One error type for every failure the API client can produce.
 *
 * Error bodies verified in server/ (main @ 13003bf4):
 * - Legacy Express + Nest (via LegacyErrorFilter -> errorHandler -> buildClientErrorBody):
 *   `{ success: false, message, errors, error }`
 * - Nest unmatched route: `{ success: false, message: 'Route not found' }`
 * - Tenant middleware: `{ message }` (404 "School not found")
 * - Subscription gate: 402 `{ success: false, message, data: { access_state, is_locked, ... }, errors: [] }`
 * - express-rate-limit: 429 `{ message }`
 * - Edge auth proxy (workers/shared/auth-proxy.js) refresh failure: 401 `{ success: false }`
 * Anything else (HTML from a proxy, empty body) is treated as an opaque HTTP error.
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'parse' | 'config';

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number | null;
  path?: string;
  details?: unknown[];
  data?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly path: string | undefined;
  /** `errors` array from the server body (validation messages etc.), if any. */
  readonly details: unknown[];
  /** `data` from an error body, e.g. subscription access state on 402. */
  readonly data: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.path = init.path;
    this.details = init.details ?? [];
    this.data = init.data;
    if (init.cause !== undefined) {
      (this as { cause?: unknown }).cause = init.cause;
    }
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  /** Subscription locked. Not an auth failure: never sign the user out for it. */
  get isSubscriptionLocked() {
    return this.status === 402;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  /** No HTTP response at all (offline, DNS, CORS, timeout). Never an auth failure. */
  get isTransport() {
    return this.kind === 'network' || this.kind === 'timeout';
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const defaultMessageForStatus = (status: number): string => {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 402) return 'Subscription access is locked.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'Not found.';
  if (status === 429) return 'Too many requests. Please wait a moment.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return `Request failed (${status}).`;
};

/** Build an ApiError from a non-2xx response body (already parsed JSON, text, or null). */
export function errorFromResponseBody(status: number, body: unknown, path?: string): ApiError {
  let message: string | undefined;
  let details: unknown[] = [];
  let data: unknown;

  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message.trim()) message = body.message;
    else if (typeof body.error === 'string' && body.error.trim()) message = body.error;
    if (Array.isArray(body.errors)) details = body.errors;
    if ('data' in body) data = body.data;
  }

  return new ApiError({
    kind: 'http',
    status,
    path,
    message: message ?? defaultMessageForStatus(status),
    details,
    data,
  });
}
