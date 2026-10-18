import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUTH_PATHS, createAuthApi, NATIVE_CLIENT_HEADER } from './auth';
import { createApiClient } from './client';
import { SessionManager } from './session';
import { createMemorySessionPersistence } from './token-store';

type Call = { url: string; init: RequestInit };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recorder(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fn, calls };
}
const body = (c: Call) => (c.init.body ? JSON.parse(String(c.init.body)) : undefined);
const header = (c: Call, name: string) =>
  (c.init.headers as Record<string, string> | undefined)?.[name];

const session = (n: number) => ({
  success: true,
  data: { accessToken: `a${n}`, refreshToken: `r${n}`, user: { id: 7, role: 'admin' } },
});

describe('auth api (native body transport)', () => {
  it('refresh sends the token in the body; web sends an empty body', async () => {
    const f = recorder(() => json(200, session(2)));
    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://s.test',
        fetch: f.fn,
        defaultHeaders: () => ({ ...NATIVE_CLIENT_HEADER }),
      }),
    );
    await auth.refresh('r1');
    await auth.refresh();
    assert.equal(f.calls[0]!.url, `https://s.test${AUTH_PATHS.refresh}`);
    assert.deepEqual(body(f.calls[0]!), { refreshToken: 'r1' });
    assert.deepEqual(body(f.calls[1]!), {});
    assert.equal(header(f.calls[0]!, 'X-Client'), 'native');
    assert.equal(header(f.calls[0]!, 'Authorization'), undefined);
  });

  it('logout is DELETE with the refresh token in the body (native) or none (web)', async () => {
    const f = recorder(() => json(200, { success: true, data: null }));
    const auth = createAuthApi(createApiClient({ baseUrl: '', fetch: f.fn }));
    await auth.logout('r9');
    await auth.logout();
    assert.equal(f.calls[0]!.init.method, 'DELETE');
    assert.deepEqual(body(f.calls[0]!), { refreshToken: 'r9' });
    assert.equal(f.calls[1]!.init.body, undefined);
  });
});

describe('SessionManager body transport', () => {
  function setup(responses: Array<() => Response>) {
    const persistence = createMemorySessionPersistence();
    const sent: Array<string | undefined> = [];
    const f = recorder(() => {
      const next = responses.shift();
      if (!next) throw new Error('unexpected request');
      return next();
    });
    const auth = createAuthApi(createApiClient({ baseUrl: '', fetch: f.fn }));
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: (token) => {
        sent.push(token);
        return auth.refresh(token);
      },
    });
    return { manager, persistence, sent, f };
  }

  it('signIn persists the refresh token; refresh rotates and stores the new one', async () => {
    const { manager, persistence, sent } = setup([() => json(200, session(2))]);
    await manager.signIn({ accessToken: 'a1', refreshToken: 'r1', user: { id: 7, role: 'admin' } });
    assert.equal((await persistence.load())?.refreshToken, 'r1');
    assert.equal(await manager.storedRefreshToken(), 'r1');
    assert.equal(await manager.refresh(), true);
    assert.deepEqual(sent, ['r1']);
    assert.equal(manager.getAccessToken(), 'a2');
    assert.equal((await persistence.load())?.refreshToken, 'r2');
  });

  it('signIn without a refresh token is rejected (would be unrecoverable)', async () => {
    const { manager } = setup([]);
    await assert.rejects(
      manager.signIn({ accessToken: 'a1', user: { id: 7, role: 'admin' } }),
      /refresh token/,
    );
    assert.equal(manager.getSnapshot().status, 'unknown');
  });

  it('bootstrap with nothing stored is anonymous without any request', async () => {
    const { manager, f } = setup([]);
    await manager.bootstrap();
    assert.equal(manager.getSnapshot().status, 'anonymous');
    assert.equal(f.calls.length, 0);
  });

  it('a rejected (reused / revoked) refresh token ends the session and clears storage', async () => {
    const { manager, persistence } = setup([
      () => json(401, { success: false, message: 'Unauthorized' }),
    ]);
    await manager.signIn({ accessToken: 'a1', refreshToken: 'r1', user: { id: 7, role: 'admin' } });
    assert.equal(await manager.refresh(), false);
    assert.equal(manager.getSnapshot().status, 'anonymous');
    assert.equal(manager.getSnapshot().endedReason, 'expired');
    assert.equal(await persistence.load(), null);
  });

  it('concurrent refreshes send the stored token once (no self-inflicted reuse)', async () => {
    const { manager, sent } = setup([() => json(200, session(2))]);
    await manager.signIn({ accessToken: 'a1', refreshToken: 'r1', user: { id: 7, role: 'admin' } });
    const results = await Promise.all([manager.refresh(), manager.refresh(), manager.refresh()]);
    assert.deepEqual(results, [true, true, true]);
    assert.deepEqual(sent, ['r1']);
  });

  it('detaching (provider unmount) keeps the stored token; sign-out clears it', async () => {
    const { manager, persistence } = setup([]);
    await manager.signIn({ accessToken: 'a1', refreshToken: 'r1', user: { id: 7, role: 'admin' } });
    await manager.end('expired', { keepStored: true });
    assert.equal(manager.getSnapshot().status, 'unknown');
    assert.equal(manager.getAccessToken(), null);
    assert.equal((await persistence.load())?.refreshToken, 'r1');
    await manager.end('signed-out');
    assert.equal(await persistence.load(), null);
  });

  it('cookie transport never persists or sends a token', async () => {
    const persistence = createMemorySessionPersistence();
    const sent: Array<string | undefined> = [];
    const manager = new SessionManager({
      persistence,
      refreshRequest: async (token) => {
        sent.push(token);
        return { accessToken: 'a2', user: { id: 1, role: 'admin' } };
      },
    });
    await manager.signIn({ accessToken: 'a1', user: { id: 1, role: 'admin' } });
    assert.equal(await persistence.load(), null);
    assert.equal(await manager.refresh(), true);
    assert.deepEqual(sent, [undefined]);
  });
});
