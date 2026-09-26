import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../../utils/ApiError.js';
import { sanitizeCredentialUpdate } from './sms-credentials.sanitize.js';

describe('sanitizeCredentialUpdate', () => {
  it('strips display-only fields that previously caused Prisma 500s', () => {
    const result = sanitizeCredentialUpdate({
      api_url: 'https://sms.example/api',
      sender_id: 'SCHOOL1',
      service_type: 'onecode',
      estimated_sms: null,
      balance_message: null,
      api_key_masked: '****1234',
    });
    assert.deepEqual(result, {
      api_url: 'https://sms.example/api',
      sender_id: 'SCHOOL1',
      service_type: 'onecode',
    });
    assert.equal('estimated_sms' in result, false);
    assert.equal('balance_message' in result, false);
  });

  it('rejects blank sender_id with 400', () => {
    assert.throws(
      () =>
        sanitizeCredentialUpdate({
          api_url: '',
          sender_id: '',
          service_type: 'onecode',
          estimated_sms: null,
          balance_message: null,
        }),
      (err: unknown) =>
        err instanceof ApiError && err.statusCode === 400 && /Sender ID/i.test(err.message),
    );
  });

  it('rejects blank api_key string with 400', () => {
    assert.throws(
      () => sanitizeCredentialUpdate({ api_key: '   ' }),
      (err: unknown) =>
        err instanceof ApiError && err.statusCode === 400 && /API key/i.test(err.message),
    );
  });

  it('allows api_key null for shared-account switch', () => {
    assert.deepEqual(sanitizeCredentialUpdate({ api_key: null }), { api_key: null });
  });

  it('keeps a valid credential save payload', () => {
    assert.deepEqual(
      sanitizeCredentialUpdate({
        api_url: 'https://sms.example/api',
        sender_id: 'SCHOOL1',
        service_type: 'onecode',
        api_key: 'secret-key',
      }),
      {
        api_url: 'https://sms.example/api',
        sender_id: 'SCHOOL1',
        service_type: 'onecode',
        api_key: 'secret-key',
      },
    );
  });
});
