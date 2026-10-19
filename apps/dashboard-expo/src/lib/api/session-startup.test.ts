import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withTimeout } from '../timeout';
import { ApiError } from './errors';
import { SessionManager } from './session';
import { createMemorySessionPersistence, type SessionPersistence } from './token-store';

const never = <T>() => new Promise<T>(() => {});

describe('withTimeout', () => {
  it('passes values and errors through, rejects with a timeout ApiError when stuck', async () => {
    assert.equal(await withTimeout(Promise.resolve(1), 50, 'x'), 1);
    await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 50, 'x'), /boom/);
    await assert.rejects(
      withTimeout(never(), 10, 'Thing'),
      (e: ApiError) => e instanceof ApiError && e.kind === 'timeout' && e.isTransport,
    );
  });
});

describe('SessionManager startup never spins forever', () => {
  it('offline: stays unknown (token kept) but reports a startupError; retry clears it', async () => {
    let calls = 0;
    const persistence = createMemorySessionPersistence();
    await persistence.save({ refreshToken: 'r1', role: 'admin', savedAt: 0 });
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: async () => {
        calls += 1;
        if (calls === 1) throw new ApiError({ kind: 'network', message: 'offline' });
        return { accessToken: 'a2', refreshToken: 'r2', user: { id: 1, role: 'admin' } };
      },
    });
    await manager.bootstrap();
    assert.equal(manager.getSnapshot().status, 'unknown');
    assert.match(manager.getSnapshot().startupError ?? '', /reach the server/);
    assert.equal((await persistence.load())?.refreshToken, 'r1');

    const seen: (string | null)[] = [];
    manager.subscribe((s) => seen.push(s.startupError));
    await manager.bootstrap();
    assert.equal(seen[0], null, 'retry first goes back to plain "checking"');
    assert.equal(manager.getSnapshot().status, 'authenticated');
    assert.equal(manager.getSnapshot().startupError, null);
  });

  it('a refresh call that never settles times out into a startupError', async () => {
    const persistence = createMemorySessionPersistence();
    await persistence.save({ refreshToken: 'r1', role: 'admin', savedAt: 0 });
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      timeoutMs: 20,
      refreshRequest: () => never(),
    });
    await manager.bootstrap();
    assert.equal(manager.getSnapshot().status, 'unknown');
    assert.match(manager.getSnapshot().startupError ?? '', /took too long/);
  });

  it('a 401 from refresh ends in anonymous with no startupError', async () => {
    const persistence = createMemorySessionPersistence();
    await persistence.save({ refreshToken: 'r1', role: 'admin', savedAt: 0 });
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: async () => {
        throw new ApiError({ kind: 'http', status: 401, message: 'Unauthorized' });
      },
    });
    await manager.bootstrap();
    assert.equal(manager.getSnapshot().status, 'anonymous');
    assert.equal(manager.getSnapshot().startupError, null);
    assert.equal(await persistence.load(), null);
  });

  it('a secure-storage read that never settles is bounded too', { timeout: 10_000 }, async () => {
    const stuck: SessionPersistence = {
      kind: 'memory',
      load: () => never(),
      save: async () => {},
      clear: async () => {},
    };
    let requested = false;
    const manager = new SessionManager({
      persistence: stuck,
      transport: 'body',
      refreshRequest: async () => {
        requested = true;
        throw new Error('unreachable');
      },
    });
    await manager.bootstrap();
    assert.equal(requested, false);
    assert.equal(manager.getSnapshot().status, 'unknown');
    assert.match(manager.getSnapshot().startupError ?? '', /saved session took too long/);
  });
});
