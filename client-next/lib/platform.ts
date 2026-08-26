/** Build/runtime flags for dual deploy (Vercel + OpenNext/Cloudflare). */

/** True on Vercel builds/runtime — use for Vercel-only scripts (Analytics, Speed Insights). */
export const isVercel = Boolean(process.env.VERCEL);
