type Env = {
    BACKEND_URL: string;
};

const API_PREFIX = "/api";
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

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const jsonResponse = (data: unknown, status: number, headers?: HeadersInit) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("content-type", "application/json");
    return new Response(JSON.stringify(data), { status, headers: responseHeaders });
};

const buildCookie = (
    name: string,
    value: string,
    options: { maxAge: number; path: string },
) => {
    const parts = [
        `${name}=${value}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        `Path=${options.path}`,
        `Max-Age=${options.maxAge}`,
    ];

    return parts.join("; ");
};

const clearCookie = (name: string, path: string) =>
    buildCookie(name, "", { maxAge: 0, path });

const parseCookies = (cookieHeader: string | null) => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;

    for (const part of cookieHeader.split(";")) {
        const [rawName, ...rest] = part.trim().split("=");
        if (!rawName) continue;
        cookies[rawName] = rest.join("=");
    }

    return cookies;
};


const buildCorsHeaders = (origin: string) => {
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    headers.set("Vary", "Origin");
    return headers;
};

const isOriginAllowed = (requestUrl: URL, originHeader: string | null) => {
    if (!originHeader) return false;
    return originHeader === requestUrl.origin;
};

const withCors = (response: Response, origin: string) => {
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    headers.set("Vary", "Origin");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

const attachAuthCookies = (headers: Headers, tokens: {
    accessToken: string;
    refreshToken: string;
}) => {
    headers.append(
        "Set-Cookie",
        buildCookie(ACCESS_COOKIE, tokens.accessToken, {
            maxAge: 900,
            path: "/",
        }),
    );
    headers.append(
        "Set-Cookie",
        buildCookie(REFRESH_COOKIE, tokens.refreshToken, {
            maxAge: 2592000,
            path: REFRESH_PATH,
        }),
    );
};

const attachClearedCookies = (headers: Headers) => {
    headers.append("Set-Cookie", clearCookie(ACCESS_COOKIE, "/"));
    headers.append("Set-Cookie", clearCookie(REFRESH_COOKIE, REFRESH_PATH));
};

const isPasswordResetPath = (pathname: string) =>
    PASSWORD_RESET_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

const extractAccessToken = (payload: any) =>
    payload?.accessToken ?? payload?.data?.accessToken ?? null;

const extractRefreshToken = (payload: any) =>
    payload?.refreshToken ?? payload?.data?.refreshToken ?? null;

const extractRefreshTokenFromSetCookie = (setCookieHeader: string | null) => {
    if (!setCookieHeader) return null;
    const match = setCookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/i);
    return match?.[1] ?? null;
};

const parseJson = async (response: Response) => {
    try {
        return await response.clone().json();
    } catch {
        return null;
    }
};

const forwardRequest = (request: Request, targetUrl: URL, headers: Headers) =>
    fetch(
        new Request(targetUrl.toString(), {
            method: request.method,
            headers,
            body: request.body,
            redirect: "manual",
        }),
    );

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const requestUrl = new URL(request.url);
        const originHeader = request.headers.get("Origin");
        const origin = originHeader ?? requestUrl.origin;

        if (!requestUrl.pathname.startsWith(API_PREFIX)) {
            return new Response("Not found", { status: 404 });
        }

        if (originHeader && !isOriginAllowed(requestUrl, originHeader)) {
            return new Response("Forbidden", { status: 403 });
        }

        const corsHeaders = buildCorsHeaders(origin);

        if (request.method === "OPTIONS") {
            const requestedHeaders = request.headers.get(
                "Access-Control-Request-Headers",
            );
            if (requestedHeaders) {
                corsHeaders.set("Access-Control-Allow-Headers", requestedHeaders);
            } else {
                corsHeaders.set("Access-Control-Allow-Headers", "Content-Type");
            }
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const targetUrl = new URL(env.BACKEND_URL);
        targetUrl.pathname = requestUrl.pathname;
        targetUrl.search = requestUrl.search;

        const headers = new Headers(request.headers);
        headers.delete("host");
        headers.delete("content-length");

        const cookies = parseCookies(request.headers.get("cookie"));

        if (LOGIN_PATHS.has(requestUrl.pathname) && request.method === "POST") {
            const backendResponse = await forwardRequest(request, targetUrl, headers);

            if (backendResponse.status === 401) {
                attachClearedCookies(corsHeaders);
                return jsonResponse({ success: false }, 401, corsHeaders);
            }

            if (!backendResponse.ok) {
                return withCors(backendResponse, origin);
            }

            const data = await parseJson(backendResponse);
            const accessToken = extractAccessToken(data);
            const refreshToken =
                extractRefreshToken(data) ||
                extractRefreshTokenFromSetCookie(
                    backendResponse.headers.get("Set-Cookie"),
                );

            if (!accessToken || !refreshToken) {
                return withCors(backendResponse, origin);
            }

            attachAuthCookies(corsHeaders, { accessToken, refreshToken });
            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        if (requestUrl.pathname === REFRESH_PATH && request.method === "POST") {
            const refreshToken = cookies[REFRESH_COOKIE];
            if (!refreshToken) {
                attachClearedCookies(corsHeaders);
                return jsonResponse({ success: false }, 401, corsHeaders);
            }

            headers.delete("cookie");
            headers.set("Cookie", `refreshToken=${refreshToken}`);

            const backendResponse = await forwardRequest(request, targetUrl, headers);

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
                extractRefreshTokenFromSetCookie(
                    backendResponse.headers.get("Set-Cookie"),
                );

            if (!accessToken || !nextRefreshToken) {
                return withCors(backendResponse, origin);
            }

            attachAuthCookies(corsHeaders, {
                accessToken,
                refreshToken: nextRefreshToken,
            });
            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        if (
            requestUrl.pathname === LOGOUT_PATH &&
            (request.method === "DELETE" || request.method === "POST")
        ) {
            const refreshToken = cookies[REFRESH_COOKIE];
            headers.delete("cookie");
            if (refreshToken) {
                headers.set("Cookie", `refreshToken=${refreshToken}`);
            }

            const backendResponse = await forwardRequest(request, targetUrl, headers);

            if (backendResponse.status === 401) {
                attachClearedCookies(corsHeaders);
                return jsonResponse({ success: false }, 401, corsHeaders);
            }

            attachClearedCookies(corsHeaders);
            return jsonResponse({ success: true }, 200, corsHeaders);
        }

        if (!isPasswordResetPath(requestUrl.pathname)) {
            const accessToken = cookies[ACCESS_COOKIE];
            if (!accessToken) {
                attachClearedCookies(corsHeaders);
                return jsonResponse({ success: false }, 401, corsHeaders);
            }

            headers.set("Authorization", `Bearer ${accessToken}`);
            headers.delete("cookie");
        }

        const backendResponse = await forwardRequest(request, targetUrl, headers);

        if (backendResponse.status === 401) {
            attachClearedCookies(corsHeaders);
            return jsonResponse({ success: false }, 401, corsHeaders);
        }

        return withCors(backendResponse, origin);
    },
};
