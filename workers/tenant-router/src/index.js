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

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const API_PREFIXES = ['/api', '/uploads'];

const now = () => Date.now();

const requestId = (request) =>
  request.headers.get('cf-ray') ||
  (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`);

const logRequest = (level, event, details) => {
  const payload = {
    event,
    ...details,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const getTenantSlug = (hostname, tenantHostSuffix) => {
  const suffix = tenantHostSuffix.toLowerCase();
  const lowerHostname = hostname.toLowerCase();

  if (!lowerHostname.endsWith(suffix)) return null;

  const slug = lowerHostname.slice(0, -suffix.length).trim();
  return slug || null;
};

const buildTargetUrl = ({ requestUrl, targetOrigin }) => {
  const targetUrl = new URL(requestUrl.toString());
  const origin = new URL(targetOrigin);

  targetUrl.protocol = origin.protocol;
  targetUrl.hostname = origin.hostname;
  targetUrl.port = origin.port;

  return targetUrl;
};

/** Keep HTML shells out of Cloudflare edge cache so deploys show up immediately. */
const withHtmlNoStore = (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const logAndReturn = ({
  response,
  id,
  startTime,
  requestUrl,
  targetUrl,
  method,
  slug,
  backendProxy,
  branch,
}) => {
  logRequest(response.status >= 500 ? 'error' : 'info', 'tenant-router.response', {
    id,
    method,
    host: requestUrl.hostname,
    path: requestUrl.pathname,
    search: requestUrl.search,
    slug,
    branch,
    backendProxy,
    targetOrigin: targetUrl.origin,
    targetPath: targetUrl.pathname,
    status: response.status,
    durationMs: now() - startTime,
  });

  return response;
};

const cloneHeaders = ({ request, originalHost, slug }) => {
  const headers = new Headers(request.headers);
  headers.set('x-school-subdomain', slug);
  headers.set('x-tenant-host', originalHost);
  headers.set('x-forwarded-host', originalHost);

  return headers;
};

const shouldProxyToBackend = (pathname) =>
  API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const forwardRequest = (request, targetUrl, headers) =>
  fetch(
    new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
      cf: request.cf,
    }),
  );

const resolveTenantTarget = (hostname, env) => {
  const clientHostSuffix = String(env.CLIENT_HOST_SUFFIX || '-school.mutiurrahman.com')
    .trim()
    .toLowerCase();
  const dashboardHostSuffix = String(env.DASHBOARD_HOST_SUFFIX || '-dashboard.mutiurrahman.com')
    .trim()
    .toLowerCase();

  const clientSlug = getTenantSlug(hostname, clientHostSuffix);
  if (clientSlug) {
    return {
      slug: clientSlug,
      origin: trimTrailingSlash(
        String(env.CLIENT_PAGES_ORIGIN || 'https://school-client-test.vercel.app').trim(),
      ),
    };
  }

  const dashboardSlug = getTenantSlug(hostname, dashboardHostSuffix);
  if (dashboardSlug) {
    return {
      slug: dashboardSlug,
      origin: trimTrailingSlash(
        String(env.DASHBOARD_PAGES_ORIGIN || 'https://lbp-dashboard.pages.dev').trim(),
      ),
    };
  }

  return null;
};

const sessionBranch = (pathname) => {
  if (pathname === REFRESH_PATH) return 'refresh';
  if (pathname === LOGOUT_PATH) return 'logout';
  return 'login';
};

export default {
  async fetch(request, env) {
    const id = requestId(request);
    const startTime = now();
    const requestUrl = new URL(request.url);
    try {
      const target = resolveTenantTarget(requestUrl.hostname, env);

      if (!target) {
        const response = new Response('Unknown tenant host', { status: 404 });
        logRequest('warn', 'tenant-router.response', {
          id,
          method: request.method,
          host: requestUrl.hostname,
          path: requestUrl.pathname,
          search: requestUrl.search,
          branch: 'unknown-tenant',
          status: response.status,
          durationMs: now() - startTime,
        });
        return response;
      }

      const backendOrigin = trimTrailingSlash(
        String(env.BACKEND_ORIGIN || 'https://apisms.mutiurrahman.com').trim(),
      );
      const backendProxy = shouldProxyToBackend(requestUrl.pathname);

      const targetUrl = buildTargetUrl({
        requestUrl,
        targetOrigin: backendProxy ? backendOrigin : target.origin,
      });
      const originHeader = request.headers.get('Origin');
      const origin = resolveCorsOrigin(originHeader, requestUrl);
      const corsHeaders = buildCorsHeaders(origin);

      const finish = (response, branch) =>
        logAndReturn({
          response,
          id,
          startTime,
          requestUrl,
          targetUrl,
          method: request.method,
          slug: target.slug,
          backendProxy,
          branch,
        });

      if (request.method === 'OPTIONS') {
        const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
        corsHeaders.set('Access-Control-Allow-Headers', requestedHeaders || 'Content-Type');

        if (backendProxy) {
          return finish(new Response(null, { status: 204, headers: corsHeaders }), 'options');
        }

        return finish(
          await forwardRequest(request, targetUrl, new Headers(request.headers)),
          'pages-options',
        );
      }

      const headers = cloneHeaders({
        request,
        originalHost: requestUrl.hostname,
        slug: target.slug,
      });

      if (backendProxy) {
        headers.set('origin', `${requestUrl.protocol}//${requestUrl.hostname}`);
        headers.set('referer', `${requestUrl.origin}/`);
        headers.set('x-forwarded-host', requestUrl.hostname);
        headers.set('x-tenant-host', requestUrl.hostname);

        if (!requestUrl.pathname.startsWith('/api')) {
          return finish(await forwardRequest(request, targetUrl, headers), 'uploads-proxy');
        }

        headers.delete('host');
        headers.delete('content-length');

        const cookies = parseCookies(request.headers.get('cookie'));

        const sessionResponse = await tryHandleAuthSession({
          request,
          pathname: requestUrl.pathname,
          headers,
          cookies,
          origin,
          corsHeaders,
          forward: (req, hdrs) => forwardRequest(req, targetUrl, hdrs),
          logoutFailOn401: false,
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

        const backendResponse = await forwardRequest(request, targetUrl, headers);

        if (backendResponse.status === 401) {
          return finish(jsonResponse({ success: false }, 401, corsHeaders), 'api-unauthorized');
        }

        return finish(withCors(backendResponse, origin), 'api-proxy');
      }

      headers.delete('host');
      headers.delete('content-length');

      return finish(
        withHtmlNoStore(await forwardRequest(request, targetUrl, headers)),
        'pages-proxy',
      );
    } catch (error) {
      logRequest('error', 'tenant-router.error', {
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
