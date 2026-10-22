/**
 * Auth contracts, verified against server/src/modules/auth and the edge proxy in
 * workers/shared/auth-proxy.js (see server/docs/native-auth.md).
 *
 * Web (cookie transport, unchanged):
 * - POST /api/auth/{admin|teacher|student}/sessions -> data: { accessToken, user }
 *   The backend also sets an HttpOnly `refreshToken` cookie; behind the tenant-router/auth-bff
 *   workers it becomes an HttpOnly `refresh_token` cookie scoped to the refresh path, and the
 *   body never contains the refresh token.
 * - POST /api/auth/sessions/refresh (cookie) -> data: { accessToken, user }
 * - DELETE /api/auth/sessions (cookie) -> clears the cookie, bumps tokenVersion server-side.
 *
 * Native (body transport, every request carries `X-Client: native`):
 * - login and refresh -> data: { accessToken, refreshToken, user }, no cookie. Refresh tokens
 *   rotate on every refresh; reusing an old one revokes the whole session server-side.
 * - refresh / logout read the token from the JSON body `{ refreshToken }` only.
 * The workers pass native session requests through untouched.
 *
 * - POST /api/auth/super_admin/sessions only works on the super-admin host.
 *
 * Access tokens are short-lived JWTs (15 min in production). They are kept in memory only, the
 * same as dashboard/src/context/unifiedAuthContext.tsx.
 */
import type {
  adminLoginSchema,
  studentLoginSchema,
  superAdminLoginSchema,
  teacherLoginSchema,
} from '@school/shared-schemas';
import type { z } from 'zod';
import type { ApiClient } from './client';

export type UserRole = 'admin' | 'teacher' | 'student' | 'super_admin';

/** Login request bodies come straight from the shared Zod schemas the server validates with. */
export type AdminLoginBody = z.input<typeof adminLoginSchema>;
export type TeacherLoginBody = z.input<typeof teacherLoginSchema>;
export type StudentLoginBody = z.input<typeof studentLoginSchema>;
export type SuperAdminLoginBody = z.input<typeof superAdminLoginSchema>;

/**
 * Fields common to the login and refresh `user` payloads (auth.service.ts). Role-specific
 * extras (teacher levels, student address, ...) are deliberately left untyped until a screen
 * needs them.
 */
export interface AuthUser {
  id: number;
  role: UserRole;
  name?: string;
  email?: string;
  username?: string;
  /** Students: stringified BigInt. */
  login_id?: string;
  image?: string | null;
  [extra: string]: unknown;
}

export interface SessionPayload {
  accessToken: string;
  user: AuthUser;
  /** Native transport only. Never kept in memory state; goes straight to SecureStore. */
  refreshToken?: string;
}

/** 'cookie' on web (HttpOnly cookie), 'body' on native (SecureStore). */
export type TokenTransport = 'cookie' | 'body';

/** Header the server uses to pick the native transport (refused from browsers). */
export const NATIVE_CLIENT_HEADER = { 'X-Client': 'native' } as const;

/** Refresh gates app startup, so it gets a shorter timeout than ordinary requests. */
export const REFRESH_TIMEOUT_MS = 15_000;
const LOGOUT_TIMEOUT_MS = 8_000;

export const AUTH_PATHS = {
  adminLogin: '/api/auth/admin/sessions',
  teacherLogin: '/api/auth/teacher/sessions',
  studentLogin: '/api/auth/student/sessions',
  superAdminLogin: '/api/auth/super_admin/sessions',
  refresh: '/api/auth/sessions/refresh',
  logout: '/api/auth/sessions',
} as const;

/** Teacher (by email) and student (by login id) self-service reset: request → check-code → verify. */
export type ResetRole = 'teacher' | 'student';
export type ResetStep = 'request' | 'check-code' | 'verify';
export const passwordResetPath = (role: ResetRole, step: ResetStep) =>
  `/api/auth/${role}/password-reset/${step}`;

export function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;
  return (
    typeof v.accessToken === 'string' &&
    v.accessToken.length > 0 &&
    typeof user === 'object' &&
    user !== null &&
    typeof user.role === 'string'
  );
}

/** Endpoint wrappers. The client adds X-Client: native on native (see ApiProvider). */
export function createAuthApi(client: ApiClient) {
  const login = (path: string, body: object, signal?: AbortSignal) =>
    client.post<SessionPayload>(path, body, { auth: false, signal });

  return {
    loginAdmin: (body: AdminLoginBody, signal?: AbortSignal) =>
      login(AUTH_PATHS.adminLogin, body, signal),
    loginTeacher: (body: TeacherLoginBody, signal?: AbortSignal) =>
      login(AUTH_PATHS.teacherLogin, body, signal),
    loginStudent: (body: StudentLoginBody, signal?: AbortSignal) =>
      login(AUTH_PATHS.studentLogin, body, signal),
    loginSuperAdmin: (body: SuperAdminLoginBody, signal?: AbortSignal) =>
      login(AUTH_PATHS.superAdminLogin, body, signal),
    /**
     * Web: cookie-based, pass no token. Native: the stored refresh token goes in the body.
     * Must not carry the (possibly expired) bearer token or trigger a nested refresh.
     */
    refresh: (refreshToken?: string, signal?: AbortSignal) =>
      client.post<SessionPayload>(AUTH_PATHS.refresh, refreshToken ? { refreshToken } : {}, {
        auth: false,
        retryOn401: false,
        signal,
        // Startup waits on this call; fail fast instead of the 30 s default.
        timeoutMs: REFRESH_TIMEOUT_MS,
      }),
    passwordReset: (
      role: ResetRole,
      step: ResetStep,
      body: Record<string, string>,
      signal?: AbortSignal,
    ) =>
      client.post<{ message?: string } | null>(passwordResetPath(role, step), body, {
        auth: false,
        signal,
      }),
    logout: (refreshToken?: string, signal?: AbortSignal) =>
      client.request<unknown>(AUTH_PATHS.logout, {
        method: 'DELETE',
        body: refreshToken ? { refreshToken } : undefined,
        auth: false,
        retryOn401: false,
        signal,
        // Best effort: switching school or signing out offline should not hang.
        timeoutMs: LOGOUT_TIMEOUT_MS,
      }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
