import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient, buildUrl, type AuthHooks } from './client';
import { ApiError } from './errors';
import { unwrapEnvelope } from './envelope';
import { SessionManager } from './session';
import { createMemorySessionPersistence } from './token-store';

type Call = { url: string; init: RequestInit };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as typeof fetch;
  return { fn, calls };
}

const header = (call: Call, name: string) =>
  (call.init.headers as Record<string, string> | undefined)?.[name];

describe('envelopes (verified server shapes)', () => {
  it('unwraps the legacy Express ApiResponse', () => {
    const r = unwrapEnvelope(200, {
      statusCode: 200,
      data: { id: 1 },
      message: 'ok',
      success: true,
    });
    assert.deepEqual(r, { data: { id: 1 }, message: 'ok', enveloped: true });
  });
  it('unwraps the Nest ResponseInterceptor shape', () => {
    const r = unwrapEnvelope(200, { success: true, data: [1, 2] });
    assert.deepEqual(r, { data: [1, 2], message: undefined, enveloped: true });
  });
  it('treats success:false on a 2xx as an error', () => {
    const r = unwrapEnvelope(200, { success: false, message: 'nope' });
    if (!('error' in r)) return assert.fail('expected an error');
    assert.equal(r.error.status, 400);
    assert.equal(r.error.message, 'nope');
  });
});

describe('error normalization', () => {
  const client = (status: number, body: unknown, contentType = 'application/json') =>
    createApiClient({
      baseUrl: 'https://api.test',
      fetch: fakeFetch(
        () =>
          new Response(typeof body === 'string' ? body : JSON.stringify(body), {
            status,
            headers: { 'content-type': contentType },
          }),
      ).fn,
    });

  it('legacy/Nest error body: message + errors', async () => {
    await assert.rejects(
      client(400, {
        success: false,
        message: 'title is required',
        errors: ['title'],
        error: 'title is required',
      }).get('/api/x'),
      (e: ApiError) =>
        e.kind === 'http' &&
        e.status === 400 &&
        e.message === 'title is required' &&
        e.details.length === 1,
    );
  });
  it('tenant middleware body without success flag', async () => {
    await assert.rejects(
      client(404, { message: 'School not found' }).get('/api/x'),
      (e: ApiError) => e.message === 'School not found',
    );
  });
  it('402 keeps subscription data', async () => {
    await assert.rejects(
      client(402, { success: false, message: 'locked', data: { is_locked: true }, errors: [] }).get(
        '/api/x',
      ),
      (e: ApiError) =>
        e.isSubscriptionLocked && (e.data as { is_locked: boolean }).is_locked === true,
    );
  });
  it('HTML error page falls back to a status message', async () => {
    await assert.rejects(
      client(502, '<html>Bad gateway</html>', 'text/html').get('/api/x'),
      (e: ApiError) => e.status === 502 && /server/.test(e.message),
    );
  });
  it('non-JSON 200 is a parse error', async () => {
    await assert.rejects(
      client(200, '<html></html>', 'text/html').get('/api/x'),
      (e: ApiError) => e.kind === 'parse',
    );
  });
});

describe('request building', () => {
  it('builds URLs with query params and rejects relative paths', () => {
    assert.equal(
      buildUrl('', '/api/marks', { year: 2026, q: 'a b', skip: undefined }),
      '/api/marks?year=2026&q=a%20b',
    );
    assert.throws(() => buildUrl('', 'api/x'), ApiError);
  });
  it('sends JSON, bearer token and default headers', async () => {
    const f = fakeFetch(() => json(200, { success: true, data: null }));
    const api = createApiClient({
      baseUrl: 'https://api.test',
      fetch: f.fn,
      credentials: 'include',
      defaultHeaders: () => ({ 'x-tenant-host': 'demo.localhost' }),
      auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
    });
    await api.post('/api/things', { a: 1 });
    const call = f.calls[0]!;
    assert.equal(call.url, 'https://api.test/api/things');
    assert.equal(call.init.credentials, 'include');
    assert.equal(header(call, 'Authorization'), 'Bearer tok');
    assert.equal(header(call, 'Content-Type'), 'application/json');
    assert.equal(header(call, 'x-tenant-host'), 'demo.localhost');
    assert.equal(call.init.body, '{"a":1}');
  });
  it('auth:false omits the bearer token', async () => {
    const f = fakeFetch(() => json(200, { success: true, data: null }));
    const api = createApiClient({
      baseUrl: '',
      fetch: f.fn,
      auth: { getAccessToken: () => 'tok', refresh: async () => false, onSessionExpired: () => {} },
    });
    await api.get('/api/school', { auth: false });
    assert.equal(header(f.calls[0]!, 'Authorization'), undefined);
  });
});

