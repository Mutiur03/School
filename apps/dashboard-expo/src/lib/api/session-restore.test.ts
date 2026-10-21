import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { SessionManager, type SessionSnapshot } from './session';
import { createMemorySessionPersistence } from './token-store';

const never = <T>() => new Promise<T>(() => {});
const user = { id: 7, role: 'teacher' as const };

async function saved(extra: { userId?: number } = { userId: 7 }) {
  const persistence = createMemorySessionPersistence();
  await persistence.save({ refreshToken: 'r1', role: 'teacher', savedAt: 0, ...extra });
  return persistence;
}

function record(manager: SessionManager) {
  const seen: SessionSnapshot[] = [];
  manager.subscribe((s) => seen.push(s));
  return seen;
}

describe('optimistic session restore', () => {
  it('stored token: provisional role/user before the refresh answers, then authenticated', async () => {
    let answer!: (v: unknown) => void;
    const manager = new SessionManager({
      persistence: await saved(),
      transport: 'body',
      refreshRequest: () =>
        new Promise((r) => {
          answer = r as (v: unknown) => void;
        }),
    });
    const seen = record(manager);
    const boot = manager.bootstrap();
    await new Promise((r) => setTimeout(r, 5));
    const mid = manager.getSnapshot();
    assert.equal(mid.status, 'unknown');
    assert.deepEqual(mid.provisional, { role: 'teacher', userId: 7 });
    assert.equal(manager.getAccessToken(), null, 'no token until the server answers');
    answer({ accessToken: 'a2', refreshToken: 'r2', user });
    await boot;
    const end = manager.getSnapshot();
    assert.equal(end.status, 'authenticated');
    assert.equal(end.provisional, null);
    assert.ok(seen.some((s) => s.provisional?.role === 'teacher'));
  });

  it('older saves without a user id still give a provisional role', async () => {
    const manager = new SessionManager({
      persistence: await saved({}),
      transport: 'body',
      refreshRequest: () => never(),
      startupTimeoutMs: 10,
      timeoutMs: 50,
    });
    await manager.bootstrap();
    assert.deepEqual(manager.getSnapshot().provisional, { role: 'teacher', userId: null });
  });

  it('no stored token: anonymous, no provisional, no request', async () => {
    let requested = false;
    const manager = new SessionManager({
      persistence: createMemorySessionPersistence(),
      transport: 'body',
      refreshRequest: async () => {
        requested = true;
        return { accessToken: 'a', refreshToken: 'r', user };
      },
    });
    await manager.bootstrap();
    assert.equal(requested, false);
    assert.equal(manager.getSnapshot().status, 'anonymous');
    assert.equal(manager.getSnapshot().provisional, null);
  });

  it('401 on the startup refresh: anonymous, provisional dropped, stored token cleared', async () => {
    const persistence = await saved();
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: async () => {
        throw new ApiError({ kind: 'http', status: 401, message: 'Unauthorized' });
      },
    });
    await manager.bootstrap();
    const s = manager.getSnapshot();
    assert.equal(s.status, 'anonymous');
    assert.equal(s.provisional, null);
    assert.equal(s.endedReason, null);
    assert.equal(await persistence.load(), null);
  });

  it('403 behaves like 401', async () => {
    const manager = new SessionManager({
      persistence: await saved(),
      transport: 'body',
      refreshRequest: async () => {
        throw new ApiError({ kind: 'http', status: 403, message: 'Forbidden' });
      },
    });
    await manager.bootstrap();
    assert.equal(manager.getSnapshot().status, 'anonymous');
  });

  it('network error: stays provisional with a startupError (offline banner), token kept', async () => {
    const persistence = await saved();
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: async () => {
        throw new ApiError({ kind: 'network', message: 'offline' });
      },
    });
    await manager.bootstrap();
    const s = manager.getSnapshot();
    assert.equal(s.status, 'unknown');
    assert.deepEqual(s.provisional, { role: 'teacher', userId: 7 });
    assert.match(s.startupError ?? '', /reach the server/);
    assert.equal((await persistence.load())?.refreshToken, 'r1');
  });

  it('startup timeout: offline banner after startupTimeoutMs, a late answer still signs in', async () => {
    let answer!: (v: unknown) => void;
    const persistence = await saved();
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      startupTimeoutMs: 15,
      refreshRequest: () =>
        new Promise((r) => {
          answer = r as (v: unknown) => void;
        }),
    });
    const started = Date.now();
    await manager.bootstrap();
    assert.ok(Date.now() - started < 1_000);
    assert.equal(manager.getSnapshot().status, 'unknown');
    assert.match(manager.getSnapshot().startupError ?? '', /took too long/);
    answer({ accessToken: 'a2', refreshToken: 'r2', user });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(manager.getSnapshot().status, 'authenticated');
    assert.equal(manager.getSnapshot().startupError, null);
    assert.equal((await persistence.load())?.refreshToken, 'r2', 'rotated token is never lost');
  });

  it('startup timeout then a late 401: ends signed out', async () => {
    let fail!: (e: unknown) => void;
    const manager = new SessionManager({
      persistence: await saved(),
      transport: 'body',
      startupTimeoutMs: 10,
      refreshRequest: () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    });
    await manager.bootstrap();
    fail(new ApiError({ kind: 'http', status: 401, message: 'Unauthorized' }));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(manager.getSnapshot().status, 'anonymous');
  });

  it('the default startup timeout is ~7 s (mid-session refresh keeps the longer client timeout)', async () => {
    const { STARTUP_REFRESH_TIMEOUT_MS } = await import('./session');
    const { REFRESH_TIMEOUT_MS } = await import('./auth');
    assert.equal(STARTUP_REFRESH_TIMEOUT_MS, 7_000);
    assert.equal(REFRESH_TIMEOUT_MS, 15_000);
  });

  it('persists the user id with the rotated token (scopes the device cache)', async () => {
    const persistence = await saved();
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: async () => ({ accessToken: 'a2', refreshToken: 'r2', user }),
    });
    await manager.bootstrap();
    assert.equal((await persistence.load())?.userId, 7);
  });
});

