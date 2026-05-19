const trimTrailingSlash = (value) => value.replace(/\/+$/, "");
const API_PREFIXES = ["/api", "/uploads"];
const LOGIN_PATHS = new Set([
  "/api/auth/admin/sessions",
  "/api/auth/super_admin/sessions",
  "/api/auth/teacher/sessions",
  "/api/auth/student/sessions",
]);
const REFRESH_PATH = "/api/auth/sessions/refresh";
const LOGOUT_PATH = "/api/auth/sessions";
const PASSWORD_RESET_PREFIXES = [
  "/api/auth/admin/password-reset",
  "/api/auth/super_admin/password-reset",
  "/api/auth/teacher/password-reset",
  "/api/auth/student/password-reset",
];
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

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

const buildCookie = (name, value, { maxAge, path }) =>
  [
    `${name}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Path=${path}`,
    `Max-Age=${maxAge}`,
  ].join("; ");

const clearCookie = (name, path) => buildCookie(name, "", { maxAge: 0, path });

const attachAuthCookies = (headers, { accessToken, refreshToken }) => {
  headers.append(
    "Set-Cookie",
    buildCookie(ACCESS_COOKIE, accessToken, {
      maxAge: 900,
      path: "/",
    }),
  );
  headers.append(
    "Set-Cookie",
    buildCookie(REFRESH_COOKIE, refreshToken, {
      maxAge: 2592000,
      path: REFRESH_PATH,
    }),
  );
};

const attachClearedCookies = (headers) => {
  headers.append("Set-Cookie", clearCookie(ACCESS_COOKIE, "/"));
  headers.append("Set-Cookie", clearCookie(REFRESH_COOKIE, REFRESH_PATH));
  headers.append("Set-Cookie", clearCookie("refreshToken", "/"));
};

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = rest.join("=");
  }

  return cookies;
};

const jsonResponse = (data, status, headers) => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json");
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
};

const copyCorsHeaders = (source, destination) => {
  for (const [key, value] of source) {
    if (key.toLowerCase().startsWith("access-control-")) {
      destination.set(key, value);
    }
  }
};

const withAdditionalHeaders = (response, headers) => {
  const responseHeaders = new Headers(response.headers);
  copyCorsHeaders(headers, responseHeaders);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

const extractAccessToken = (payload) =>
  payload?.accessToken ?? payload?.data?.accessToken ?? null;

const extractRefreshToken = (payload) =>
  payload?.refreshToken ?? payload?.data?.refreshToken ?? null;

const extractUser = (payload) => payload?.user ?? payload?.data?.user ?? null;

const extractRefreshTokenFromSetCookie = (setCookieHeader) => {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/i);
  return match?.[1] ?? null;
};

const parseJson = async (response) => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

const cloneHeaders = ({ request, originalHost, slug }) => {
  const headers = new Headers(request.headers);
  headers.set("x-school-subdomain", slug);
  headers.set("x-tenant-host", originalHost);

  return headers;
};

const shouldProxyToBackend = (pathname) =>
  API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

const isPasswordResetPath = (pathname) =>
  PASSWORD_RESET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

const getRefreshToken = (cookies) =>
  cookies[REFRESH_COOKIE] ?? cookies.refreshToken ?? null;

const forwardRequest = (request, targetUrl, headers) =>
  fetch(
    new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      cf: request.cf,
    }),
  );

