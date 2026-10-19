/**
 * Native key-value store backed by expo-secure-store (Keychain / Android Keystore).
 * Metro picks device-store.web.ts on web. Values are limited to ~2 KB, which is enough for the
 * small, non-sensitive preferences stored through TenantScopedStorage.
 */
import * as SecureStore from 'expo-secure-store';
import type { KeyValueStore } from './key-value';

export const deviceStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
