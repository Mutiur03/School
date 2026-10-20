/**
 * Where each signed-in role lands. School roles only ever land in a school; the platform admin
 * (super_admin) only in platform mode. Any other pairing has no home, and the caller signs the
 * session out, so a school session can never open platform screens or the reverse.
 */
import type { Href } from 'expo-router';
import type { TenantSource } from '@/tenant/resolve';

export type AppRole = 'admin' | 'teacher' | 'student';
/** Every role a route gate can require. */
export type GateRole = AppRole | 'super_admin';

export const ROLE_HOME: Record<AppRole, Href> = {
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
export const homeForRole = (role: unknown, source?: TenantSource): Href | null => {
  if (source === 'platform') return role === 'super_admin' ? PLATFORM_HOME : null;
  return isAppRole(role) ? ROLE_HOME[role] : null;
};

/** Where an unauthenticated visitor of a guarded route goes. */
export const loginRouteFor = (source: TenantSource): Href =>
  source === 'unresolved' ? '/join' : source === 'platform' ? PLATFORM_LOGIN : '/login';

/** Login route that remembers the page the visitor wanted (`next`), like web's `state.from`. */
export const loginHrefFor = (source: TenantSource, next: string): Href => {
  const pathname = loginRouteFor(source);
  return source === 'unresolved' ? pathname : ({ pathname, params: { next } } as Href);
};

const NOT_RETURNABLE = ['/login', '/platform-login', '/join', '/confirm', '/scan'];
const AREA_PREFIXES = ['/platform', '/teacher', '/student'];
const inArea = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * The `next` page to return to after sign-in, or null (go to the role's home). Only in-app paths
 * of the area this role may open: no other origin (`//evil.com`, `https:`), no auth screens, and
 * never another role's area.
 */
export const safeNext = (next: unknown, role: unknown, source?: TenantSource): Href | null => {
  if (typeof next !== 'string' || !/^\/(?![/\\])[^\s?#]*(\?[^\s#]*)?$/.test(next)) return null;
  const path = next.split('?')[0] ?? next;
  if (NOT_RETURNABLE.some((p) => inArea(path, p))) return null;
  const area = AREA_PREFIXES.find((p) => inArea(path, p));
  const allowed =
    source === 'platform'
      ? role === 'super_admin' && area === '/platform'
      : role === 'teacher'
        ? area === '/teacher'
        : role === 'student'
          ? area === '/student'
          : role === 'admin' && !area;
  return allowed ? (next as Href) : null;
};
