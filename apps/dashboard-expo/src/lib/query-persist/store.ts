/**
 * Web: no on-device query cache (shared browsers; the web app keeps its current behaviour).
 * Metro picks store.native.ts on Android / iOS.
 */
import type { CacheScope } from './policy';

export interface QueryCacheStore {
  enabled: boolean;
  read(scope: CacheScope): Promise<string | null>;
  write(scope: CacheScope, text: string): Promise<void>;
  /** Delete every snapshot, or every snapshot except the given school's. */
  clear(opts?: { keepTenantKey?: string }): Promise<void>;
}

export const queryCacheStore: QueryCacheStore = {
  enabled: false,
  read: async () => null,
  write: async () => {},
  clear: async () => {},
};
