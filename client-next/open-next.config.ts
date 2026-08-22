import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// Dual-deploy OpenNext config. Vercel ignores this file.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
