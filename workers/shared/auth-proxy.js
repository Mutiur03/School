/** Shared login/refresh/logout cookie proxy helpers for auth-bff + tenant-router. */

export const LOGIN_PATHS = new Set([
  '/api/auth/admin/sessions',
  '/api/auth/super_admin/sessions',
  '/api/auth/teacher/sessions',
  '/api/auth/student/sessions',
]);
export const REFRESH_PATH = '/api/auth/sessions/refresh';
export const LOGOUT_PATH = '/api/auth/sessions';
export const PASSWORD_RESET_PREFIXES = [
  '/api/auth/admin/password-reset',
  '/api/auth/super_admin/password-reset',
  '/api/auth/teacher/password-reset',
  '/api/auth/student/password-reset',
];
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export const buildCookie = (name, value, { maxAge, path }) =>
  [
    `${name}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Path=${path}`,
    `Max-Age=${maxAge}`,
  ].join('; ');

export const clearCookie = (name, path) => buildCookie(name, '', { maxAge: 0, path });

export const attachRefreshCookie = (headers, refreshToken) => {
  // Clear legacy access-token cookies. Access tokens stay in JS memory only.
  headers.append('Set-Cookie', clearCookie(ACCESS_COOKIE, '/'));
  headers.append(
    'Set-Cookie',
    buildCookie(REFRESH_COOKIE, refreshToken, {
      maxAge: 2592000,
      path: REFRESH_PATH,
    }),
  );
};

export const attachClearedCookies = (headers) => {
  headers.append('Set-Cookie', clearCookie(ACCESS_COOKIE, '/'));
  headers.append('Set-Cookie', clearCookie(REFRESH_COOKIE, REFRESH_PATH));
  headers.append('Set-Cookie', clearCookie('refreshToken', '/'));
};

/**
 * These endpoints set/read auth cookies, so Access-Control-Allow-Origin must never
 * blindly echo the request's Origin header with credentials — that lets any site
 * (including a sibling tenant subdomain, which is same-site under SameSite=Strict)
 * read another tenant's session response. Only the request's own host is safe.
 */
export const resolveCorsOrigin = (originHeader, requestUrl) => {
  if (!originHeader) return null;
  try {
    return new URL(originHeader).hostname.toLowerCase() === requestUrl.hostname.toLowerCase()
      ? originHeader
      : null;
  } catch {
    return null;
  }
};

export const buildCorsHeaders = (safeOrigin) => {
  const headers = new Headers();
  if (safeOrigin) {
    headers.set('Access-Control-Allow-Origin', safeOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Vary', 'Origin');
  return headers;
};

export const withCors = (response, safeOrigin) => {
  const headers = new Headers(response.headers);
  if (safeOrigin) {
    headers.set('Access-Control-Allow-Origin', safeOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else {
    headers.delete('Access-Control-Allow-Origin');
    headers.delete('Access-Control-Allow-Credentials');
  }
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) continue;
    cookies[rawName] = rest.join('=');
  }

  return cookies;
};

export const jsonResponse = (data, status, headers) => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json');
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
};

export const extractAccessToken = (payload) =>
  payload?.accessToken ?? payload?.data?.accessToken ?? null;

export const extractRefreshToken = (payload) =>
  payload?.refreshToken ?? payload?.data?.refreshToken ?? null;

export const extractUser = (payload) => payload?.user ?? payload?.data?.user ?? null;

export const extractRefreshTokenFromSetCookie = (setCookieHeader) => {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/i);
  return match?.[1] ?? null;
};

export const parseJson = async (response) => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

export const isPasswordResetPath = (pathname) =>
  PASSWORD_RESET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const getRefreshToken = (cookies) => cookies[REFRESH_COOKIE] ?? cookies.refreshToken ?? null;

/**
 * Login / refresh / logout cookie proxy.
 * @param {{ request: Request, pathname: string, headers: Headers, cookies: Record<string,string>, origin: string, corsHeaders: Headers, forward: (req: Request, headers: Headers) => Promise<Response>, logoutFailOn401?: boolean }} opts
 * @returns {Promise<Response | null>} null if path is not a session auth route
 */
export async function tryHandleAuthSession({
  request,
  pathname,
  headers,
  cookies,
  origin,
  corsHeaders,
  forward,
  logoutFailOn401 = false,
}) {
  if (LOGIN_PATHS.has(pathname) && request.method === 'POST') {
    const backendResponse = await forward(request, headers);

    if (backendResponse.status === 401) {
      attachClearedCookies(corsHeaders);
      const data = await parseJson(backendResponse);
      return jsonResponse(
        { success: false, message: data?.message || 'Invalid credentials' },
        401,
        corsHeaders,
      );
    }

    if (!backendResponse.ok) {
      return withCors(backendResponse, origin);
    }

    const data = await parseJson(backendResponse);
    const accessToken = extractAccessToken(data);
    const refreshToken =
      extractRefreshToken(data) ||
      extractRefreshTokenFromSetCookie(backendResponse.headers.get('Set-Cookie'));
    const user = extractUser(data);

    if (!accessToken || !refreshToken) {
      return withCors(backendResponse, origin);
    }

    attachRefreshCookie(corsHeaders, refreshToken);
    return jsonResponse(
      { success: true, data: { accessToken, ...(user ? { user } : {}) } },
      200,
      corsHeaders,
    );
  }

  if (pathname === REFRESH_PATH && request.method === 'POST') {
    const refreshToken = getRefreshToken(cookies);
    if (!refreshToken) {
      attachClearedCookies(corsHeaders);
      return jsonResponse({ success: false }, 401, corsHeaders);
    }

    headers.delete('cookie');
    headers.set('Cookie', `refreshToken=${refreshToken}`);

    const backendResponse = await forward(request, headers);

    if (backendResponse.status === 401) {
      attachClearedCookies(corsHeaders);
      return jsonResponse({ success: false }, 401, corsHeaders);
    }

    if (!backendResponse.ok) {
      return withCors(backendResponse, origin);
    }

    const data = await parseJson(backendResponse);
    const accessToken = extractAccessToken(data);
    const nextRefreshToken =
      extractRefreshToken(data) ||
      extractRefreshTokenFromSetCookie(backendResponse.headers.get('Set-Cookie'));
    const user = extractUser(data);

    if (!accessToken || !nextRefreshToken) {
      return withCors(backendResponse, origin);
    }

    attachRefreshCookie(corsHeaders, nextRefreshToken);
    return jsonResponse(
      { success: true, data: { accessToken, ...(user ? { user } : {}) } },
      200,
      corsHeaders,
    );
  }

  if (pathname === LOGOUT_PATH && (request.method === 'DELETE' || request.method === 'POST')) {
    const refreshToken = getRefreshToken(cookies);
    headers.delete('cookie');
    if (refreshToken) {
      headers.set('Cookie', `refreshToken=${refreshToken}`);
    }

    const backendResponse = await forward(request, headers);

    if (logoutFailOn401 && backendResponse.status === 401) {
      attachClearedCookies(corsHeaders);
      return jsonResponse({ success: false }, 401, corsHeaders);
    }

    attachClearedCookies(corsHeaders);
    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  return null;
}
