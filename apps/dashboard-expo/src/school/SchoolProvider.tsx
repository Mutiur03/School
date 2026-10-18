/**
 * Which school the user picked with a school code (persisted, public data only) plus the
 * looked-up school waiting for confirmation (memory only). Also owns the pre-tenant client used
 * for the lookup: it talks to EXPO_PUBLIC_DIRECTORY_URL with no tenant header and no auth.
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
import {
  clearSelection,
  loadSelection,
  saveSelection,
  selectionFromLookup,
  type SchoolSelection,
} from './selection';

export interface SchoolContextValue {
  /** null until loaded from storage. */
  ready: boolean;
  selection: SchoolSelection | null;
  /** Looked up but not confirmed yet. */
  pending: SchoolCodeLookup | null;
  setPending: (lookup: SchoolCodeLookup | null) => void;
  /** Confirm the pending school: persist it and make it the active tenant. */
  confirmPending: () => Promise<SchoolSelection | null>;
  /** Forget the school (switch school). Callers sign out and purge tenant data first. */
  clear: () => Promise<void>;
  codes: SchoolCodeApi;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<SchoolSelection | null>(null);
  const [pending, setPending] = useState<SchoolCodeLookup | null>(null);

  useEffect(() => {
    let active = true;
    loadSelection(deviceStore)
      .catch(() => null)
      .then((loaded) => {
        if (!active) return;
        setSelection(loaded);
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
    setSelection(next);
    return next;
  }, [pending]);

  const clear = useCallback(async () => {
    await clearSelection(deviceStore);
    setSelection(null);
    setPending(null);
  }, []);

  const value = useMemo<SchoolContextValue>(
    () => ({ ready, selection, pending, setPending, confirmPending, clear, codes }),
    [ready, selection, pending, confirmPending, clear, codes],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside <SchoolProvider>');
  return ctx;
}
