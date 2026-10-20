import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSplashGate, SPLASH_CAP_MS } from './splash-gate';

function fakeTimers() {
  let fn: (() => void) | null = null;
  let ms = -1;
  let cleared = false;
  return {
    setTimer: (f: () => void, m: number) => {
      fn = f;
      ms = m;
      return 1;
    },
    clearTimer: () => {
      cleared = true;
    },
    fire: () => fn?.(),
    get ms() {
      return ms;
    },
    get cleared() {
      return cleared;
    },
  };
}

describe('splash gate', () => {
  it('hides once when the first screen is ready and cancels the cap', () => {
    const t = fakeTimers();
    let hides = 0;
    const gate = createSplashGate({ hide: () => void (hides += 1), ...t });
    assert.equal(gate.hidden, false);
    gate.ready();
    gate.ready();
    t.fire();
    assert.equal(hides, 1);
    assert.equal(gate.reason, 'ready');
    assert.equal(t.cleared, true);
  });

  it('the safety cap (~3 s) hides it when no screen reports ready', () => {
    const t = fakeTimers();
    let hides = 0;
    const gate = createSplashGate({ hide: () => void (hides += 1), ...t });
    assert.equal(t.ms, SPLASH_CAP_MS);
    assert.ok(SPLASH_CAP_MS <= 3_000);
    t.fire();
    gate.ready();
    assert.equal(hides, 1);
    assert.equal(gate.reason, 'cap');
  });

  it('a failing hide (sync throw or rejection) never escapes', async () => {
    const t1 = fakeTimers();
    const g1 = createSplashGate({
      hide: () => {
        throw new Error('no splash');
      },
      ...t1,
    });
    assert.doesNotThrow(() => g1.ready('error'));
    assert.equal(g1.reason, 'error');
    const t2 = fakeTimers();
    const g2 = createSplashGate({ hide: () => Promise.reject(new Error('gone')), ...t2 });
    g2.ready();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(g2.hidden, true);
  });

  it('real timers: cap fires on its own', async () => {
    let hidden = false;
    createSplashGate({ hide: () => void (hidden = true), capMs: 5 });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(hidden, true);
  });
});
