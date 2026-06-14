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

const now = () => Date.now();

const requestId = (request: Request) =>
    request.headers.get("cf-ray") ||
    (globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);

const logRequest = (
    level: "info" | "warn" | "error",
    event: string,
    details: Record<string, unknown>,
) => {
    const line = JSON.stringify({ event, ...details });
    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
};

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
    logRequest(response.status >= 500 ? "error" : "info", "auth-bff.response", {
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

const attachRefreshCookie = (headers: Headers, refreshToken: string) => {
    // Clear legacy access-token cookies from older BFF versions. Access tokens now stay in JS memory only.
    headers.append("Set-Cookie", clearCookie(ACCESS_COOKIE, "/"));
    headers.append(
        "Set-Cookie",
        buildCookie(REFRESH_COOKIE, refreshToken, {
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

const extractUser = (payload: any) => payload?.user ?? payload?.data?.user ?? null;

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

const forwardOrUnavailable = async (
    request: Request,
    targetUrl: URL,
    headers: Headers,
) => {
    try {
        return await forwardRequest(request, targetUrl, headers);
    } catch (error) {
        console.error(
            JSON.stringify({
                event: "auth-bff.backend-unavailable",
                targetOrigin: targetUrl.origin,
                targetPath: targetUrl.pathname,
                message: error instanceof Error ? error.message : String(error),
            }),
        );
        return jsonResponse(
            {
                success: false,
                message: "Backend unavailable",
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
    const browserOrigin = request.headers.get("Origin");
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

    const forwardedHost =
        request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (forwardedHost) {
        const cleanHost = forwardedHost.split(",")[0]?.trim() ?? forwardedHost;
        const hostname = cleanHost.replace(/:\d+$/, "").toLowerCase();
        const proto =
            request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
            requestUrl.protocol.replace(":", "");
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

const applyTenantHeaders = (
    headers: Headers,
    request: Request,
    requestUrl: URL,
) => {
    const tenant = resolveTenantContext(request, requestUrl);
    headers.set("origin", tenant.origin);
    headers.set("referer", `${tenant.origin}/`);
    headers.set("x-forwarded-host", tenant.hostname);
    headers.set("x-tenant-host", tenant.hostname);
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const id = requestId(request);
        const startTime = now();
        const requestUrl = new URL(request.url);
        try {
            const originHeader = request.headers.get("Origin");
            const origin = originHeader ?? requestUrl.origin;

            if (!requestUrl.pathname.startsWith(API_PREFIX)) {
                const response = new Response("Not found", { status: 404 });
                logRequest("warn", "auth-bff.response", {
                    id,
                    method: request.method,
                    host: requestUrl.hostname,
                    path: requestUrl.pathname,
                    search: requestUrl.search,
                    branch: "not-api",
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

            if (request.method === "OPTIONS") {
                const requestedHeaders = request.headers.get(
                    "Access-Control-Request-Headers",
                );
                if (requestedHeaders) {
                    corsHeaders.set("Access-Control-Allow-Headers", requestedHeaders);
                } else {
                    corsHeaders.set("Access-Control-Allow-Headers", "Content-Type");
                }
                return finish(
                    new Response(null, { status: 204, headers: corsHeaders }),
                    "options",
                );
            }

            const headers = new Headers(request.headers);
            headers.delete("host");
            headers.delete("content-length");

            const cookies = parseCookies(request.headers.get("cookie"));
            applyTenantHeaders(headers, request, requestUrl);

            if (LOGIN_PATHS.has(requestUrl.pathname) && request.method === "POST") {
            const backendResponse = await forwardOrUnavailable(request, targetUrl, headers);

            if (backendResponse.status === 401) {
                attachClearedCookies(corsHeaders);
                return finish(
                    jsonResponse({ success: false }, 401, corsHeaders),
                    "login-unauthorized",
                );
            }

            if (!backendResponse.ok) {
                return finish(withCors(backendResponse, origin), "login-backend-error");
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
                return finish(withCors(backendResponse, origin), "login-token-missing");
            }

            attachRefreshCookie(corsHeaders, refreshToken);
            return finish(
                jsonResponse(
                    { success: true, data: { accessToken, ...(user ? { user } : {}) } },
                    200,
                    corsHeaders,
                ),
                "login-success",
            );
        }

        if (requestUrl.pathname === REFRESH_PATH && request.method === "POST") {
            const refreshToken = cookies[REFRESH_COOKIE];
            if (!refreshToken) {
                attachClearedCookies(corsHeaders);
                return finish(
                    jsonResponse({ success: false }, 401, corsHeaders),
                    "refresh-cookie-missing",
                );
            }

            headers.delete("cookie");
            headers.set("Cookie", `refreshToken=${refreshToken}`);

            const backendResponse = await forwardOrUnavailable(request, targetUrl, headers);

            if (backendResponse.status === 401) {
                attachClearedCookies(corsHeaders);
                return finish(
                    jsonResponse({ success: false }, 401, corsHeaders),
                    "refresh-unauthorized",
                );
            }

            if (!backendResponse.ok) {
                return finish(withCors(backendResponse, origin), "refresh-backend-error");
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
                return finish(withCors(backendResponse, origin), "refresh-token-missing");
            }

            attachRefreshCookie(corsHeaders, nextRefreshToken);
            return finish(
                jsonResponse(
                    { success: true, data: { accessToken, ...(user ? { user } : {}) } },
                    200,
                    corsHeaders,
                ),
                "refresh-success",
            );
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

            const backendResponse = await forwardOrUnavailable(request, targetUrl, headers);

            if (backendResponse.status === 401) {
                attachClearedCookies(corsHeaders);
                return finish(
                    jsonResponse({ success: false }, 401, corsHeaders),
                    "logout-unauthorized",
                );
            }

            attachClearedCookies(corsHeaders);
            return finish(jsonResponse({ success: true }, 200, corsHeaders), "logout");
        }

        if (!isPasswordResetPath(requestUrl.pathname)) {
            const authorization = headers.get("Authorization");
            if (authorization?.toLowerCase().startsWith("bearer ")) {
                headers.delete("cookie");
            }
        }

        const backendResponse = await forwardOrUnavailable(request, targetUrl, headers);

        if (backendResponse.status === 401) {
            return finish(
                jsonResponse({ success: false }, 401, corsHeaders),
                "api-unauthorized",
            );
        }

        return finish(withCors(backendResponse, origin), "api-proxy");
        } catch (error) {
            logRequest("error", "auth-bff.error", {
                id,
                method: request.method,
                host: requestUrl.hostname,
                path: requestUrl.pathname,
                search: requestUrl.search,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                durationMs: now() - startTime,
            });

            return new Response("Internal worker error", { status: 500 });
        }
    },
};
