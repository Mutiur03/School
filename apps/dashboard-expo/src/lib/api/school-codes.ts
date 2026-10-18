/**
 * POST /api/school-code-lookups (server/src/nest/modules/school-codes). Public and pre-tenant:
 * the app does not know its school yet. Returns the school's public info, the host to talk to
 * and an optional role hint. Unknown, revoked, expired and malformed codes all return the same
 * 404, and the endpoint is rate limited (429).
 *
 * The client never sends or stores a school id: the tenant is whatever the server resolves from
 * `tenant.host`.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export type RoleHint = 'admin' | 'teacher' | 'student';

export interface SchoolCodeLookup {
  school: { name: string; shortName: string | null; logo: string | null };
  tenant: { host: string; apiBaseUrl: string };
  roleHint: RoleHint | null;
}

export const SCHOOL_CODE_PATHS = { lookup: '/api/school-code-lookups' } as const;

/** Same alphabet as the server (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "abc 7k4q" / "ABC7K4Q" / "ABC-7K4Q" -> "ABC-7K4Q"; null when it cannot be a code. */
export function normalizeSchoolCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== 7) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

/** Live formatting while typing: uppercase, alphabet only, dash after 3 chars, max 8. */
export function formatCodeInput(input: string): string {
  const raw = [...input.toUpperCase()].filter((ch) => CODE_ALPHABET.includes(ch)).join('');
  const clipped = raw.slice(0, 7);
  return clipped.length > 3 ? `${clipped.slice(0, 3)}-${clipped.slice(3)}` : clipped;
}

/**
 * QR payloads: the dashboard encodes the bare code. Also accept a URL carrying ?code=... so a
 * future deep link keeps working.
 */
export function parseScannedCode(data: string): string | null {
  const direct = normalizeSchoolCode(data.trim());
  if (direct) return direct;
  const match = /[?&]code=([^&#\s]+)/i.exec(data);
  if (!match?.[1]) return null;
  try {
    return normalizeSchoolCode(decodeURIComponent(match[1]));
  } catch {
    return null; // malformed %-escape
  }
}

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Reject a response that does not look like ours, or that points the app at a different host
 * than the tenant it names (outside local dev the API must be https on exactly that host).
 */
export function validateLookup(value: unknown, opts: { allowHttp: boolean }): SchoolCodeLookup {
  const fail = () =>
    new ApiError({ kind: 'parse', message: 'Unexpected school code response.', path: 'lookup' });
  if (typeof value !== 'object' || value === null) throw fail();
  const v = value as Record<string, any>;
  const host = typeof v.tenant?.host === 'string' ? v.tenant.host.toLowerCase() : '';
  const name = typeof v.school?.name === 'string' ? v.school.name.trim() : '';
  if (!name || !HOST_RE.test(host)) throw fail();
  let api: URL;
  try {
    api = new URL(String(v.tenant.apiBaseUrl));
  } catch {
    throw fail();
  }
  const protocolOk = api.protocol === 'https:' || (opts.allowHttp && api.protocol === 'http:');
  if (!protocolOk || api.hostname !== host || api.pathname.replace(/\/$/, '') !== '') throw fail();
  const roleHint = ['admin', 'teacher', 'student'].includes(v.roleHint) ? v.roleHint : null;
  return {
    school: {
      name,
      shortName: typeof v.school.shortName === 'string' ? v.school.shortName : null,
      logo: typeof v.school.logo === 'string' ? v.school.logo : null,
    },
    tenant: { host, apiBaseUrl: api.origin },
    roleHint,
  };
}

export function createSchoolCodeApi(client: ApiClient, opts: { allowHttp: boolean }) {
  return {
    /** Throws ApiError 404 for any bad code, 429 when rate limited. */
    async lookup(code: string, signal?: AbortSignal): Promise<SchoolCodeLookup> {
      const normalized = normalizeSchoolCode(code);
      if (!normalized) {
        throw new ApiError({
          kind: 'http',
          status: 404,
          message: 'School code not found',
          path: SCHOOL_CODE_PATHS.lookup,
        });
      }
      const data = await client.post<unknown>(
        SCHOOL_CODE_PATHS.lookup,
        { code: normalized },
        { auth: false, retryOn401: false, signal },
      );
      return validateLookup(data, opts);
    },
  };
}

export type SchoolCodeApi = ReturnType<typeof createSchoolCodeApi>;
