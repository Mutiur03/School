/**
 * App-wide native splash hold (see splash-gate.ts). Imported first by app/_layout so
 * preventAutoHideAsync runs at module load. On web expo-splash-screen is a no-op.
 */
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { createSplashGate } from './splash-gate';

void SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions({ fade: true, duration: 200 });
} catch {
  // Older native module without options: plain hide.
}

export const splashGate = createSplashGate({ hide: () => SplashScreen.hideAsync() });

/** Render on the first real screen: hides the splash after that screen has committed. */
export function SplashReady({ reason = 'ready' }: { reason?: 'ready' | 'error' }) {
  useEffect(() => {
    splashGate.ready(reason);
  }, [reason]);
  return null;
}
