/**
 * Creates one API client + SessionManager per tenant and exposes them to the tree.
 * Switching tenant tears the old session down: tokens are only valid for the school that
 * issued them (the server re-checks school_id on every authenticated request and on refresh).
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { appConfig, configIssues } from '@/config/env';
import {
  createApiClient,
  createAuthApi,
  createSchoolApi,
  SessionManager,
  type ApiClient,
  type AuthApi,
  type SchoolApi,
  type SessionSnapshot,
} from '@/lib/api';
import { createSessionPersistence } from '@/lib/storage/session-persistence';
import { purgePrivateQueries } from '@/tenant/query-keys';
import type { TenantResolution } from '@/tenant/resolve';

export interface ApiContextValue {
  client: ApiClient;
  auth: AuthApi;
  school: SchoolApi;
  session: SessionManager;
  /** End the session: server logout (best effort) then local cleanup. */
  signOut: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({
  tenant,
  children,
}: {
  tenant: TenantResolution;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const value = useMemo<ApiContextValue>(() => {
    const persistence = createSessionPersistence(tenant.tenantKey);
    // Late-bound so the client's auth hooks and the refresh call can share one instance.
    let session: SessionManager | null = null;

    const client = createApiClient({
      baseUrl: appConfig.apiBaseUrl,
      // Web: send the HttpOnly refresh cookie. Native: no CORS, the OS cookie jar applies
      // (native cookie refresh is NOT verified yet, see README).
      credentials: 'include',
      defaultHeaders: (): Record<string, string> =>
        appConfig.devTenantHost ? { 'x-tenant-host': appConfig.devTenantHost } : {},
      auth: {
        getAccessToken: () => session?.getAccessToken() ?? null,
        refresh: () => session?.refresh() ?? Promise.resolve(false),
        onSessionExpired: (error) => session?.onSessionExpired(error),
      },
    });
    const auth = createAuthApi(client);
    session = new SessionManager({ refreshRequest: () => auth.refresh(), persistence });
    const manager = session;

    return {
      client,
      auth,
      school: createSchoolApi(client),
      session: manager,
      signOut: async () => {
        try {
          await auth.logout();
        } catch {
          // Offline or already expired: still clear local state.
        }
        await manager.end('signed-out');
      },
    };
  }, [tenant.tenantKey]);

  useEffect(() => {
    const { session } = value;
    let previous = session.getSnapshot().status;
    const unsubscribe = session.subscribe((snapshot) => {
      if (previous === 'authenticated' && snapshot.status !== 'authenticated') {
        purgePrivateQueries(queryClient, tenant.tenantKey);
      }
      previous = snapshot.status;
    });
    if (configIssues.length === 0 && tenant.source !== 'unresolved') {
      void session.bootstrap();
    } else {
      void session.end('expired');
    }
    return () => {
      unsubscribe();
      void session.end('expired');
    };
  }, [value, queryClient, tenant.tenantKey, tenant.source]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>');
  return ctx;
}

export function useSession(): SessionSnapshot & { signOut: () => Promise<void> } {
  const { session, signOut } = useApi();
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { ...snapshot, signOut };
}
