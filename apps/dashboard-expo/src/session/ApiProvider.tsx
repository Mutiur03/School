/**
 * Creates one API client + SessionManager per tenant and exposes them to the tree.
 * Switching tenant tears the old session down: tokens are only valid for the school that
 * issued them (the server re-checks school_id on every authenticated request and on refresh).
 *
 * Token transport: web keeps the HttpOnly refresh cookie (nothing persisted in JS). Native sends
 * `X-Client: native`, gets the refresh token in the body and keeps it in SecureStore only,
 * namespaced per school.
 *
 * Platform (super-admin) mode is its own tenant key (`_platform.<host>`), so it gets its own
 * client, SessionManager, SecureStore slot and query namespace. The platform endpoints
 * (`platform`) are only constructed in that mode: a school session never holds them.
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
  createAttendanceApi,
  createStudentPortalApi,
  createAuthApi,
  createSchoolApi,
  createStudentsApi,
  createDashboardApi,
  createEventsApi,
  createHolidaysApi,
  createNoticesApi,
  createSubjectsApi,
  createExamsApi,
  createMarksApi,
  createLevelsApi,
  createPromotionsApi,
  createTeacherSelfApi,
  createTeachersApi,
  createStaffApi,
  createBillingApi,
  createSmsApi,
  createSchoolCodesAdminApi,
  createFeesApi,
  createAccountsApi,
  createSiteDocsApi,
  createCertificatesApi,
  createAdmissionApi,
  createGalleryApi,
  createRegistrationApi,
  createPlatformApi,
  type PlatformApi,
  type SiteDocsApi,
  type CertificatesApi,
  type AdmissionApi,
  type GalleryApi,
  type RegistrationApi,
  type FeesApi,
  type AccountsApi,
  type StaffApi,
  type BillingApi,
  type SmsApi,
  type SchoolCodesAdminApi,
  type DashboardApi,
  type EventsApi,
  type HolidaysApi,
  type NoticesApi,
  type SubjectsApi,
  type ExamsApi,
  type MarksApi,
  type LevelsApi,
  type PromotionsApi,
  type TeacherSelfApi,
  type TeachersApi,
  NATIVE_CLIENT_HEADER,
  SessionManager,
  type ApiClient,
  type AttendanceApi,
  type StudentPortalApi,
  type AuthApi,
  type SchoolApi,
  type SessionSnapshot,
  type StudentsApi,
} from '@/lib/api';
import { createSessionPersistence } from '@/lib/storage/session-persistence';
import { purgePrivateQueries, TENANT_ROOT } from '@/tenant/query-keys';
import { QueryPersistence } from './query-persistence';
import type { TenantConnection, TenantResolution } from '@/tenant/resolve';

export interface ApiContextValue {
  client: ApiClient;
  auth: AuthApi;
  school: SchoolApi;
  students: StudentsApi;
  attendance: AttendanceApi;
  student: StudentPortalApi;
  dashboard: DashboardApi;
  teachers: TeachersApi;
  holidays: HolidaysApi;
  notices: NoticesApi;
  events: EventsApi;
  subjects: SubjectsApi;
  exams: ExamsApi;
  marks: MarksApi;
  levels: LevelsApi;
  promotions: PromotionsApi;
  teacherSelf: TeacherSelfApi;
  staff: StaffApi;
  billing: BillingApi;
  sms: SmsApi;
  schoolCodes: SchoolCodesAdminApi;
  fees: FeesApi;
  accounts: AccountsApi;
  siteDocs: SiteDocsApi;
  certificates: CertificatesApi;
  admission: AdmissionApi;
  gallery: GalleryApi;
  registration: RegistrationApi;
  /** Super-admin endpoints. null unless the tenant is platform mode. */
  platform: PlatformApi | null;
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
        awaitAccessToken: () => session?.awaitAccessToken() ?? Promise.resolve(),
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
      attendance: createAttendanceApi(client),
      student: createStudentPortalApi(client),
      dashboard: createDashboardApi(client),
      teachers: createTeachersApi(client),
      holidays: createHolidaysApi(client),
      notices: createNoticesApi(client),
      events: createEventsApi(client),
      subjects: createSubjectsApi(client),
      exams: createExamsApi(client),
      marks: createMarksApi(client),
      levels: createLevelsApi(client),
      promotions: createPromotionsApi(client),
      teacherSelf: createTeacherSelfApi(client),
      staff: createStaffApi(client),
      billing: createBillingApi(client),
      sms: createSmsApi(client),
      schoolCodes: createSchoolCodesAdminApi(client),
      fees: createFeesApi(client),
      accounts: createAccountsApi(client),
      siteDocs: createSiteDocsApi(client),
      certificates: createCertificatesApi(client),
      admission: createAdmissionApi(client),
      gallery: createGalleryApi(client),
      registration: createRegistrationApi(client),
      platform: tenant.source === 'platform' ? createPlatformApi(client) : null,
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
  }, [tenant.tenantKey, tenant.source, baseUrl, tenantHeader]);

  useEffect(() => {
    const { session } = value;
    let previous = session.getSnapshot();
    const unsubscribe = session.subscribe((snapshot) => {
      if (previous.status === 'authenticated' && snapshot.status !== 'authenticated') {
        purgePrivateQueries(queryClient, tenant.tenantKey);
      }
      // Came back after an offline start: refetch what failed while the app showed offline.
      if (previous.startupError && snapshot.status === 'authenticated') {
        void queryClient.invalidateQueries({
          queryKey: [TENANT_ROOT, tenant.tenantKey, 'private'],
        });
      }
      previous = snapshot;
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

  return (
    <ApiContext.Provider value={value}>
      <QueryPersistence
        queryClient={queryClient}
        tenantKey={tenant.tenantKey}
        session={value.session}
      >
        {children}
      </QueryPersistence>
    </ApiContext.Provider>
  );
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>');
  return ctx;
}

/** Platform endpoints; only valid under the platform layout (throws in a school session). */
export function usePlatformApi(): PlatformApi {
  const { platform } = useApi();
  if (!platform) throw new Error('usePlatformApi is only available in platform mode');
  return platform;
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

/**
 * The signed-in user's id, or at launch the saved one while the refresh runs, for query keys
 * only (so the restored cache and the first fetch use the final key). Never for authorization.
 */
export function sessionUserId(session: SessionSnapshot): number | undefined {
  return session.user?.id ?? session.provisional?.userId ?? undefined;
}
