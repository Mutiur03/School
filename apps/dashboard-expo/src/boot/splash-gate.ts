/**
 * Decides when the native splash goes away. Pure (no native imports) so it is unit tested.
 *
 * The splash is held from module load until the first real route has rendered (role layout,
 * login, or school-code screen), so on native the user goes splash -> app with no spinner in
 * between. A hard cap hides it anyway, so it can never hang; a failed hide is swallowed (the
 * BootScreen underneath is the fallback).
 */
export const SPLASH_CAP_MS = 3_000;

export type SplashHideReason = 'ready' | 'cap' | 'error';

export interface SplashGate {
  /** The first real screen rendered (or startup failed visibly). Idempotent. */
  ready(reason?: Exclude<SplashHideReason, 'cap'>): void;
  readonly hidden: boolean;
  readonly reason: SplashHideReason | null;
}

export function createSplashGate({
  hide,
  capMs = SPLASH_CAP_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: {
  hide: () => Promise<void> | void;
  capMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: never) => void;
}): SplashGate {
  let reason: SplashHideReason | null = null;
  const finish = (why: SplashHideReason) => {
    if (reason) return;
    reason = why;
    clearTimer(timer as never);
    try {
      void Promise.resolve(hide()).catch(() => {});
    } catch {
      // Already hidden / no native module: nothing to do.
    }
  };
  const timer = setTimer(() => finish('cap'), capMs);
  return {
    ready: (why = 'ready') => finish(why),
    get hidden() {
      return reason !== null;
    },
    get reason() {
      return reason;
    },
  };
}