describe('cancellation and transport errors', () => {
  const hanging = fakeFetch(
    (call) =>
      new Promise<Response>((_, reject) => {
        call.init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  it('caller abort -> aborted', async () => {
    const api = createApiClient({ baseUrl: '', fetch: hanging.fn });
    const controller = new AbortController();
    const p = api.get('/api/x', { signal: controller.signal });
    controller.abort();
    await assert.rejects(p, (e: ApiError) => e.kind === 'aborted');
  });
  it('timeout -> timeout', async () => {
    const api = createApiClient({ baseUrl: '', fetch: hanging.fn, timeoutMs: 20 });
    await assert.rejects(api.get('/api/x'), (e: ApiError) => e.kind === 'timeout' && e.isTransport);
  });
  it('fetch rejection -> network', async () => {
    const api = createApiClient({
      baseUrl: '',
      fetch: fakeFetch(() => {
        throw new TypeError('Failed to fetch');
      }).fn,
    });
    await assert.rejects(api.get('/api/x'), (e: ApiError) => e.kind === 'network');
  });
});

describe('401 handling with SessionManager', () => {
  function setup(refreshResponses: Array<() => Response>) {
    let refreshCalls = 0;
    let token = 'old';
    const f = fakeFetch((call) => {
      if (call.url.endsWith('/api/auth/sessions/refresh')) {
        refreshCalls += 1;
        const next = refreshResponses.shift();
        if (!next) throw new Error('unexpected refresh');
        return next();
      }
      const auth = header(call, 'Authorization');
      return auth === `Bearer ${token}` && token === 'new'
        ? json(200, { success: true, data: { ok: true } })
        : json(401, { success: false, message: 'Unauthorized' });
    });
    const ref: { session?: SessionManager } = {};
    const api = createApiClient({
      baseUrl: '',
      fetch: f.fn,
      auth: {
        getAccessToken: () => ref.session?.getAccessToken() ?? null,
        refresh: () => ref.session?.refresh() ?? Promise.resolve(false),
        onSessionExpired: (e) => ref.session?.onSessionExpired(e),
      } satisfies AuthHooks,
    });
    const session = new SessionManager({
      persistence: createMemorySessionPersistence(),
      refreshRequest: () =>
        api.post('/api/auth/sessions/refresh', {}, { auth: false, retryOn401: false }),
    });
    ref.session = session;
    session.setSession({ accessToken: 'old', user: { id: 1, role: 'admin' } });
    const setToken = (t: string) => {
      token = t;
    };
    return { api, session, f, refreshCalls: () => refreshCalls, setToken };
  }

  it('concurrent 401s share one refresh, then retry with the new token', async () => {
    const ctx = setup([
      () =>
        json(200, { success: true, data: { accessToken: 'new', user: { id: 1, role: 'admin' } } }),
    ]);
    ctx.setToken('new');
    const results = await Promise.all([
      ctx.api.get('/api/a'),
      ctx.api.get('/api/b'),
      ctx.api.get('/api/c'),
    ]);
    assert.equal(ctx.refreshCalls(), 1);
    assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
    assert.equal(ctx.session.getAccessToken(), 'new');
    assert.equal(ctx.session.getSnapshot().status, 'authenticated');
  });

  it('refresh 401 ends the session (expired) and rejects the original request', async () => {
    const ctx = setup([() => json(401, { success: false })]);
    await assert.rejects(ctx.api.get('/api/a'), (e: ApiError) => e.isUnauthorized);
    assert.equal(ctx.session.getSnapshot().status, 'anonymous');
    assert.equal(ctx.session.getSnapshot().endedReason, 'expired');
    assert.equal(ctx.session.getAccessToken(), null);
  });

  it('refresh 503 keeps the session', async () => {
    const ctx = setup([() => json(503, { success: false, message: 'down' })]);
    await assert.rejects(ctx.api.get('/api/a'), (e: ApiError) => e.status === 503);
    assert.equal(ctx.session.getSnapshot().status, 'authenticated');
    assert.equal(ctx.session.getAccessToken(), 'old');
  });

  it('refresh network failure keeps the session', async () => {
    const ctx = setup([
      () => {
        throw new TypeError('offline');
      },
    ]);
    await assert.rejects(ctx.api.get('/api/a'), (e: ApiError) => e.kind === 'network');
    assert.equal(ctx.session.getSnapshot().status, 'authenticated');
  });

  it('402 is never treated as an auth failure', async () => {
    const f = fakeFetch(() =>
      json(402, { success: false, message: 'locked', data: { is_locked: true } }),
    );
    let expired = 0;
    const api = createApiClient({
      baseUrl: '',
      fetch: f.fn,
      auth: {
        getAccessToken: () => 't',
        refresh: async () => true,
        onSessionExpired: () => {
          expired += 1;
        },
      },
    });
    await assert.rejects(api.get('/api/a'), (e: ApiError) => e.isSubscriptionLocked);
    assert.equal(expired, 0);
    assert.equal(f.calls.length, 1);
  });
});

describe('SessionManager.bootstrap', () => {
  it('no backend (404) -> anonymous; offline -> stays unknown', async () => {
    const notFound = new SessionManager({
      persistence: createMemorySessionPersistence(),
      refreshRequest: async () => {
        throw new ApiError({ kind: 'http', status: 404, message: 'Not found.' });
      },
    });
    await notFound.bootstrap();
    assert.equal(notFound.getSnapshot().status, 'anonymous');

    const offline = new SessionManager({
      persistence: createMemorySessionPersistence(),
      refreshRequest: async () => {
        throw new ApiError({ kind: 'network', message: 'offline' });
      },
    });
    await offline.bootstrap();
    assert.equal(offline.getSnapshot().status, 'unknown');
  });
});
