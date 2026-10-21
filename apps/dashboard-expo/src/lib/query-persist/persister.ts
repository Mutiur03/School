/**
 * Wires the query cache to the device snapshot store for one school (see policy.ts for what may
 * be kept). Pure TS (no React / native imports) so the clearing and scoping rules are unit tested.
 *
 * - Hydrates as soon as the user is known: the provisional (saved) user at launch, or the user
 *   the server returned. Restored data only renders; every refetch still needs the server token.
 * - Writes only while authenticated, debounced, and only allowlisted keys of this school.
 * - Clears every snapshot on sign-out / expiry, drops other schools' snapshots on start, and
 *   purges + clears if the confirmed user differs from the provisional one.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { SessionSnapshot } from '../api/session';
import { purgePrivateQueries } from '@/tenant/query-keys';
import { buildSnapshot, isPersistableKey, parseSnapshot, scopeId, type CacheScope } from './policy';
import type { QueryCacheStore } from './store';

export const WRITE_DEBOUNCE_MS = 1_000;
const noop = () => {};

export interface SessionSource {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
}

export function scopeForSnapshot(snap: SessionSnapshot, tenantKey: string): CacheScope | null {
  if (snap.status === 'authenticated' && snap.user) {
    return { tenantKey, role: snap.user.role, userId: snap.user.id };
  }
  if (snap.status === 'unknown' && snap.provisional?.userId != null) {
    return { tenantKey, role: snap.provisional.role, userId: snap.provisional.userId };
  }
  return null;
}

export interface PersisterOptions {
  queryClient: QueryClient;
  tenantKey: string;
  session: SessionSource;
  store: QueryCacheStore;
  buster: string;
  debounceMs?: number;
  now?: () => number;
  /** Called once restored data was put on screen. */
  onRestored?: () => void;
}

/** Starts persisting; returns a stop function. Returns noop when the store is disabled (web). */
export function startQueryPersistence(o: PersisterOptions): {
  stop: () => void;
  flush: () => Promise<void>;
  idle: () => Promise<void>;
} {
  const now = o.now ?? Date.now;
  let pending: Promise<unknown> = Promise.resolve();
  const track = (p: Promise<unknown>) => {
    pending = Promise.all([pending, p.catch(noop)]);
  };
  if (!o.store.enabled) return { stop: noop, flush: async () => {}, idle: async () => {} };

  const { queryClient, tenantKey, store } = o;
  let disposed = false;
  let scope: CacheScope | null = null;
  let hydratedFor: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  track(store.clear({ keepTenantKey: tenantKey }));

  const hydrate = (target: CacheScope) => {
    const id = scopeId(target);
    hydratedFor = id;
    track(
      store.read(target).then((raw) => {
        if (disposed || !scope || scopeId(scope) !== id) return;
        let applied = 0;
        for (const q of parseSnapshot(raw, target, o.buster, now())) {
          const existing = queryClient.getQueryState(q.queryKey);
          if ((existing?.dataUpdatedAt ?? 0) >= q.dataUpdatedAt) continue;
          queryClient.setQueryData(q.queryKey, q.data, { updatedAt: q.dataUpdatedAt });
          applied += 1;
        }
        if (applied > 0) o.onRestored?.();
      }),
    );
  };

  const onSnapshot = (snap: SessionSnapshot) => {
    if (disposed) return;
    if (snap.status === 'anonymous') {
      scope = null;
      hydratedFor = null;
      clearTimeout(timer);
      track(store.clear());
      return;
    }
    const next = scopeForSnapshot(snap, tenantKey);
    if (!next) return;
    if (scope && scopeId(scope) !== scopeId(next)) {
      // Saved user and confirmed user differ: nothing of the other one may stay on screen.
      purgePrivateQueries(queryClient, tenantKey);
      track(store.clear());
      hydratedFor = null;
    }
    scope = next;
    if (hydratedFor !== scopeId(next)) hydrate(next);
  };

  const write = async () => {
    const snap = o.session.getSnapshot();
    if (disposed || !scope || snap.status !== 'authenticated') return;
    const snapshot = buildSnapshot(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => ({
          queryKey: q.queryKey,
          status: q.state.status,
          data: q.state.data,
          dataUpdatedAt: q.state.dataUpdatedAt,
        })),
      scope,
      o.buster,
      now(),
    );
    await store.write(scope, JSON.stringify(snapshot));
  };

  const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!isPersistableKey(event.query.queryKey, tenantKey)) return;
    clearTimeout(timer);
    timer = setTimeout(() => track(write()), o.debounceMs ?? WRITE_DEBOUNCE_MS);
  });
  const unsubscribeSession = o.session.subscribe(onSnapshot);
  onSnapshot(o.session.getSnapshot());

  return {
    stop: () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribeCache();
      unsubscribeSession();
    },
    flush: async () => {
      clearTimeout(timer);
      await write();
    },
    idle: () => pending.then(noop),
  };
}
