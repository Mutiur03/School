/**
 * Session persistence adapter.
 *
 * Today's backend contract (see auth.ts) never hands the refresh token to JavaScript: on web it
 * lives in an HttpOnly cookie, which is the safest place for it. So on web nothing is persisted
 * and the access token stays in memory; a reload restores the session by calling refresh.
 *
 * Native apps need somewhere durable for a long-lived credential. That requires a backend
 * change (a native token mode that returns the refresh token in the body, a separate refresh
 * secret, rotation) which is out of scope for this milestone. This interface is the seam it
 * will plug into: src/lib/storage/secure-session-store.ts implements it with expo-secure-store
 * (Keychain / Android Keystore), namespaced per school so one tenant can never read another's.
 *
 * Rules for implementations:
 * - Never store the access token; it is memory-only on every platform.
 * - Never use AsyncStorage/localStorage for credentials.
 * - `clear()` must be safe to call when nothing is stored.
 */
import type { UserRole } from './auth';

export interface PersistedSession {
  refreshToken: string;
  role: UserRole;
  savedAt: number;
}

export interface SessionPersistence {
  readonly kind: 'none' | 'memory' | 'secure-store';
  load(): Promise<PersistedSession | null>;
  save(session: PersistedSession): Promise<void>;
  clear(): Promise<void>;
}

/** Web default and test double: persists nothing beyond the process. */
export function createMemorySessionPersistence(): SessionPersistence {
  let current: PersistedSession | null = null;
  return {
    kind: 'memory',
    load: async () => current,
    save: async (session) => {
      current = session;
    },
    clear: async () => {
      current = null;
    },
  };
}