const resolveTenantTarget = (hostname, env) => {
  const clientHostSuffix = String(
    env.CLIENT_HOST_SUFFIX || "-school.mutiurrahman.com",
  )
    .trim()
    .toLowerCase();
  const dashboardHostSuffix = String(
    env.DASHBOARD_HOST_SUFFIX || "-dashboard.mutiurrahman.com",
  )
    .trim()
    .toLowerCase();

  const clientSlug = getTenantSlug(hostname, clientHostSuffix);
  if (clientSlug) {
    return {
      slug: clientSlug,
      origin: trimTrailingSlash(
        String(env.CLIENT_PAGES_ORIGIN || "https://lbp-client.pages.dev").trim(),
      ),
    };
  }

  const dashboardSlug = getTenantSlug(hostname, dashboardHostSuffix);
  if (dashboardSlug) {
    return {
      slug: dashboardSlug,
      origin: trimTrailingSlash(
        String(
          env.DASHBOARD_PAGES_ORIGIN || "https://lbp-dashboard.pages.dev",
        ).trim(),
      ),
    };
  }

  return null;
};

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const target = resolveTenantTarget(requestUrl.hostname, env);

    if (!target) {
      return new Response("Unknown tenant host", { status: 404 });
    }

    const backendOrigin = trimTrailingSlash(
      String(env.BACKEND_ORIGIN || "https://apisms.mutiurrahman.com").trim(),
    );
    const backendProxy = shouldProxyToBackend(requestUrl.pathname);

    const targetUrl = buildTargetUrl({
      requestUrl,
      targetOrigin: backendProxy ? backendOrigin : target.origin,
    });

    const headers = cloneHeaders({
      request,
      originalHost: requestUrl.hostname,
      slug: target.slug,
    });

    if (backendProxy) {
      headers.set("origin", `${requestUrl.protocol}//${requestUrl.hostname}`);
      headers.set("x-forwarded-host", requestUrl.hostname);

      if (!requestUrl.pathname.startsWith("/api")) {
        return forwardRequest(request, targetUrl, headers);
      }

      if (request.method === "OPTIONS") {
        return forwardRequest(request, targetUrl, headers);
      }

      headers.delete("host");
      headers.delete("content-length");

      const responseHeaders = new Headers();
      const cookies = parseCookies(request.headers.get("cookie"));

      if (LOGIN_PATHS.has(requestUrl.pathname) && request.method === "POST") {
        const backendResponse = await forwardRequest(request, targetUrl, headers);

        if (backendResponse.status === 401) {
          attachClearedCookies(responseHeaders);
          return jsonResponse({ success: false }, 401, responseHeaders);
        }

        if (!backendResponse.ok) {
          return withAdditionalHeaders(backendResponse, responseHeaders);
        }

        const data = await parseJson(backendResponse);
        const accessToken = extractAccessToken(data);
        const refreshToken =
          extractRefreshToken(data) ||
          extractRefreshTokenFromSetCookie(
            backendResponse.headers.get("Set-Cookie"),
          );
        const user = extractUser(data);

        if (!accessToken || !refreshToken) {
          return withAdditionalHeaders(backendResponse, responseHeaders);
        }

        attachAuthCookies(responseHeaders, { accessToken, refreshToken });
        return jsonResponse(
          { success: true, data: user ? { user } : {} },
          200,
          responseHeaders,
        );
      }

      if (requestUrl.pathname === REFRESH_PATH && request.method === "POST") {
        const refreshToken = getRefreshToken(cookies);
        if (!refreshToken) {
          attachClearedCookies(responseHeaders);
          return jsonResponse({ success: false }, 401, responseHeaders);
        }

        headers.delete("cookie");
        headers.set("Cookie", `refreshToken=${refreshToken}`);

        const backendResponse = await forwardRequest(request, targetUrl, headers);

        if (backendResponse.status === 401) {
          attachClearedCookies(responseHeaders);
          return jsonResponse({ success: false }, 401, responseHeaders);
        }

        if (!backendResponse.ok) {
          return withAdditionalHeaders(backendResponse, responseHeaders);
        }

        const data = await parseJson(backendResponse);
        const accessToken = extractAccessToken(data);
        const nextRefreshToken =
          extractRefreshToken(data) ||
          extractRefreshTokenFromSetCookie(
            backendResponse.headers.get("Set-Cookie"),
          );
        const user = extractUser(data);

        if (!accessToken || !nextRefreshToken) {
          return withAdditionalHeaders(backendResponse, responseHeaders);
        }

        attachAuthCookies(responseHeaders, {
          accessToken,
          refreshToken: nextRefreshToken,
        });
        return jsonResponse(
          { success: true, data: user ? { user } : {} },
          200,
          responseHeaders,
        );
      }

      if (
        requestUrl.pathname === LOGOUT_PATH &&
        (request.method === "DELETE" || request.method === "POST")
      ) {
        const refreshToken = getRefreshToken(cookies);
        headers.delete("cookie");
        if (refreshToken) {
          headers.set("Cookie", `refreshToken=${refreshToken}`);
        }

        await forwardRequest(request, targetUrl, headers);

        attachClearedCookies(responseHeaders);
        return jsonResponse({ success: true }, 200, responseHeaders);
      }

      if (!isPasswordResetPath(requestUrl.pathname)) {
        const accessToken = cookies[ACCESS_COOKIE];
        if (!accessToken) {
          attachClearedCookies(responseHeaders);
          return jsonResponse({ success: false }, 401, responseHeaders);
        }

        headers.set("Authorization", `Bearer ${accessToken}`);
        headers.delete("cookie");
      }

      const backendResponse = await forwardRequest(request, targetUrl, headers);

      if (backendResponse.status === 401) {
        attachClearedCookies(responseHeaders);
        return jsonResponse({ success: false }, 401, responseHeaders);
      }

      return withAdditionalHeaders(backendResponse, responseHeaders);
    }

    return forwardRequest(request, targetUrl, headers);
  },
};
