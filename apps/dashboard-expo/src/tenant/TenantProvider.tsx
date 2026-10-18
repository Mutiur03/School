/**
 * Resolves and exposes the active school's branding.
 *
 * Leak prevention:
 * - All school data is cached under ['tenant', tenantKey, ...]; when tenantKey changes, every
 *   other tenant's queries and scoped storage are dropped before the new tenant renders.
 * - The persisted branding cache is namespaced by tenant and re-checked on read
 *   (parseCachedBranding), so a stale entry for school A can never paint school B.
 * - While the new tenant's branding loads, the neutral default is shown, never the previous one.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { appConfig } from '@/config/env';
import { isApiError } from '@/lib/api';
import { deviceStore } from '@/lib/storage/device-store';
import { clearTenantStorage, createTenantScopedStorage } from '@/lib/storage/tenant-scoped-storage';
import { useApi } from '@/session/ApiProvider';
import {
  defaultBranding,
  mapSchoolInfoToBranding,
  parseCachedBranding,
  serializeBranding,
  type BrandingSource,
  type TenantBranding,
} from './branding';
import { purgeOtherTenantQueries, tenantQueryKey } from './query-keys';
import type { TenantResolution } from './resolve';

export interface TenantContextValue {
  resolution: TenantResolution;
  branding: TenantBranding;
  source: BrandingSource;
  isLoading: boolean;
  /** Human-readable reason the server branding is unavailable, if it is. */
  error: string | null;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const BRANDING_STORAGE_NAME = 'branding';

export function TenantProvider({
  resolution,
  children,
}: {
  resolution: TenantResolution;
  children: ReactNode;
}) {
  const { tenantKey } = resolution;
  const queryClient = useQueryClient();
  const { school } = useApi();
  const previousKey = useRef<string | null>(null);
  const storage = useMemo(() => createTenantScopedStorage(deviceStore, tenantKey), [tenantKey]);
  const [cached, setCached] = useState<TenantBranding | null>(null);

  useEffect(() => {
    const prev = previousKey.current;
    if (prev && prev !== tenantKey) {
      purgeOtherTenantQueries(queryClient, tenantKey);
      void clearTenantStorage(deviceStore, prev);
    }
    previousKey.current = tenantKey;
  }, [queryClient, tenantKey]);

  useEffect(() => {
    let active = true;
    setCached(null);
    storage
      .get(BRANDING_STORAGE_NAME)
      .then((raw) => {
        if (active) setCached(parseCachedBranding(raw, tenantKey));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storage, tenantKey]);

  const query = useQuery({
    queryKey: tenantQueryKey(tenantKey, 'branding'),
    queryFn: async ({ signal }) =>
      mapSchoolInfoToBranding(await school.getPublicInfo(signal), appConfig.cdnUrl, tenantKey),
    enabled: resolution.source !== 'unresolved',
    staleTime: 5 * 60_000,
    retry: (count, error) => count < 1 && isApiError(error) && error.isTransport,
  });

  useEffect(() => {
    if (query.data && query.data.tenantKey === tenantKey) {
      void storage.set(BRANDING_STORAGE_NAME, serializeBranding(query.data)).catch(() => {});
    }
  }, [query.data, storage, tenantKey]);

  const value = useMemo<TenantContextValue>(() => {
    let branding = defaultBranding(tenantKey);
    let source: BrandingSource = 'default';
    if (query.data?.tenantKey === tenantKey) {
      branding = query.data;
      source = 'server';
    } else if (cached?.tenantKey === tenantKey) {
      branding = cached;
      source = 'cache';
    }
    let error: string | null = null;
    if (resolution.source === 'unresolved') error = 'No school host configured.';
    else if (query.error) error = query.error.message;
    return {
      resolution,
      branding,
      source,
      isLoading: query.isLoading,
      error,
      refetch: () => void query.refetch(),
    };
  }, [cached, query, resolution, tenantKey]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}
