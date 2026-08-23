import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'chunk-load-reload';

export class StaleChunkError extends TypeError {
  constructor(message = "Cannot read properties of undefined (reading 'default')") {
    super(message);
    this.name = 'StaleChunkError';
  }
}

/** True when a dynamic import failed because of a stale deploy / missing chunk. */
export function isStaleChunkError(reason: unknown): boolean {
  if (!reason) return false;
  if (reason instanceof StaleChunkError) return true;
  const err = reason as { message?: string; name?: string; cause?: unknown };
  const msg = String(err.message ?? reason ?? '');
  const causeMsg =
    err.cause && typeof err.cause === 'object' && 'message' in err.cause
      ? String((err.cause as { message?: string }).message ?? '')
      : '';
  const combined = `${msg}\n${causeMsg}`;
  return (
    /Failed to fetch dynamically imported module/i.test(combined) ||
    /Importing a module script failed/i.test(combined) ||
    /error loading dynamically imported module/i.test(combined) ||
    /Loading chunk [\d]+ failed/i.test(combined) ||
    /ChunkLoadError/i.test(combined) ||
    (/TypeError|StaleChunkError/i.test(String(err.name ?? '')) &&
      /reading ['"]default['"]/i.test(combined))
  );
}

/** Reload once per tab session so a new index.html picks up current asset hashes. */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    // sessionStorage unavailable — still attempt a single reload via URL flag
    if (typeof window !== 'undefined' && /[?&]chunk_reload=1(?:&|$)/.test(window.location.search)) {
      return false;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('chunk_reload', '1');
    window.location.replace(url.toString());
    return true;
  }
  window.location.reload();
  return true;
}

/** Clear the reload guard after a successful boot so a later deploy can recover again. */
export function clearStaleChunkReloadGuard(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('chunk_reload')) return;
  url.searchParams.delete('chunk_reload');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export type PrefetchableLazyComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  prefetch: () => Promise<void>;
};

/**
 * Like React.lazy, but on a missing/stale chunk reload once to fetch fresh HTML.
 * Avoids the white-screen MIME / undefined.default crash after deploys.
 * `.prefetch()` warms the same chunk promise used by the lazy render.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): PrefetchableLazyComponent<T> {
  let pending: Promise<{ default: T }> | undefined;

  const recover = (err: unknown): Promise<{ default: T }> => {
    pending = undefined;
    if (isStaleChunkError(err) && reloadOnceForStaleChunk()) {
      // Hang until the page unloads from reload.
      return new Promise<{ default: T }>(() => {});
    }
    throw err;
  };

  const load = (): Promise<{ default: T }> => {
    if (!pending) {
      pending = factory().then((mod) => {
        // A stale/partial chunk can resolve to undefined (or lack a default)
        // instead of rejecting — the crash is then a plain "reading 'default'"
        // TypeError past any .catch. Treat it as a stale chunk too.
        if (!mod || typeof mod.default === 'undefined') {
          return recover(new StaleChunkError());
        }
        return mod;
      }, recover);
    }
    return pending;
  };

  const Comp = lazy(load) as PrefetchableLazyComponent<T>;
  // Hover prefetch is best-effort: never surface as unhandledrejection (Sentry noise).
  Comp.prefetch = async () => {
    try {
      await load();
    } catch {
      /* stale chunk already attempted reload via recover(); ignore for prefetch */
    }
  };
  return Comp;
}
