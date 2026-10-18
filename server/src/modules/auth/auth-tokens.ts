/**
 * Access/refresh token signing and verification.
 *
 * - Every token carries `typ` ('access' | 'refresh'), so a refresh token can never be used as a
 *   bearer token and vice versa, even when both are signed with the same secret.
 * - Refresh tokens are signed with REFRESH_TOKEN_SECRET. When it is unset the server falls back
 *   to JWT_SECRET (as before) and logs a warning once; the `typ` claim still separates the two.
 * - `sch` is the school the token was issued for (null for super_admin). The tenant is always
 *   the one resolved server-side from the request host; `sch` is only compared against it.
 * - Tokens issued before this change have no `typ`. Legacy access tokens stay valid until they
 *   expire (15 min). Legacy refresh tokens ({ id, role, version }) are accepted once, for web
 *   cookies only, and rotated into a tracked session. Remove that path 7 days after rollout.
 */
import crypto from 'crypto';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';
import logger from '@/utils/logger.js';

export const ACCESS_TOKEN_TTL = env.NODE_ENV === 'development' ? '1m' : '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthClient = 'web' | 'native';

export interface AccessClaims {
  typ: 'access';
  id: number;
  role: string;
  sch: number | null;
  username?: string | null;
  email?: string | null;
  login_id?: string | null;
}

export interface RefreshClaims {
  typ: 'refresh';
  id: number;
  role: string;
  version: number;
  sch: number | null;
  jti: string;
  fam: string;
}

/** Pre-rollout refresh token shape. Never issued any more. */
export interface LegacyRefreshClaims {
  typ: 'legacy';
  id: number;
  role: string;
  version: number;
}

let warned = false;

/** Resolved on each call so tests (and a hot env change) see the current value. */
export function refreshTokenSecret(): string {
  const dedicated = process.env.REFRESH_TOKEN_SECRET;
  if (dedicated && dedicated !== env.JWT_SECRET) return dedicated;
  if (!warned) {
    warned = true;
    logger.warn(
      dedicated
        ? 'REFRESH_TOKEN_SECRET equals JWT_SECRET; set a distinct value. Token types still separate access and refresh tokens.'
        : 'REFRESH_TOKEN_SECRET is not set; refresh tokens fall back to JWT_SECRET. Token types still separate access and refresh tokens, but set a distinct secret.',
    );
  }
  return env.JWT_SECRET;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function signAccessToken(claims: Omit<AccessClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: 'access' }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(claims: Omit<RefreshClaims, 'typ' | 'jti'>, jti: string) {
  return jwt.sign({ ...claims, typ: 'refresh' }, refreshTokenSecret(), {
    expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    jwtid: jti,
  });
}

/**
 * Verify a bearer token. Returns null for anything that is not an access token: bad signature,
 * expired (throws TokenExpiredError so callers can say "Token expired"), refresh tokens, or
 * pre-rollout refresh tokens (which carry `version`).
 */
export function verifyAccessToken(token: string): AccessClaims | null {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (!isRecord(decoded) || typeof decoded.id !== 'number' || typeof decoded.role !== 'string') {
    return null;
  }
  if (decoded.typ === 'access') {
    return decoded as unknown as AccessClaims;
  }
  // Legacy access tokens (no typ) remain valid until they expire; legacy refresh tokens do not.
  if (decoded.typ === undefined && !('version' in decoded)) {
    return { ...(decoded as any), typ: 'access', sch: null } as AccessClaims;
  }
  return null;
}

/** Role from a valid access token, or undefined. Never throws. */
export function accessTokenRole(token: string | undefined): string | undefined {
  if (!token) return undefined;
  try {
    return verifyAccessToken(token)?.role;
  } catch {
    return undefined;
  }
}

/** Verify a refresh token. Never throws; null means "unauthorized". */
export function verifyRefreshToken(token: string): RefreshClaims | LegacyRefreshClaims | null {
  const decode = (secret: string) => {
    try {
      return jwt.verify(token, secret);
    } catch {
      return null;
    }
  };
  const secret = refreshTokenSecret();
  let decoded = decode(secret);
  // Before REFRESH_TOKEN_SECRET is set everything was signed with JWT_SECRET: accept only the
  // legacy refresh shape from it, so turning the secret on does not log every web user out.
  let viaLegacySecret = false;
  if (!decoded && secret !== env.JWT_SECRET) {
    decoded = decode(env.JWT_SECRET);
    viaLegacySecret = true;
  }
  if (!isRecord(decoded) || typeof decoded.id !== 'number' || typeof decoded.role !== 'string') {
    return null;
  }
  if (
    !viaLegacySecret &&
    decoded.typ === 'refresh' &&
    typeof decoded.jti === 'string' &&
    typeof decoded.fam === 'string' &&
    typeof decoded.version === 'number'
  ) {
    return decoded as unknown as RefreshClaims;
  }
  if (decoded.typ === undefined && typeof decoded.version === 'number') {
    return { typ: 'legacy', id: decoded.id, role: decoded.role, version: decoded.version };
  }
  return null;
}

export class UnsupportedClientError extends Error {}

/**
 * Which token transport the caller gets. Native apps send `X-Client: native` and receive the
 * refresh token in the JSON body. Browsers always attach Sec-Fetch-* headers (forbidden
 * headers, page JS cannot remove them), so a browser claiming to be native is refused: a web
 * page, even with XSS, can never pull a refresh token into JavaScript. CORS does not allow the
 * X-Client header either, so cross-origin pages cannot send it at all.
 */
export function authClientOf(req: Request): AuthClient {
  const raw = req.headers['x-client'];
  if (raw === undefined) return 'web';
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  if (value.trim().toLowerCase() !== 'native') throw new UnsupportedClientError(value);
  if (req.headers['sec-fetch-site'] !== undefined || req.headers['sec-fetch-mode'] !== undefined) {
    throw new UnsupportedClientError('native header from a browser');
  }
  return 'native';
}

export const newTokenId = () => crypto.randomUUID();
