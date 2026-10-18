/**
 * Native SessionPersistence backed by expo-secure-store, one slot per school. Metro picks
 * session-persistence.web.ts on web. Unused until the backend offers a native token mode (see
 * src/lib/api/token-store.ts); wired now so the storage rules are fixed before login lands.
 */
import * as SecureStore from 'expo-secure-store';
import type { PersistedSession, SessionPersistence } from '@/lib/api';
import { tenantStorageKey } from './tenant-scoped-storage';

export function createSessionPersistence(tenantKey: string): SessionPersistence {
  const key = tenantStorageKey(tenantKey, 'session');
  return {
    kind: 'secure-store',
    async load() {
      const raw = await SecureStore.getItemAsync(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as PersistedSession;
        return typeof parsed.refreshToken === 'string' ? parsed : null;
      } catch {
        return null;
      }
    },
    save: (session) =>
      SecureStore.setItemAsync(key, JSON.stringify(session), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    clear: () => SecureStore.deleteItemAsync(key),
  };
}
