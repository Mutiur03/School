/**
 * Web key-value store backed by localStorage. Only for non-sensitive, tenant-scoped
 * preferences: credentials never go here (the refresh token is an HttpOnly cookie).
 */
import { createMemoryKeyValueStore, type KeyValueStore } from './key-value';

const hasLocalStorage = (() => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
})();

export const deviceStore: KeyValueStore = hasLocalStorage
  ? {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => window.localStorage.setItem(key, value),
      removeItem: async (key) => window.localStorage.removeItem(key),
    }
  : createMemoryKeyValueStore();
