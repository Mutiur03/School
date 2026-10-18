import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';
import {
  accessTokenRole,
  authClientOf,
  refreshTokenSecret,
  signAccessToken,
  signRefreshToken,
  UnsupportedClientError,
  verifyAccessToken,
  verifyRefreshToken,
} from './auth-tokens.js';

// Pure JWT logic: no DB, no Redis (runs in CI).
const ORIGINAL = process.env.REFRESH_TOKEN_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.REFRESH_TOKEN_SECRET;
  else process.env.REFRESH_TOKEN_SECRET = ORIGINAL;
});

const refreshClaims = { id: 7, role: 'admin', version: 0, sch: 3, fam: 'fam-1' };

describe.each([
  ['REFRESH_TOKEN_SECRET unset (fallback to JWT_SECRET)', undefined],
  ['REFRESH_TOKEN_SECRET set', 'a-separate-refresh-secret-for-tests'],
])('token type separation, %s', (_name, secret) => {
  beforeEach(() => {
    if (secret === undefined) delete process.env.REFRESH_TOKEN_SECRET;
    else process.env.REFRESH_TOKEN_SECRET = secret;
  });

  it('access token verifies as access, never as refresh', () => {
    const access = signAccessToken({ id: 7, role: 'admin', sch: 3 });
    expect(verifyAccessToken(access)).toMatchObject({
      typ: 'access',
      id: 7,
      role: 'admin',
      sch: 3,
    });
    expect(verifyRefreshToken(access)).toBeNull();
  });

  it('refresh token verifies as refresh, never as access', () => {
    const refresh = signRefreshToken(refreshClaims, 'jti-1');
    expect(verifyRefreshToken(refresh)).toMatchObject({ typ: 'refresh', jti: 'jti-1', sch: 3 });
    // When both use JWT_SECRET the signature passes; the typ claim must still reject it.
    if (secret === undefined) expect(verifyAccessToken(refresh)).toBeNull();
    else expect(() => verifyAccessToken(refresh)).toThrow();
    expect(accessTokenRole(refresh)).toBeUndefined();
  });

  it('pre-rollout refresh token ({id, role, version}) is legacy refresh, not access', () => {
    const legacy = jwt.sign({ id: 7, role: 'admin', version: 0 }, env.JWT_SECRET);
    expect(verifyAccessToken(legacy)).toBeNull();
    expect(verifyRefreshToken(legacy)).toEqual({ typ: 'legacy', id: 7, role: 'admin', version: 0 });
  });

  it('pre-rollout access token stays valid as access, never as refresh', () => {
    const legacyAccess = jwt.sign({ id: 7, role: 'admin' }, env.JWT_SECRET);
    expect(verifyAccessToken(legacyAccess)).toMatchObject({ typ: 'access', sch: null });
    expect(verifyRefreshToken(legacyAccess)).toBeNull();
  });
});

describe('refresh secret', () => {
  it('falls back to JWT_SECRET when unset or equal', () => {
    delete process.env.REFRESH_TOKEN_SECRET;
    expect(refreshTokenSecret()).toBe(env.JWT_SECRET);
    process.env.REFRESH_TOKEN_SECRET = env.JWT_SECRET;
    expect(refreshTokenSecret()).toBe(env.JWT_SECRET);
  });

  it('a typed refresh token signed with JWT_SECRET is rejected once a separate secret is set', () => {
    delete process.env.REFRESH_TOKEN_SECRET;
    const old = signRefreshToken(refreshClaims, 'jti-2');
    process.env.REFRESH_TOKEN_SECRET = 'a-separate-refresh-secret-for-tests';
    expect(verifyRefreshToken(old)).toBeNull();
  });

  it('rejects tampered or foreign-signed tokens', () => {
    expect(verifyRefreshToken('not-a-jwt')).toBeNull();
    const foreign = jwt.sign({ ...refreshClaims, typ: 'refresh', jti: 'x' }, 'someone-else');
    expect(verifyRefreshToken(foreign)).toBeNull();
    expect(() => verifyAccessToken(jwt.sign({ id: 1, role: 'admin' }, 'someone-else'))).toThrow();
  });
});

describe('authClientOf', () => {
  const req = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

  it('no header → web', () => expect(authClientOf(req({}))).toBe('web'));
  it('X-Client: native without browser headers → native', () =>
    expect(authClientOf(req({ 'x-client': 'native' }))).toBe('native'));
  it.each([
    [{ 'x-client': 'native', 'sec-fetch-site': 'same-origin' }],
    [{ 'x-client': 'native', 'sec-fetch-mode': 'cors' }],
    [{ 'x-client': 'web' }],
    [{ 'x-client': 'mobile' }],
  ])('%j → refused', (headers) => {
    expect(() => authClientOf(req(headers))).toThrow(UnsupportedClientError);
  });
});
