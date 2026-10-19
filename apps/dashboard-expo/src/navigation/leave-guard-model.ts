/**
 * In-app "leave this page?" guard (pure part). A screen with unsaved work registers a guard; the
 * shell's links ask before navigating while one is set. One guard at a time: the screen on top.
 */
export interface LeaveGuard {
  title: string;
  message: string;
}

export interface LeaveGuardStore {
  current(): LeaveGuard | null;
  /** Registers `g`; the returned function removes it again (only if it is still the current). */
  set(g: LeaveGuard): () => void;
  /**
   * Runs `go` now when nothing is guarded; otherwise hands the guard and a `proceed` callback to
   * `ask` (proceed clears the guard first so the leaving screen can't block its own exit).
   */
  attempt(go: () => void, ask: (g: LeaveGuard, proceed: () => void) => void): void;
}

export function createLeaveGuardStore(): LeaveGuardStore {
  let guard: LeaveGuard | null = null;
  return {
    current: () => guard,
    set(g) {
      guard = g;
      return () => {
        if (guard === g) guard = null;
      };
    },
    attempt(go, ask) {
      const g = guard;
      if (!g) {
        go();
        return;
      }
      ask(g, () => {
        if (guard === g) guard = null;
        go();
      });
    },
  };
}
