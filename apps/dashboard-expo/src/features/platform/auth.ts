/**
 * Platform (super-admin) sign-in logic, pure for tests. The endpoint is the existing
 * POST /api/auth/super_admin/sessions (superAdminLoginSchema: email + password). The server
 * only issues super_admin sessions there and only on the super-admin host; the app also refuses
 * to keep any session from it whose role is not super_admin.
 */
import { ApiError } from '@/lib/api/errors';
import type { SessionPayload } from '@/lib/api';
import type { PlatformSchemas } from './model';

export function buildSuperAdminLoginBody(
  email: string,
  password: string,
  schemas: Pick<PlatformSchemas, 'superAdminLoginSchema'>,
): { ok: true; value: { email: string; password: string } } | { ok: false; error: string } {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: 'Email is required.' };
  if (!password) return { ok: false, error: 'Password is required.' };
  const parsed = schemas.superAdminLoginSchema.safeParse({ email: trimmed, password });
  if (!parsed.success) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, value: parsed.data };
}

/** Thrown before anything is stored when the server answers with a non-platform session. */
export class NotPlatformAdminError extends Error {
  constructor() {
    super('This account is not a platform admin.');
    this.name = 'NotPlatformAdminError';
  }
}

/** Gate between the login response and SessionManager.signIn (which persists the token). */
export function requirePlatformSession(payload: SessionPayload): SessionPayload {
  if (payload.user.role !== 'super_admin') throw new NotPlatformAdminError();
  return payload;
}

/** Never says which half was wrong. */
export function platformLoginErrorMessage(error: unknown): string {
  if (error instanceof NotPlatformAdminError) return error.message;
  if (error instanceof ApiError) {
    if (error.isTransport) return "Can't reach the platform server. Check your connection.";
    if (error.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
    if (error.status === 400 || error.status === 401 || error.status === 404) {
      return "Those details didn't match. Check them and try again.";
    }
    if (error.status === 403) {
      return 'Platform sign-in is not available from this server address.';
    }
  }
  return 'Something went wrong. Try again.';
}
