import { ApiError } from '../../utils/ApiError.js';

export type SmsCredentialUpdate = {
  api_key?: string | null;
  api_url?: string;
  sender_id?: string | null;
  service_type?: string | null;
};

/**
 * Whitelist writable credential fields from a request body and validate blanks.
 * Display-only fields (estimated_sms, balance_message, api_key_masked, …) are dropped.
 * api_key === null means switch to shared account; omitted api_key leaves the stored key.
 *
 * service_type is not globally required. Null/blank clears it (nullable column) unless the
 * same body is setting an own-account api_key string — then service_type is required.
 * Blank sender_id is allowed (clears to null) unless setting an own-account api_key string.
 */
export function sanitizeCredentialUpdate(
  raw: Record<string, unknown> | null | undefined,
): SmsCredentialUpdate {
  const body = raw && typeof raw === 'object' ? raw : {};
  const result: SmsCredentialUpdate = {};

  const settingOwnKey =
    'api_key' in body && typeof body.api_key === 'string' && body.api_key.trim() !== '';

  if ('service_type' in body && body.service_type !== undefined) {
    if (
      body.service_type === null ||
      (typeof body.service_type === 'string' && body.service_type.trim() === '')
    ) {
      if (settingOwnKey) {
        throw new ApiError(400, 'service_type is required when setting own provider key', [
          { field: 'service_type' },
        ]);
      }
      result.service_type = null;
    } else if (typeof body.service_type !== 'string') {
      throw new ApiError(400, 'service_type must be a string', [{ field: 'service_type' }]);
    } else {
      result.service_type = body.service_type.trim();
    }
  } else if (settingOwnKey) {
    throw new ApiError(400, 'service_type is required when setting own provider key', [
      { field: 'service_type' },
    ]);
  }

  if ('api_url' in body && body.api_url !== undefined) {
    if (body.api_url !== null && typeof body.api_url !== 'string') {
      throw new ApiError(400, 'api_url must be a string', [{ field: 'api_url' }]);
    }
    result.api_url = body.api_url == null ? '' : String(body.api_url).trim();
  }

  if ('sender_id' in body && body.sender_id !== undefined) {
    if (body.sender_id !== null && typeof body.sender_id !== 'string') {
      throw new ApiError(400, 'sender_id must be a string', [{ field: 'sender_id' }]);
    }
    const sender = body.sender_id == null ? '' : String(body.sender_id).trim();
    if (sender === '') {
      if (settingOwnKey) {
        throw new ApiError(400, 'Sender ID cannot be blank', [{ field: 'sender_id' }]);
      }
      result.sender_id = null;
    } else {
      result.sender_id = sender;
    }
  }

  if ('api_key' in body) {
    if (body.api_key === null) {
      result.api_key = null;
    } else if (typeof body.api_key === 'string') {
      const key = body.api_key.trim();
      if (key === '') {
        throw new ApiError(400, 'API key cannot be blank', [{ field: 'api_key' }]);
      }
      result.api_key = key;
    } else if (body.api_key !== undefined) {
      throw new ApiError(400, 'api_key must be a string or null', [{ field: 'api_key' }]);
    }
  }

  return result;
}
