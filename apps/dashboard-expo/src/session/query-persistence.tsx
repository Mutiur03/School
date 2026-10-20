/**
 * Keeps the allowlisted, non-personal queries (lib/query-persist/policy.ts) on the device so a
 * cold start can show the last notices / events / overview at once while they refetch. The rules
 * live in lib/query-persist/persister.ts. Native only: on web the store is disabled (no-op).
 */
import type { QueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionManager } from '@/lib/api';
import { startQueryPersistence } from '@/lib/query-persist/persister';
import { CACHE_SCHEMA_VERSION } from '@/lib/query-persist/policy';
import { queryCacheStore } from '@/lib/query-persist/store';

/** Any new build or OTA (data shapes may change) starts from an empty cache. */
const buster = () =>
  `${CACHE_SCHEMA_VERSION}:${Constants.expoConfig?.version ?? ''}:${Updates.updateId ?? 'embedded'}`;

/** True once this launch showed data restored from the device cache. */
const RestoredContext = createContext(false);
export const useRestoredFromCache = () => useContext(RestoredContext);

export function QueryPersistence({
  queryClient,
  tenantKey,
  session,
  children,
}: {
  queryClient: QueryClient;
  tenantKey: string;
  session: SessionManager;
  children: ReactNode;
}) {
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const persistence = startQueryPersistence({
      queryClient,
      tenantKey,
      session,
      store: queryCacheStore,
      buster: buster(),
      onRestored: () => setRestored(true),
    });
    return persistence.stop;
  }, [queryClient, tenantKey, session]);
  return <RestoredContext.Provider value={restored}>{children}</RestoredContext.Provider>;
}
