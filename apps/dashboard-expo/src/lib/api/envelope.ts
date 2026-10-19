/**
 * Success envelopes verified in server/ (main @ 13003bf4):
 * - Legacy Express (`server/src/utils/ApiResponse.ts`): `{ statusCode, data, message, success }`
 * - Nest (`server/src/nest/common/response.interceptor.ts`): `{ success: true, data }`
 * - Edge auth proxy login/refresh (`workers/shared/auth-proxy.js`): `{ success: true, data: { accessToken, user } }`
 *
 * Both stacks put the payload in `data`. A body with `success: false` is an error even with a
 * 2xx status (the existing dashboard treats login responses the same way).
 */
import { errorFromResponseBody, type ApiError } from './errors';

export interface Unwrapped<T> {
  data: T;
  message: string | undefined;
  /** False when the body had no `success` flag (not one of the known envelopes). */
  enveloped: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function unwrapEnvelope<T>(
  status: number,
  body: unknown,
  path?: string,
): Unwrapped<T> | { error: ApiError } {
  if (isRecord(body) && typeof body.success === 'boolean') {
    if (!body.success) {
      return { error: errorFromResponseBody(status >= 400 ? status : 400, body, path) };
    }
    return {
      data: body.data as T,
      message: typeof body.message === 'string' ? body.message : undefined,
      enveloped: true,
    };
  }
  return { data: body as T, message: undefined, enveloped: false };
}
