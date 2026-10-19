/**
 * Web only: hold up the browser's Back (and Forward) button while a leave guard is active.
 *
 * A page can't cancel a history move, but it can undo one before the app reacts. The listener
 * stops the event, so Expo Router (React Navigation's linking, a plain popstate listener on
 * window) never sees the move. Listeners on window run in registration order (capture or not),
 * so the real window gets a single interceptor registered when this module loads, i.e. before
 * the router mounts; guards plug into it. Then:
 *   1. history.go(1) to step back onto the guarded entry (tagged in history.state at install);
 *   2. if that overshot (the user had pressed Forward), history.go(-2); if go(1) had nowhere to
 *      go (no popstate within `settleMs`), history.go(-1);
 *   3. once on the tagged entry, ask; on "Leave", replay the move and let the router see it.
 * Anything unexpected (e.g. a multi-step jump from the long-press history menu) gives up and
 * re-dispatches popstate so the router catches up with the URL rather than drifting from it.
 */
export interface BackGuardWindow {
  history: {
    readonly state: unknown;
    go(delta: number): void;
    replaceState(data: unknown, unused: string): void;
  };
  addEventListener(
    type: 'popstate',
    listener: (e: Event) => void,
    options: { capture: true },
  ): void;
  removeEventListener(
    type: 'popstate',
    listener: (e: Event) => void,
    options: { capture: true },
  ): void;
  /** Re-fire popstate for the router (the real window: dispatchEvent(new PopStateEvent(...))). */
  replayPop(): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const TAG = '__leaveGuard';

export function installWebBackGuard(
  win: BackGuardWindow,
  opts: { isActive: () => boolean; ask: (leave: () => void) => void; settleMs?: number },
): () => void {
  const settleMs = opts.settleMs ?? 300;
  const token = `lg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const base = win.history.state && typeof win.history.state === 'object' ? win.history.state : {};
  win.history.replaceState({ ...base, [TAG]: token }, '');
  const onGuardedEntry = () => {
    const s = win.history.state;
    return !!s && typeof s === 'object' && (s as Record<string, unknown>)[TAG] === token;
  };

  type Phase = 'idle' | 'restoring' | 'probing' | 'replaying';
  let phase: Phase = 'idle';
  let delta = -1;
  let timer: unknown = null;
  const clear = () => {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  };
  const giveUp = () => {
    clear();
    phase = 'replaying';
    win.replayPop();
  };

  const onPop = (e: Event) => {
    if (phase === 'replaying') {
      phase = 'idle';
      return; // the router handles this one
    }
    if (phase === 'idle' && !opts.isActive()) return;
    e.stopImmediatePropagation();
    if (phase === 'idle') {
      if (onGuardedEntry()) return; // not a move off this entry
      phase = 'restoring';
      delta = -1;
      win.history.go(1);
      // go(1) is silent when there is no later entry: the move was Forward off our entry.
      timer = win.setTimeout(() => {
        timer = null;
        phase = 'probing';
        delta = 1;
        win.history.go(-1);
        timer = win.setTimeout(giveUp, settleMs);
      }, settleMs);
      return;
    }
    clear();
    if (onGuardedEntry()) {
      phase = 'idle';
      const d = delta;
      opts.ask(() => {
        phase = 'replaying';
        win.history.go(d);
      });
      return;
    }
    if (phase === 'restoring') {
      // Overshot: the user had pressed Forward, so the guarded entry is two back.
      phase = 'probing';
      delta = 1;
      win.history.go(-2);
      timer = win.setTimeout(giveUp, settleMs);
      return;
    }
    giveUp();
  };

  win.addEventListener('popstate', onPop, { capture: true });
  return () => {
    clear();
    win.removeEventListener('popstate', onPop, { capture: true });
  };
}

/**
 * One popstate listener registered up front; `add` plugs a handler into it. Handlers run in
 * the order added, ahead of every listener registered after the hub (the router's included).
 */
export function createPopHub(target: Pick<Window, 'addEventListener'>) {
  const handlers: ((e: Event) => void)[] = [];
  let stopped = false;
  target.addEventListener(
    'popstate',
    (e) => {
      stopped = false;
      const stop = e.stopImmediatePropagation.bind(e);
      const proxy = Object.assign(Object.create(e) as Event, {
        stopImmediatePropagation: () => {
          stopped = true;
          stop();
        },
      });
      for (const h of [...handlers]) {
        h(proxy);
        if (stopped) return;
      }
    },
    { capture: true },
  );
  return {
    add(h: (e: Event) => void) {
      handlers.push(h);
      return () => {
        const i = handlers.indexOf(h);
        if (i >= 0) handlers.splice(i, 1);
      };
    },
  };
}

const hub =
  typeof window !== 'undefined' && typeof window.addEventListener === 'function'
    ? createPopHub(window)
    : null;
const removers = new WeakMap<(e: Event) => void, () => void>();

/** The real browser window, or null off the web. */
export function browserBackGuardWindow(): BackGuardWindow | null {
  if (!hub || typeof window.history?.go !== 'function') return null;
  return {
    history: window.history,
    addEventListener: (_t, l) => removers.set(l, hub.add(l)),
    removeEventListener: (_t, l) => {
      removers.get(l)?.();
      removers.delete(l);
    },
    replayPop: () =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
  };
}
