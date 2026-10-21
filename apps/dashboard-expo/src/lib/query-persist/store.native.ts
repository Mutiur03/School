/**
 * Native query cache files under the app's cache directory (expo-file-system, already in the
 * binary, so this ships as an OTA). The OS may evict them at any time; that only costs a refetch.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { scopeFileName, tenantFilePrefix } from './policy';
import type { QueryCacheStore } from './store';

const dir = () => new Directory(Paths.cache, 'query-cache');

export const queryCacheStore: QueryCacheStore = {
  enabled: true,
  async read(scope) {
    const file = new File(dir(), scopeFileName(scope));
    return file.exists ? file.text() : null;
  },
  async write(scope, text) {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    const file = new File(d, scopeFileName(scope));
    if (!file.exists) file.create();
    file.write(text);
  },
  async clear(opts) {
    const d = dir();
    if (!d.exists) return;
    const keep = opts?.keepTenantKey ? tenantFilePrefix(opts.keepTenantKey) : null;
    for (const entry of d.list()) {
      if (entry instanceof File && !(keep && entry.name.startsWith(keep))) entry.delete();
    }
  },
};
