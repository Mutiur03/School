import {
  REFRESH_PATH,
  LOGOUT_PATH,
  buildCorsHeaders,
  isPasswordResetPath,
  jsonResponse,
  parseCookies,
  resolveCorsOrigin,
  tryHandleAuthSession,
  withCors,
} from '../../shared/auth-proxy.js';

type Env = {
  BACKEND_URL: string;
};

const API_PREFIX = '/api';

const now = () => Date.now();

const requestId = (request: Request) =>
  request.headers.get('cf-ray') ||
  (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`);

const logRequest = (
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, unknown>,
) => {
  const line = JSON.stringify({ event, ...details });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const logAndReturn = ({
  response,
  id,
  startTime,
  requestUrl,
  targetUrl,
  method,
  branch,
}: {
  response: Response;
  id: string;
  startTime: number;
  requestUrl: URL;
  targetUrl: URL;
  method: string;
  branch: string;
}) => {
  logRequest(response.status >= 500 ? 'error' : 'info', 'auth-bff.response', {
    id,
    method,
    host: requestUrl.hostname,
    path: requestUrl.pathname,
    search: requestUrl.search,
    branch,
    targetOrigin: targetUrl.origin,
    targetPath: targetUrl.pathname,
    status: response.status,
    durationMs: now() - startTime,
  });

  return response;
};

const forwardRequest = (request: Request, targetUrl: URL, headers: Headers) =>
  fetch(
    new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    }),
  );

const forwardOrUnavailable = async (request: Request, targetUrl: URL, headers: Headers) => {
  try {
    return await forwardRequest(request, targetUrl, headers);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'auth-bff.backend-unavailable',
        targetOrigin: targetUrl.origin,
        targetPath: targetUrl.pathname,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonResponse(
      {
        success: false,
        message: 'Backend unavailable',
        target: targetUrl.origin,
      },
      502,
    );
  }
};

const resolveTenantContext = (
  request: Request,
  requestUrl: URL,
): { origin: string; hostname: string } => {
  const browserOrigin = request.headers.get('Origin');
  if (browserOrigin) {
    try {
      const parsed = new URL(browserOrigin);
      return {
        origin: browserOrigin,
        hostname: parsed.hostname.toLowerCase(),
      };
    } catch {
      // Fall through to forwarded host.
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (forwardedHost) {
    const cleanHost = forwardedHost.split(',')[0]?.trim() ?? forwardedHost;
    const hostname = cleanHost.replace(/:\d+$/, '').toLowerCase();
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
      requestUrl.protocol.replace(':', '');
    return {
      origin: `${proto}://${cleanHost}`,
      hostname,
    };
  }

  return {
    origin: requestUrl.origin,
    hostname: requestUrl.hostname.toLowerCase(),
  };
};

const applyTenantHeaders = (headers: Headers, request: Request, requestUrl: URL) => {
  const tenant = resolveTenantContext(request, requestUrl);
  headers.set('origin', tenant.origin);
  headers.set('referer', `${tenant.origin}/`);
  headers.set('x-forwarded-host', tenant.hostname);
  headers.set('x-tenant-host', tenant.hostname);
};

const sessionBranch = (pathname: string) => {
  if (pathname === REFRESH_PATH) return 'refresh';
  if (pathname === LOGOUT_PATH) return 'logout';
  return 'login';
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request);
    const startTime = now();
    const requestUrl = new URL(request.url);
    try {
      const originHeader = request.headers.get('Origin');
      const origin = resolveCorsOrigin(originHeader, requestUrl);

      if (!requestUrl.pathname.startsWith(API_PREFIX)) {
        const response = new Response('Not found', { status: 404 });
        logRequest('warn', 'auth-bff.response', {
          id,
          method: request.method,
          host: requestUrl.hostname,
          path: requestUrl.pathname,
          search: requestUrl.search,
          branch: 'not-api',
          status: response.status,
          durationMs: now() - startTime,
        });
        return response;
      }

      const corsHeaders = buildCorsHeaders(origin);

      const targetUrl = new URL(env.BACKEND_URL);
      targetUrl.pathname = requestUrl.pathname;
      targetUrl.search = requestUrl.search;

      const finish = (response: Response, branch: string) =>
        logAndReturn({
          response,
          id,
          startTime,
          requestUrl,
          targetUrl,
          method: request.method,
          branch,
        });

      if (request.method === 'OPTIONS') {
        const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
        if (requestedHeaders) {
          corsHeaders.set('Access-Control-Allow-Headers', requestedHeaders);
        } else {
          corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
        }
        return finish(new Response(null, { status: 204, headers: corsHeaders }), 'options');
      }

      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('content-length');

      const cookies = parseCookies(request.headers.get('cookie'));
      applyTenantHeaders(headers, request, requestUrl);

      const sessionResponse = await tryHandleAuthSession({
        request,
        pathname: requestUrl.pathname,
        headers,
        cookies,
        origin,
        corsHeaders,
        forward: (req: Request, hdrs: Headers) => forwardOrUnavailable(req, targetUrl, hdrs),
        logoutFailOn401: true,
      });
      if (sessionResponse) {
        return finish(sessionResponse, sessionBranch(requestUrl.pathname));
      }

      if (!isPasswordResetPath(requestUrl.pathname)) {
        const authorization = headers.get('Authorization');
        if (authorization?.toLowerCase().startsWith('bearer ')) {
          headers.delete('cookie');
        }
      }

      const backendResponse = await forwardOrUnavailable(request, targetUrl, headers);

      if (backendResponse.status === 401) {
        return finish(jsonResponse({ success: false }, 401, corsHeaders), 'api-unauthorized');
      }

      return finish(withCors(backendResponse, origin), 'api-proxy');
    } catch (error) {
      logRequest('error', 'auth-bff.error', {
        id,
        method: request.method,
        host: requestUrl.hostname,
        path: requestUrl.pathname,
        search: requestUrl.search,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: now() - startTime,
      });

      return new Response('Internal worker error', { status: 500 });
    }
  },
};
