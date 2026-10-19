/**
 * One request at a time for money actions (collect fees, save a voucher, close a year). Buttons
 * are also disabled while pending, but a state update lands a render later; this guard is
 * synchronous, so a double tap or a repeated Enter can't send the same request twice.
 */
export interface SingleFlight {
  readonly busy: boolean;
  /** Runs `fn` unless one is already running (then resolves `undefined` without calling it). */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
}

export function createSingleFlight(): SingleFlight {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run<T>(fn: () => Promise<T>) {
      if (busy) return undefined;
      busy = true;
      try {
        return await fn();
      } finally {
        busy = false;
      }
    },
  };
}
