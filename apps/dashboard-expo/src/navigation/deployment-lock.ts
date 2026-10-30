/**
 * Per-deployment role lock (web only). A web build with EXPO_PUBLIC_APP_ROLE serves exactly one
 * role: every route outside that role's area and its own sign-in screens is a 404, a session of
 * any other role is signed out, and login refuses other roles. Unset = every role (local dev, the
 * all-roles site, native builds). This is UX, not security: the API still checks every role.
 */
import type { GateRole } from './role-routes';

export type LockedRole = GateRole | null;

export const isGateRole = (v: unknown): v is GateRole =>
  v === 'admin' || v === 'teacher' || v === 'student' || v === 'super_admin';

/** `EXPO_PUBLIC_APP_ROLE` (also accepts `super-admin` / any case). Native builds never lock. */
export function parseLockedRole(raw: string | undefined, platform: string): LockedRole {
  if (platform !== 'web' || !raw) return null;
  const role = raw.trim().toLowerCase().replace('-', '_');
  return isGateRole(role) ? role : null;
}

/** School sign-in screens (pick a school, sign in, reset a password). */
const SCHOOL_AUTH = ['/login', '/join', '/scan', '/confirm', '/forgot-password'];
const ROLE_AREAS = ['/teacher', '/student', '/platform'];

const normalize = (path: string) => {
  const p = (path.split(/[?#]/)[0] ?? '/').replace(/\/+$/, '');
  return p === '' ? '/' : p;
};
const inArea = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Whether this deployment serves `path`. `/` is allowed everywhere (it redirects home). */
export function routeAllowed(path: string, locked: LockedRole): boolean {
  if (!locked) return true;
  const p = normalize(path);
  if (p === '/') return true;
  switch (locked) {
    case 'super_admin':
      return inArea(p, '/platform') || p === '/platform-login';
    case 'teacher':
    case 'student':
      return inArea(p, `/${locked}`) || SCHOOL_AUTH.includes(p);
    case 'admin':
      return p !== '/platform-login' && !ROLE_AREAS.some((a) => inArea(p, a));
  }
}

/** Where `/` goes in a locked build whose home is not `/` (null: render `/` as usual). */
export function rootRedirect(locked: LockedRole): '/teacher' | '/student' | '/platform' | null {
  if (locked === 'teacher') return '/teacher';
  if (locked === 'student') return '/student';
  if (locked === 'super_admin') return '/platform';
  return null;
}

/** A signed-in role this deployment accepts. */
export const roleAllowed = (role: unknown, locked: LockedRole) => !locked || role === locked;

const ROLE_NOUN: Record<GateRole, string> = {
  admin: 'school admins',
  teacher: 'teachers',
  student: 'students',
  super_admin: 'platform admins',
};

export const lockedRoleMessage = (locked: GateRole) => `This app is for ${ROLE_NOUN[locked]} only.`;

export class WrongDeploymentRoleError extends Error {
  constructor(locked: GateRole) {
    super(lockedRoleMessage(locked));
    this.name = 'WrongDeploymentRoleError';
  }
}

/** Login check, before the session is stored: throws when the account's role is not this build's. */
export function requireDeploymentRole<T extends { user: { role: unknown } }>(
  payload: T,
  locked: LockedRole,
): T {
  if (locked && payload.user.role !== locked) throw new WrongDeploymentRoleError(locked);
  return payload;
}
