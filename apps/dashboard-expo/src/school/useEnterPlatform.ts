/**
 * The platform access code was entered or scanned on the school-code screen (the server answered
 * `{ target: 'platform' }`). Leave whatever school is current exactly like Switch school does
 * (sign out, drop its queries, scoped storage and stored token), then record platform mode and
 * open the super-admin login on this build's own super-admin URL. A school code never leads here.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { deviceStore } from '@/lib/storage/device-store';
import { clearTenantStorage } from '@/lib/storage/tenant-scoped-storage';
import { PLATFORM_LOGIN } from '@/navigation/role-routes';
import { useApi } from '@/session/ApiProvider';
import { TENANT_ROOT } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useSchool } from './SchoolProvider';

export function useEnterPlatform(): () => Promise<void> {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { signOut, session } = useApi();
  const { resolution } = useTenant();
  const school = useSchool();

  return useCallback(async () => {
    if (resolution.source !== 'platform') {
      const key = resolution.tenantKey;
      if (session.getSnapshot().status !== 'anonymous') await signOut();
      await queryClient.cancelQueries({ queryKey: [TENANT_ROOT, key] });
      queryClient.removeQueries({ queryKey: [TENANT_ROOT, key] });
      await clearTenantStorage(deviceStore, key).catch(() => {});
      if (!(await school.choosePlatform())) return;
    }
    router.replace(PLATFORM_LOGIN);
  }, [queryClient, resolution, router, school, session, signOut]);
}
