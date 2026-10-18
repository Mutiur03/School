/**
 * Every query that holds school data must be keyed with tenantQueryKey(), so switching schools
 * can drop everything that belongs to the previous one.
 *   ['tenant', <tenantKey>, 'branding']            public, survives sign-out
 *   ['tenant', <tenantKey>, 'private', ...rest]    session data, dropped on sign-out
 */
import type { QueryClient } from '@tanstack/react-query';

export const TENANT_ROOT = 'tenant';

export const tenantQueryKey = (tenantKey: string, ...parts: readonly unknown[]) =>
  [TENANT_ROOT, tenantKey, ...parts] as const;

export const privateQueryKey = (tenantKey: string, ...parts: readonly unknown[]) =>
  tenantQueryKey(tenantKey, 'private', ...parts);

/** Remove cached queries for every tenant except `keepTenantKey`, plus any un-namespaced query. */
export function purgeOtherTenantQueries(queryClient: QueryClient, keepTenantKey: string) {
  queryClient.cancelQueries({
    predicate: (q) => !(q.queryKey[0] === TENANT_ROOT && q.queryKey[1] === keepTenantKey),
  });
  queryClient.removeQueries({
    predicate: (q) => !(q.queryKey[0] === TENANT_ROOT && q.queryKey[1] === keepTenantKey),
  });
}

/** Remove session-scoped data for a tenant (on sign-out or expiry). */
export function purgePrivateQueries(queryClient: QueryClient, tenantKey: string) {
  queryClient.removeQueries({ queryKey: [TENANT_ROOT, tenantKey, 'private'] });
}
