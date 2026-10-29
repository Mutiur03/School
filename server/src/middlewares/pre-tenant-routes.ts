/**
 * Requests that run before any school is known: app.ts lets them skip the tenant lookup, the
 * RLS school sync and the "school context required" check. Nothing here gets a school id or a
 * tenant RLS context; the handlers gate themselves (`Auth('super_admin')` + super-admin host).
 *
 * - `POST /api/school-code-lookups`: public code → school lookup (narrow SECURITY DEFINER read).
 * - `/api/platform/*`: super-admin school management (Nest).
 */
const PRE_TENANT_ROUTES = new Set(['POST /api/school-code-lookups']);

export const isPreTenantRequest = (method: string, path: string): boolean => {
  if (PRE_TENANT_ROUTES.has(`${method} ${path}`)) return true;
  // Express matches routes case-insensitively and ignores one trailing slash; so do we.
  const p = path.toLowerCase().replace(/(.)\/$/, '$1');
  return p === '/api/platform' || p.startsWith('/api/platform/');
};
