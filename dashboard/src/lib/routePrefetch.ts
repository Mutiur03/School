type Prefetcher = () => Promise<void>;

const byPath = new Map<string, Prefetcher>();

/**
 * Register lazy route components so sidebar hover can warm their chunks.
 * Keys are full paths (e.g. `/admin/notice`). Edit the map in App.tsx.
 */
export function registerRoutePrefetchers(routes: Record<string, { prefetch: Prefetcher }>): void {
  for (const [path, comp] of Object.entries(routes)) {
    byPath.set(path, () => comp.prefetch());
  }
}

/** Warm the JS chunk for a dashboard route (no-op if unregistered). */
export function prefetchRoute(path: string | undefined | null): void {
  if (!path) return;
  const run = byPath.get(path);
  // Prefetch must never produce unhandledrejections (e.g. stale chunks after deploy).
  if (run) void run().catch(() => {});
}
