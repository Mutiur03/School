/**
 * Auth contracts, verified against server/src/modules/auth (main @ 13003bf4) and the edge proxy
 * in workers/shared/auth-proxy.js. Nothing here is new backend surface.
 *
 * - POST /api/auth/{admin|teacher|student}/sessions -> data: { accessToken, user }
 *   The backend also sets an HttpOnly `refreshToken` cookie; behind the tenant-router/auth-bff
 *   workers it becomes an HttpOnly `refresh_token` cookie scoped to the refresh path, and the
 *   body never contains the refresh token.
 * - POST /api/auth/super_admin/sessions only works on the super-admin host.
 * - POST /api/auth/sessions/refresh (cookie only) -> data: { accessToken, user }
 * - DELETE /api/auth/sessions (cookie only) -> clears the cookie, bumps tokenVersion server-side.
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
}

export const AUTH_PATHS = {
  adminLogin: '/api/auth/admin/sessions',
  teacherLogin: '/api/auth/teacher/sessions',
  studentLogin: '/api/auth/student/sessions',
  superAdminLogin: '/api/auth/super_admin/sessions',
  refresh: '/api/auth/sessions/refresh',
  logout: '/api/auth/sessions',
} as const;

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

/** Endpoint wrappers. Not wired to a login screen yet (next milestone). */
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
    /** Cookie-based. Must not carry the (possibly expired) bearer token or trigger a nested refresh. */
    refresh: (signal?: AbortSignal) =>
      client.post<SessionPayload>(
        AUTH_PATHS.refresh,
        {},
        { auth: false, retryOn401: false, signal },
      ),
    logout: (signal?: AbortSignal) =>
      client.delete<unknown>(AUTH_PATHS.logout, { auth: false, retryOn401: false, signal }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
