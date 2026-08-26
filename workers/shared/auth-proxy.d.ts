/** Typings for auth-proxy.js (shared by auth-bff + tenant-router). */

export const LOGIN_PATHS: Set<string>;
export const REFRESH_PATH: string;
export const LOGOUT_PATH: string;
export const PASSWORD_RESET_PREFIXES: string[];
export const ACCESS_COOKIE: string;
export const REFRESH_COOKIE: string;
export const ALLOWED_METHODS: string;

export function buildCookie(
  name: string,
  value: string,
  opts: { maxAge: number; path: string },
): string;
export function clearCookie(name: string, path: string): string;
export function attachRefreshCookie(headers: Headers, refreshToken: string): void;
export function attachClearedCookies(headers: Headers): void;
export function buildCorsHeaders(origin: string): Headers;
export function withCors(response: Response, origin: string): Response;
export function parseCookies(cookieHeader: string | null): Record<string, string>;
export function jsonResponse(data: unknown, status: number, headers?: HeadersInit): Response;
export function extractAccessToken(payload: unknown): string | null;
export function extractRefreshToken(payload: unknown): string | null;
export function extractUser(payload: unknown): unknown;
export function extractRefreshTokenFromSetCookie(setCookieHeader: string | null): string | null;
export function parseJson(response: Response): Promise<unknown>;
export function isPasswordResetPath(pathname: string): boolean;
export function getRefreshToken(cookies: Record<string, string>): string | null;

export function tryHandleAuthSession(opts: {
  request: Request;
  pathname: string;
  headers: Headers;
  cookies: Record<string, string>;
  origin: string;
  corsHeaders: Headers;
  forward: (req: Request, headers: Headers) => Promise<Response>;
  logoutFailOn401?: boolean;
}): Promise<Response | null>;