describe('requests during launch wait for the token (no 401 round trip)', () => {
  it('a query fired before bootstrap goes out once, with the refreshed token', async () => {
    const calls: { path: string; auth: string | null }[] = [];
    let session: SessionManager | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      const headers = init.headers as Record<string, string>;
      calls.push({ path, auth: headers.Authorization ?? null });
      if (path === '/api/auth/sessions/refresh') {
        return new Response(
          JSON.stringify({ success: true, data: { accessToken: 'a2', refreshToken: 'r2', user } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (!headers.Authorization) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = createApiClient({
      baseUrl: 'https://school.test',
      fetch: fetchImpl,
      auth: {
        getAccessToken: () => session?.getAccessToken() ?? null,
        refresh: () => session?.refresh() ?? Promise.resolve(false),
        onSessionExpired: (e) => session?.onSessionExpired(e),
        awaitAccessToken: () => session?.awaitAccessToken() ?? Promise.resolve(),
      },
    });
    session = new SessionManager({
      persistence: await saved(),
      transport: 'body',
      refreshRequest: (token) =>
        client.post('/api/auth/sessions/refresh', { refreshToken: token }, { auth: false }),
    });
    const query = client.get('/api/notices');
    const boot = session.bootstrap();
    await Promise.all([query, boot]);
    assert.deepEqual(
      calls.map((c) => [c.path, c.auth]),
      [
        ['/api/auth/sessions/refresh', null],
        ['/api/notices', 'Bearer a2'],
      ],
    );
  });

  it('signed out: requests do not wait', async () => {
    const manager = new SessionManager({
      persistence: createMemorySessionPersistence(),
      transport: 'body',
      refreshRequest: () => never(),
    });
    await manager.bootstrap();
    await manager.awaitAccessToken();
    assert.equal(manager.getSnapshot().status, 'anonymous');
  });
});
