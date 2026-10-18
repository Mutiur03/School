import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';
import {
  accessTokenRole,
  authClientOf,
  signAccessToken,
  signRefreshToken,
  UnsupportedClientError,
  verifyAccessToken,
  verifyRefreshToken,
} from './auth-tokens.js';

// Pure JWT logic: no DB, no Redis (runs in CI).
const refreshClaims = { id: 7, role: 'admin', version: 0, sch: 3, fam: 'fam-1' };

describe('token type separation (both signed with JWT_SECRET)', () => {
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
    // The signature passes; the typ claim must still reject it.
    expect(verifyAccessToken(refresh)).toBeNull();
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

describe('signature checks', () => {
  it('refresh tokens are signed with JWT_SECRET', () => {
    const refresh = signRefreshToken(refreshClaims, 'jti-2');
    expect(() => jwt.verify(refresh, env.JWT_SECRET)).not.toThrow();
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
