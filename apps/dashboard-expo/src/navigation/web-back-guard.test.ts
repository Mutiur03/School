import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPopHub, installWebBackGuard, type BackGuardWindow } from './web-back-guard';

/** A browser-like history stack: go() moves asynchronously and fires popstate (or nothing). */
function fakeBrowser(urls: string[], index: number) {
  const entries = urls.map((url, i) => ({
    url,
    state: { id: `r${i}` } as Record<string, unknown>,
  }));
  let i = index;
  const capture: ((e: Event) => void)[] = [];
  const routerSaw: string[] = [];
  const fire = () => {
    let stopped = false;
    const e = { stopImmediatePropagation: () => (stopped = true) } as unknown as Event;
    for (const l of [...capture]) l(e);
    if (!stopped) routerSaw.push(entries[i]!.url);
  };
  const win: BackGuardWindow = {
    history: {
      get state() {
        return entries[i]!.state;
      },
      go(d) {
        const t = i + d;
        if (t < 0 || t >= entries.length) return;
        setTimeout(() => {
          i = t;
          fire();
        }, 1);
      },
      replaceState(data) {
        entries[i]!.state = data as Record<string, unknown>;
      },
    },
    addEventListener: (_t, l) => capture.push(l),
    removeEventListener: (_t, l) => capture.splice(capture.indexOf(l), 1),
    replayPop: () => fire(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout),
  };
  return {
    win,
    url: () => entries[i]!.url,
    routerSaw,
    /** The user presses Back / Forward. */
    press: (d: number) => win.history.go(d),
  };
}
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

describe('web back guard', () => {
  it('undoes Back, asks, and stays on cancel', async () => {
    const b = fakeBrowser(['/a', '/marks', '/c'], 1);
    let asks = 0;
    installWebBackGuard(b.win, { isActive: () => true, ask: () => asks++, settleMs: 20 });
    b.press(-1);
    await tick();
    assert.equal(b.url(), '/marks');
    assert.equal(asks, 1);
    assert.deepEqual(b.routerSaw, []);
  });

  it('replays Back for the router on leave', async () => {
    const b = fakeBrowser(['/a', '/marks'], 1);
    let leave: (() => void) | null = null;
    installWebBackGuard(b.win, { isActive: () => true, ask: (l) => (leave = l), settleMs: 20 });
    b.press(-1);
    await tick();
    assert.equal(b.url(), '/marks');
    leave!();
    await tick();
    assert.equal(b.url(), '/a');
    assert.deepEqual(b.routerSaw, ['/a']);
  });

  it('handles Forward with and without a later entry', async () => {
    const b = fakeBrowser(['/a', '/marks', '/c', '/d'], 1);
    let leave: (() => void) | null = null;
    installWebBackGuard(b.win, { isActive: () => true, ask: (l) => (leave = l), settleMs: 20 });
    b.press(1); // to /c, go(1) overshoots to /d, go(-2) back to /marks
    await tick(80);
    assert.equal(b.url(), '/marks');
    leave!();
    await tick();
    assert.equal(b.url(), '/c');
    assert.deepEqual(b.routerSaw, ['/c']);

    const b2 = fakeBrowser(['/a', '/marks', '/c'], 1);
    let asked = false;
    installWebBackGuard(b2.win, { isActive: () => true, ask: () => (asked = true), settleMs: 20 });
    b2.press(1); // to /c; go(1) is silent; timeout → go(-1)
    await tick(100);
    assert.equal(b2.url(), '/marks');
    assert.equal(asked, true);
    assert.deepEqual(b2.routerSaw, []);
  });

  it('lets moves through when inactive or uninstalled, and keeps the router id', async () => {
    const b = fakeBrowser(['/a', '/marks', '/c'], 1);
    let active = false;
    const off = installWebBackGuard(b.win, {
      isActive: () => active,
      ask: () => assert.fail(),
      settleMs: 20,
    });
    assert.equal((b.win.history.state as { id: string }).id, 'r1');
    b.press(-1);
    await tick();
    assert.deepEqual(b.routerSaw, ['/a']);
    off();
    active = true;
    b.press(1);
    await tick();
    assert.deepEqual(b.routerSaw, ['/a', '/marks']);
  });

  it('gives up on a multi-step jump and lets the router catch up', async () => {
    const b = fakeBrowser(['/a', '/b', '/marks', '/x', '/y'], 2);
    installWebBackGuard(b.win, { isActive: () => true, ask: () => assert.fail(), settleMs: 20 });
    b.press(-2); // to /a; go(1) lands on /b (not ours) → go(-2) impossible... → give up
    await tick(120);
    assert.equal(b.routerSaw.length, 1);
    assert.equal(b.routerSaw[0], b.url());
  });
});

describe('pop hub', () => {
  it('runs handlers ahead of later listeners and lets them stop the event', () => {
    const t = new EventTarget();
    const hub = createPopHub(t as unknown as Window);
    const seen: string[] = [];
    t.addEventListener('popstate', () => seen.push('router'));
    const off = hub.add((e) => {
      seen.push('guard');
      e.stopImmediatePropagation();
    });
    t.dispatchEvent(new Event('popstate'));
    assert.deepEqual(seen, ['guard']);
    off();
    t.dispatchEvent(new Event('popstate'));
    assert.deepEqual(seen, ['guard', 'router']);
  });
});
