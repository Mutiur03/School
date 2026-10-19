/**
 * "Switch school": end the session at the current school, drop everything cached for it
 * (queries, tenant-scoped storage, stored tokens) and forget the selection.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { deviceStore } from '@/lib/storage/device-store';
import { clearTenantStorage } from '@/lib/storage/tenant-scoped-storage';
import { useApi } from '@/session/ApiProvider';
import { TENANT_ROOT } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useSchool } from './SchoolProvider';

export function useSwitchSchool(): () => Promise<void> {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { signOut, session } = useApi();
  const { resolution } = useTenant();
  const school = useSchool();

  return useCallback(async () => {
    const key = resolution.tenantKey;
    // Also clears a stored native refresh token when the session never got past 'unknown'.
    if (session.getSnapshot().status !== 'anonymous') await signOut();
    await queryClient.cancelQueries({ queryKey: [TENANT_ROOT, key] });
    queryClient.removeQueries({ queryKey: [TENANT_ROOT, key] });
    await clearTenantStorage(deviceStore, key).catch(() => {});
    await school.clear();
    router.replace('/join');
  }, [queryClient, resolution.tenantKey, router, school, session, signOut]);
}
