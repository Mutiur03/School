/**
 * Where each signed-in role lands. School roles only ever land in a school; the platform admin
 * (super_admin) only in platform mode. Any other pairing has no home, and the caller signs the
 * session out, so a school session can never open platform screens or the reverse.
 */
import type { TenantSource } from '@/tenant/resolve';

export type AppRole = 'admin' | 'teacher' | 'student';
/** Every role a route gate can require. */
export type GateRole = AppRole | 'super_admin';

export const ROLE_HOME: Record<AppRole, string> = {
  admin: '/',
  teacher: '/teacher',
  student: '/student',
};

export const PLATFORM_HOME = '/platform';
export const PLATFORM_LOGIN = '/platform-login';

export const isAppRole = (role: unknown): role is AppRole =>
  role === 'admin' || role === 'teacher' || role === 'student';

/**
 * null when the role does not belong in this tenant (a school role in platform mode, a
 * super_admin at a school): the caller signs them out.
 */
export const homeForRole = (role: unknown, source?: TenantSource): string | null => {
  if (source === 'platform') return role === 'super_admin' ? PLATFORM_HOME : null;
  return isAppRole(role) ? ROLE_HOME[role] : null;
};

/** Where an unauthenticated visitor of a guarded route goes. */
export const loginRouteFor = (source: TenantSource): string =>
  source === 'unresolved' ? '/join' : source === 'platform' ? PLATFORM_LOGIN : '/login';
