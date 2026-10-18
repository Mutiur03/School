// node --test workers/shared/auth-proxy.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { isNativeClientRequest, tryHandleAuthSession } from './auth-proxy.js';

const req = (path, headers = {}, body = '{}') =>
  new Request(`https://alpha-dashboard.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });

const run = async (request) => {
  let forwarded = null;
  const res = await tryHandleAuthSession({
    request,
    pathname: new URL(request.url).pathname,
    headers: new Headers(request.headers),
    cookies: {},
    origin: null,
    corsHeaders: new Headers(),
    forward: async (r, h) => {
      forwarded = h;
      return new Response(
        JSON.stringify({ success: true, data: { accessToken: 'a', refreshToken: 'r', user: {} } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  return { res, forwarded };
};

test('isNativeClientRequest', () => {
  assert.equal(isNativeClientRequest(req('/x', { 'x-client': 'native' })), true);
  assert.equal(isNativeClientRequest(req('/x', { 'x-client': 'Native ' })), true);
  assert.equal(isNativeClientRequest(req('/x')), false);
  assert.equal(
    isNativeClientRequest(req('/x', { 'x-client': 'native', 'sec-fetch-mode': 'cors' })),
    false,
  );
  assert.equal(
    isNativeClientRequest(req('/x', { 'x-client': 'native', 'sec-fetch-site': 'same-origin' })),
    false,
  );
});

test('native login/refresh/logout pass through untouched (null = plain proxy)', async () => {
  for (const path of [
    '/api/auth/admin/sessions',
    '/api/auth/sessions/refresh',
    '/api/auth/sessions',
  ]) {
    const { res, forwarded } = await run(req(path, { 'x-client': 'native' }));
    assert.equal(res, null, path);
    assert.equal(forwarded, null, path);
  }
});

test('web login still strips the refresh token from the body into a cookie', async () => {
  const { res } = await run(req('/api/auth/admin/sessions'));
  const body = await res.json();
  assert.deepEqual(Object.keys(body.data).sort(), ['accessToken', 'user']);
  assert.match(res.headers.get('set-cookie'), /refresh_token=r/);
});

test('browser pretending to be native gets the web cookie flow', async () => {
  const { res } = await run(
    req('/api/auth/admin/sessions', { 'x-client': 'native', 'sec-fetch-mode': 'cors' }),
  );
  const body = await res.json();
  assert.equal(body.data.refreshToken, undefined);
});
