/**
 * POST /api/school-code-lookups (server/src/nest/modules/school-codes). Public and pre-tenant:
 * the app does not know its school yet. Returns the school's public info, the host to talk to
 * and an optional role hint. Unknown, revoked, expired and malformed codes all return the same
 * 404, and the endpoint is rate limited (429).
 *
 * The client never sends or stores a school id: the tenant is whatever the server resolves from
 * `tenant.host`.
 *
 * The server's platform access code (env PLATFORM_ACCESS_CODE, same format) answers
 * `{ target: 'platform' }` instead: the app then opens super-admin sign-in on its own build-time
 * super-admin URL. Nothing in that answer is trusted beyond the target: no host, no school, no
 * role. It only opens a sign-in screen. A server without the feature answers the same 404 as any
 * unknown code.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export type RoleHint = 'admin' | 'teacher' | 'student';

export interface SchoolCodeLookup {
  school: { name: string; shortName: string | null; logo: string | null };
  tenant: { host: string; apiBaseUrl: string };
  roleHint: RoleHint | null;
}

/** The platform access code: open super-admin sign-in. Carries nothing else. */
export interface PlatformCodeLookup {
  target: 'platform';
}

export type CodeLookupResult = SchoolCodeLookup | PlatformCodeLookup;

export const isPlatformLookup = (r: CodeLookupResult): r is PlatformCodeLookup =>
  'target' in r && r.target === 'platform';

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

/** Platform answer (exactly `target: 'platform'`), else a validated school lookup. */
export function parseLookupResponse(
  value: unknown,
  opts: { allowHttp: boolean },
): CodeLookupResult {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as { target?: unknown }).target === 'platform'
  ) {
    return { target: 'platform' };
  }
  return validateLookup(value, opts);
}

export function createSchoolCodeApi(client: ApiClient, opts: { allowHttp: boolean }) {
  return {
    /** Throws ApiError 404 for any bad code, 429 when rate limited. */
    async lookup(code: string, signal?: AbortSignal): Promise<CodeLookupResult> {
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
      return parseLookupResponse(data, opts);
    },
  };
}

export type SchoolCodeApi = ReturnType<typeof createSchoolCodeApi>;

/**
 * Admin management of this school's codes (Nest, `Auth('admin')`, school from host + token):
 *   GET    /api/school-codes            every code with its status
 *   POST   /api/school-codes { role_hint? }   a new code
 *   DELETE /api/school-codes/:id        revoke (kept, shown as revoked)
 */
export interface SchoolCode {
  id: number;
  code: string;
  role_hint: RoleHint | null;
  created_at: string;
  expires_at: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export const SCHOOL_CODE_ADMIN_PATHS = {
  list: '/api/school-codes',
  one: (id: number) => `/api/school-codes/${id}`,
} as const;

const ROLE_HINTS: readonly RoleHint[] = ['admin', 'teacher', 'student'];
const CODE_STATUSES: readonly SchoolCode['status'][] = ['active', 'revoked', 'expired'];

export function parseSchoolCode(v: unknown): SchoolCode | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'number' || typeof r.code !== 'string') return null;
  return {
    id: r.id,
    code: r.code,
    role_hint: ROLE_HINTS.find((h) => h === r.role_hint) ?? null,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    expires_at: typeof r.expires_at === 'string' ? r.expires_at : null,
    status: CODE_STATUSES.find((s) => s === r.status) ?? 'expired',
  };
}

export function createSchoolCodesAdminApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal): Promise<SchoolCode[]> {
      const data = await client.get<unknown>(SCHOOL_CODE_ADMIN_PATHS.list, { signal });
      if (!Array.isArray(data)) {
        throw new ApiError({
          kind: 'parse',
          message: 'Unexpected school codes response.',
          path: SCHOOL_CODE_ADMIN_PATHS.list,
        });
      }
      return data.map(parseSchoolCode).filter((c): c is SchoolCode => c !== null);
    },
    async create(roleHint: RoleHint | null): Promise<SchoolCode | null> {
      const data = await client.post<unknown>(
        SCHOOL_CODE_ADMIN_PATHS.list,
        roleHint ? { role_hint: roleHint } : {},
      );
      return parseSchoolCode(data);
    },
    async revoke(id: number): Promise<void> {
      await client.delete<unknown>(SCHOOL_CODE_ADMIN_PATHS.one(id));
    },
  };
}

export type SchoolCodesAdminApi = ReturnType<typeof createSchoolCodesAdminApi>;
