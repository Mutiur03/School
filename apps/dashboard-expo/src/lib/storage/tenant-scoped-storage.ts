/**
 * Namespaces every key by tenant so one school's cached data can never be read while another
 * school is active, and lets the previous tenant's keys be wiped on switch.
 *
 * Keys look like `sd.t.<tenant>.<name>`, restricted to the characters expo-secure-store accepts
 * ([A-Za-z0-9._-]). An index key per tenant records which names were written, because neither
 * SecureStore nor a portable localStorage wrapper can enumerate keys by prefix.
 */
import type { KeyValueStore } from './key-value';

const PREFIX = 'sd.t';

export const sanitizeKeyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]/g, '_');

export const tenantStorageKey = (tenantKey: string, name: string) =>
  `${PREFIX}.${sanitizeKeyPart(tenantKey)}.${sanitizeKeyPart(name)}`;

const indexKey = (tenantKey: string) => tenantStorageKey(tenantKey, '__index');

export interface TenantScopedStorage {
  readonly tenantKey: string;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

async function readIndex(store: KeyValueStore, tenantKey: string): Promise<string[]> {
  const raw = await store.getItem(indexKey(tenantKey));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

export function createTenantScopedStorage(
  store: KeyValueStore,
  tenantKey: string,
): TenantScopedStorage {
  return {
    tenantKey,
    get: (name) => store.getItem(tenantStorageKey(tenantKey, name)),
    async set(name, value) {
      await store.setItem(tenantStorageKey(tenantKey, name), value);
      const names = await readIndex(store, tenantKey);
      if (!names.includes(name)) {
        await store.setItem(indexKey(tenantKey), JSON.stringify([...names, name]));
      }
    },
    async remove(name) {
      await store.removeItem(tenantStorageKey(tenantKey, name));
      const names = await readIndex(store, tenantKey);
      await store.setItem(indexKey(tenantKey), JSON.stringify(names.filter((n) => n !== name)));
    },
  };
}

/** Delete everything written for a tenant through TenantScopedStorage. */
export async function clearTenantStorage(store: KeyValueStore, tenantKey: string): Promise<void> {
  const names = await readIndex(store, tenantKey);
  await Promise.all(names.map((name) => store.removeItem(tenantStorageKey(tenantKey, name))));
  await store.removeItem(indexKey(tenantKey));
}
