import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/school';
process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.NODE_ENV = 'test';
process.env.R2_ACCOUNT_ID = 'local';
process.env.R2_ACCESS_KEY_ID = 'minioadmin';
process.env.R2_SECRET_ACCESS_KEY = 'minioadmin';
process.env.R2_BUCKET_NAME = 'school-local';
process.env.R2_ENDPOINT = 'http://127.0.0.1:9000';

const { getUploadUrl, resolveR2Endpoint } = await import('./r2.js');

describe('resolveR2Endpoint', () => {
  it('uses R2_ENDPOINT when set', () => {
    assert.equal(resolveR2Endpoint('local', 'http://127.0.0.1:9000'), 'http://127.0.0.1:9000');
  });

  it('keeps the Cloudflare host when R2_ENDPOINT is unset', () => {
    assert.equal(resolveR2Endpoint('abc123', undefined), 'https://abc123.r2.cloudflarestorage.com');
  });
});

describe('presigned upload URL', () => {
  it('targets the MinIO host and path, not Cloudflare R2', async () => {
    const url = new URL(await getUploadUrl('schools/logos/test.png', 'image/png'));
    assert.equal(url.origin, 'http://127.0.0.1:9000');
    assert.equal(url.pathname, '/school-local/schools/logos/test.png');
    assert.equal(url.hostname.endsWith('r2.cloudflarestorage.com'), false);
  });
});
