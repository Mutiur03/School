import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { isVercel } from '@/lib/platform';

/** Vercel Analytics / Speed Insights — no-op on Cloudflare OpenNext (those scripts 404 there). */
export function VercelTelemetry() {
  if (!isVercel) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
