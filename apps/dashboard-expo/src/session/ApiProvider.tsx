/**
 * Creates one API client + SessionManager per tenant and exposes them to the tree.
 * Switching tenant tears the old session down: tokens are only valid for the school that
 * issued them (the server re-checks school_id on every authenticated request and on refresh).
 *
 * Token transport: web keeps the HttpOnly refresh cookie (nothing persisted in JS). Native sends
 * `X-Client: native`, gets the refresh token in the body and keeps it in SecureStore only,
 * namespaced per school.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { configIssues } from '@/config/env';
import {
  createApiClient,
  createAuthApi,
  createSchoolApi,
  createStudentsApi,
  NATIVE_CLIENT_HEADER,
  SessionManager,
  type ApiClient,
  type AuthApi,
  type SchoolApi,
  type SessionSnapshot,
  type StudentsApi,
} from '@/lib/api';
import { createSessionPersistence } from '@/lib/storage/session-persistence';
import { purgePrivateQueries } from '@/tenant/query-keys';
import type { TenantConnection, TenantResolution } from '@/tenant/resolve';

export interface ApiContextValue {
  client: ApiClient;
  auth: AuthApi;
  school: SchoolApi;
  students: StudentsApi;
  session: SessionManager;
  /** End the session: server logout (best effort) then local cleanup. */
  signOut: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({
  tenant,
  connection,
  children,
}: {
  tenant: TenantResolution;
  connection: TenantConnection;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { baseUrl, tenantHeader } = connection;

  const value = useMemo<ApiContextValue>(() => {
    const native = Platform.OS !== 'web';
    const persistence = createSessionPersistence(tenant.tenantKey);
    // Late-bound so the client's auth hooks and the refresh call can share one instance.
    let session: SessionManager | null = null;

    const client = createApiClient({
      baseUrl,
      // Web: send the HttpOnly refresh cookie. Native: no cookies at all (body transport).
      credentials: native ? 'omit' : 'include',
      defaultHeaders: (): Record<string, string> => ({
        ...(tenantHeader ? { 'x-tenant-host': tenantHeader } : {}),
        ...(native ? NATIVE_CLIENT_HEADER : {}),
      }),
      auth: {
        getAccessToken: () => session?.getAccessToken() ?? null,
        refresh: () => session?.refresh() ?? Promise.resolve(false),
        onSessionExpired: (error) => session?.onSessionExpired(error),
      },
    });
    const auth = createAuthApi(client);
    session = new SessionManager({
      refreshRequest: (refreshToken) => auth.refresh(refreshToken),
      persistence,
      transport: native ? 'body' : 'cookie',
    });
    const manager = session;

    return {
      client,
      auth,
      school: createSchoolApi(client),
      students: createStudentsApi(client),
      session: manager,
      signOut: async () => {
        try {
          await auth.logout(await manager.storedRefreshToken());
        } catch {
          // Offline or already expired: still clear local state.
        }
        await manager.end('signed-out');
      },
    };
  }, [tenant.tenantKey, baseUrl, tenantHeader]);

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
      // Not a sign-out: keep the stored native token (StrictMode remounts, tenant re-key).
      void session.end('expired', { keepStored: true });
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
