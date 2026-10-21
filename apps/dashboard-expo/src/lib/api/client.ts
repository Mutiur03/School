/**
 * Platform-neutral fetch client for the School backend. No React or React Native imports, so it
 * runs under Node tests and can move to a shared package once a second consumer exists.
 */
import { ApiError, errorFromResponseBody, isApiError } from './errors';
import { unwrapEnvelope } from './envelope';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

/**
 * Hooks the client uses to authenticate. Implemented by SessionManager (src/lib/api/session.ts).
 */
export interface AuthHooks {
  /** Current access token (memory only), or null. */
  getAccessToken(): string | null;
  /**
   * Refresh the session once (single-flight inside the implementation).
   * Resolve true when a new access token is available, false when the session is gone.
   * Throw an ApiError for transport/5xx/429 failures: the session is kept in that case.
   */
  refresh(): Promise<boolean>;
  /** Called once when a 401 could not be recovered by refreshing. */
  onSessionExpired(error: ApiError): void;
  /**
   * Optional: wait until a token is available (or the session is known to be gone) before an
   * authenticated request without one goes out. Must never reject.
   */
  awaitAccessToken?(): Promise<void>;
}

export interface ApiClientOptions {
  /** API origin without `/api`; '' = same-origin (web). */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Default per-request timeout. */
  timeoutMs?: number;
  /**
   * 'include' on web so the browser sends the HttpOnly refresh cookie set by the backend or the
   * edge auth proxy. Native fetch ignores the CORS semantics but keeps its own cookie jar.
   */
  credentials?: RequestCredentials;
  /** Extra headers on every request, e.g. the local-dev `x-tenant-host`. */
  defaultHeaders?: () => Record<string, string>;
  auth?: AuthHooks;
}

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  /** Plain objects are sent as JSON; FormData/Blob/string are sent as-is. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Attach the bearer token and handle 401 with refresh. Default true. */
  auth?: boolean;
  /** Retry once after a successful refresh. Default true. */
  retryOn401?: boolean;
  /** 'json' unwraps the server envelope. Default 'json'. */
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
  /** Called with the successful response's headers (e.g. `X-Students-Created` on a file body). */
  onHeaders?: (headers: Headers) => void;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>;
  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>;
  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  readonly baseUrl: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  if (!path.startsWith('/')) {
    throw new ApiError({ kind: 'config', message: `API path must start with "/": ${path}`, path });
  }
  const params: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  const qs = params.length ? `${path.includes('?') ? '&' : '?'}${params.join('&')}` : '';
  return `${baseUrl}${path}${qs}`;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null || Array.isArray(value);
};

/**
 * Combine the caller's signal with a timeout without relying on AbortSignal.any / .timeout,
 * which are not available on every React Native runtime.
 */
function linkSignals(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort);
  }
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const baseUrl = options.baseUrl;

  async function execute<T>(path: string, opts: RequestOptions, isRetry: boolean): Promise<T> {
    const method = opts.method ?? 'GET';
    const useAuth = opts.auth !== false;
    const url = buildUrl(baseUrl, path, opts.query);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.defaultHeaders?.() ?? {}),
      ...(opts.headers ?? {}),
    };

    let body: BodyInit | undefined;
    if (opts.body !== undefined && opts.body !== null) {
      if (isPlainObject(opts.body)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.body);
      } else {
        body = opts.body as BodyInit;
      }
    }

    if (useAuth && !isRetry && options.auth?.awaitAccessToken && !options.auth.getAccessToken()) {
      await options.auth.awaitAccessToken();
    }
    const token = useAuth ? options.auth?.getAccessToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const linked = linkSignals(
      opts.signal,
      opts.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body,
        credentials: options.credentials,
        signal: linked.signal,
      });
    } catch (cause) {
      linked.cleanup();
      if (opts.signal?.aborted) {
        throw new ApiError({ kind: 'aborted', message: 'Request was cancelled.', path, cause });
      }
      if (linked.didTimeout()) {
        throw new ApiError({
          kind: 'timeout',
          message: 'The server took too long to respond.',
          path,
          cause,
        });
      }
      throw new ApiError({
        kind: 'network',
        message: 'Cannot reach the server. Check your connection.',
        path,
        cause,
      });
    }

    try {
      if (
        response.status === 401 &&
        useAuth &&
        options.auth &&
        opts.retryOn401 !== false &&
        !isRetry
      ) {
        const original = errorFromResponseBody(401, await readBody(response), path);
        let refreshed = false;
        try {
          refreshed = await options.auth.refresh();
        } catch (refreshError) {
          if (
            isApiError(refreshError) &&
            (refreshError.isUnauthorized || refreshError.isForbidden)
          ) {
            refreshed = false;
          } else {
            // Transport/5xx/429 during refresh: keep the session, surface the failure.
            throw refreshError;
          }
        }
        if (refreshed) return execute<T>(path, opts, true);
        options.auth.onSessionExpired(original);
        throw original;
      }

      if (!response.ok) {
        const parsed = await readBody(response);
        const error = errorFromResponseBody(response.status, parsed, path);
        if (response.status === 401 && useAuth && options.auth)
          options.auth.onSessionExpired(error);
        throw error;
      }

      opts.onHeaders?.(response.headers);
      const responseType = opts.responseType ?? 'json';
      if (responseType === 'blob') return (await response.blob()) as T;
      if (responseType === 'arrayBuffer') return (await response.arrayBuffer()) as T;
      if (responseType === 'text') return (await response.text()) as T;

      const parsed = await readBody(response);
      if (typeof parsed === 'string') {
        throw new ApiError({
          kind: 'parse',
          status: response.status,
          path,
          message: 'The server returned an unexpected response.',
        });
      }
      const unwrapped = unwrapEnvelope<T>(response.status, parsed, path);
      if ('error' in unwrapped) throw unwrapped.error;
      return unwrapped.data;
    } finally {
      linked.cleanup();
    }
  }

  const request = <T>(path: string, opts: RequestOptions = {}) => execute<T>(path, opts, false);

  return {
    baseUrl,
    request,
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
    patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
    delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  };
}
