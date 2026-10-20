import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './index.js';

const objects = {
  'staging/latest/abc123/android.json': { body: '{"id":"u1"}' },
  'staging/updates/u1/files/h1': {
    body: 'js',
    httpMetadata: { contentType: 'application/javascript' },
  },
  'staging/logs/2026-10-20-publish-u1.json': { body: '{"event":"publish"}' },
};
const env = { UPDATES: { get: async (key) => objects[key] ?? null } };
const get = (path, headers) =>
  worker.fetch(new Request(`https://updates.test${path}`, { headers }), env);

const valid = {
  'expo-protocol-version': '1',
  'expo-platform': 'android',
  'expo-runtime-version': 'abc123',
  'expo-channel-name': 'staging',
};

test('returns the channel manifest with protocol headers', async () => {
  const res = await get('/manifest', valid);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('expo-protocol-version'), '1');
  assert.equal(res.headers.get('cache-control'), 'private, max-age=0');
  assert.equal(await res.text(), '{"id":"u1"}');
});

test('channels are isolated: production never sees a staging update', async () => {
  const res = await get('/manifest', { ...valid, 'expo-channel-name': 'production' });
  assert.equal(res.status, 404);
});

test('rejects path traversal in headers', async () => {
  const res = await get('/manifest', { ...valid, 'expo-channel-name': '../x' });
  assert.equal(res.status, 400);
});

test('serves update files immutably with stored content type', async () => {
  const res = await get('/staging/updates/u1/files/h1');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/javascript');
  assert.match(res.headers.get('cache-control'), /immutable/);
});

test('logs and manifests are never served as files', async () => {
  assert.equal((await get('/staging/logs/2026-10-20-publish-u1.json')).status, 404);
  assert.equal((await get('/staging/latest/abc123/android.json')).status, 404);
});
