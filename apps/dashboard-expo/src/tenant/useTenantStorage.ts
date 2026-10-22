import { useMemo } from 'react';
import { deviceStore } from '@/lib/storage/device-store';
import { createTenantScopedStorage } from '@/lib/storage/tenant-scoped-storage';
import { useTenant } from './TenantProvider';

/** Small per-school preferences on this device (cleared when the school is switched). */
export function useTenantStorage() {
  const { resolution } = useTenant();
  return useMemo(
    () => createTenantScopedStorage(deviceStore, resolution.tenantKey),
    [resolution.tenantKey],
  );
}
