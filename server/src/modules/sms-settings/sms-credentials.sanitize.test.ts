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
    assert.equal('api_key_masked' in result, false);
  });

  it('allows null service_type alone (clears / shared account)', () => {
    assert.deepEqual(sanitizeCredentialUpdate({ service_type: null }), {
      service_type: null,
    });
  });

  it('allows blank/whitespace service_type alone (clears to null)', () => {
    assert.deepEqual(sanitizeCredentialUpdate({ service_type: '   ' }), {
      service_type: null,
    });
    assert.deepEqual(sanitizeCredentialUpdate({ service_type: '' }), {
      service_type: null,
    });
  });

  it('rejects missing service_type when setting own api_key with 400', () => {
    assert.throws(
      () => sanitizeCredentialUpdate({ api_key: 'secret-key', sender_id: 'SCHOOL1' }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 400 &&
        /service_type.*required/i.test(err.message),
    );
  });

  it('rejects blank/null service_type when setting own api_key with 400', () => {
    assert.throws(
      () =>
        sanitizeCredentialUpdate({
          api_key: 'secret-key',
          sender_id: 'SCHOOL1',
          service_type: null,
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 400 &&
        /service_type.*required/i.test(err.message),
    );
    assert.throws(
      () =>
        sanitizeCredentialUpdate({
          api_key: 'secret-key',
          sender_id: 'SCHOOL1',
          service_type: '  ',
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 400 &&
        /service_type.*required/i.test(err.message),
    );
  });

  it('allows blank sender_id without own api_key (clears to null)', () => {
    assert.deepEqual(
      sanitizeCredentialUpdate({
        api_url: '',
        sender_id: '',
        service_type: 'onecode',
      }),
      {
        api_url: '',
        sender_id: null,
        service_type: 'onecode',
      },
    );
    assert.deepEqual(sanitizeCredentialUpdate({ sender_id: null }), { sender_id: null });
  });

  it('rejects blank sender_id when setting own api_key with 400', () => {
    assert.throws(
      () =>
        sanitizeCredentialUpdate({
          api_key: 'secret-key',
          sender_id: '',
          service_type: 'onecode',
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

  it('keeps a valid own-account credential save payload', () => {
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
