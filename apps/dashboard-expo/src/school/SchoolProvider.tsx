/**
 * Which school the user picked with a school code (persisted, public data only) plus the
 * looked-up school waiting for confirmation (memory only). Also owns the pre-tenant client used
 * for the lookup: it talks to EXPO_PUBLIC_DIRECTORY_URL with no tenant header and no auth.
 *
 * Or platform (super-admin) mode instead of a school: chosen with the platform access code,
 * persisted under the same key so exactly one of the two is active and a reopen returns to it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { appConfig } from '@/config/env';
import {
  createApiClient,
  createSchoolCodeApi,
  NATIVE_CLIENT_HEADER,
  type SchoolCodeApi,
  type SchoolCodeLookup,
} from '@/lib/api';
import { deviceStore } from '@/lib/storage/device-store';
import { withTimeout } from '@/lib/timeout';
import {
  clearSelection,
  loadStoredSelection,
  platformSelectionFor,
  savePlatformSelection,
  saveSelection,
  selectionFromLookup,
  type PlatformSelection,
  type SchoolSelection,
} from './selection';

export interface SchoolContextValue {
  /** null until loaded from storage. */
  ready: boolean;
  selection: SchoolSelection | null;
  /** Platform (super-admin) mode instead of a school. Never set together with `selection`. */
  platform: PlatformSelection | null;
  /** Whether this build can offer platform sign-in (has a super-admin origin). */
  platformAvailable: boolean;
  /** Switch to platform mode. Callers sign out of the current school and purge it first. */
  choosePlatform: () => Promise<PlatformSelection | null>;
  /** Looked up but not confirmed yet. */
  pending: SchoolCodeLookup | null;
  setPending: (lookup: SchoolCodeLookup | null) => void;
  /** Confirm the pending school: persist it and make it the active tenant. */
  confirmPending: () => Promise<SchoolSelection | null>;
  /** Forget the school or platform choice. Callers sign out and purge tenant data first. */
  clear: () => Promise<void>;
  codes: SchoolCodeApi;
}

const SELECTION_LOAD_TIMEOUT_MS = 5_000;

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<SchoolSelection | null>(null);
  const [platform, setPlatform] = useState<PlatformSelection | null>(null);
  const [pending, setPending] = useState<SchoolCodeLookup | null>(null);

  useEffect(() => {
    let active = true;
    // Bounded: a stuck secure-storage read must not hold the app on the boot screen. On timeout
    // the app opens at "enter school code" for this launch; the saved school is not overwritten.
    withTimeout(
      loadStoredSelection(deviceStore, appConfig.superAdminUrl),
      SELECTION_LOAD_TIMEOUT_MS,
      'Reading the saved school',
    )
      .catch(() => null)
      .then((loaded) => {
        if (!active) return;
        setSelection(loaded?.kind === 'school' ? loaded.school : null);
        setPlatform(loaded?.kind === 'platform' ? loaded.platform : null);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const codes = useMemo(
    () =>
      createSchoolCodeApi(
        createApiClient({
          baseUrl: appConfig.directoryUrl,
          credentials: 'omit',
          defaultHeaders: () => (Platform.OS === 'web' ? {} : { ...NATIVE_CLIENT_HEADER }),
        }),
        { allowHttp: appConfig.appEnv === 'local' },
      ),
    [],
  );

  const confirmPending = useCallback(async () => {
    if (!pending) return null;
    const next = selectionFromLookup(pending);
    await saveSelection(deviceStore, next);
    // `pending` stays until the next lookup: the confirm screen waits for the re-keyed tenant.
    setPlatform(null);
    setSelection(next);
    return next;
  }, [pending]);

  const platformAvailable = platformSelectionFor(appConfig.superAdminUrl) !== null;

  const choosePlatform = useCallback(async () => {
    const next = platformSelectionFor(appConfig.superAdminUrl);
    if (!next) return null;
    await savePlatformSelection(deviceStore, next);
    setSelection(null);
    setPending(null);
    setPlatform(next);
    return next;
  }, []);

  const clear = useCallback(async () => {
    await clearSelection(deviceStore);
    setSelection(null);
    setPlatform(null);
    setPending(null);
  }, []);

  const value = useMemo<SchoolContextValue>(
    () => ({
      ready,
      selection,
      platform,
      platformAvailable,
      choosePlatform,
      pending,
      setPending,
      confirmPending,
      clear,
      codes,
    }),
    [
      ready,
      selection,
      platform,
      platformAvailable,
      choosePlatform,
      pending,
      confirmPending,
      clear,
      codes,
    ],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside <SchoolProvider>');
  return ctx;
}
