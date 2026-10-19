import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { asSuperAdmin } from '../../nest/common/http-test.js';
import {
  closeAppResources,
  FIXTURE_PASSWORD,
  FIXTURE_YEAR,
  seedTwoSchools,
} from '../../nest/common/two-schools.fixture.js';

// Native vs web token transport, rotation/reuse, token types and tenant isolation.
// Real DB as the RLS-restricted runtime role; supertest sends no Sec-Fetch-* headers (like a
// native app). Run locally: see docs/native-auth.md.
let app: Express;
let fx: Awaited<ReturnType<typeof seedTwoSchools>>;

beforeAll(async () => {
  app = await createApp();
  fx = await seedTwoSchools();
});

afterAll(async () => {
  await fx?.cleanup();
  await closeAppResources();
});

const NATIVE = { 'x-client': 'native' };
const login = (host: string, username: string, headers: Record<string, string> = {}) =>
  request(app)
    .post('/api/auth/admin/sessions')
    .set('x-tenant-host', host)
    .set(headers)
    .send({ username, password: FIXTURE_PASSWORD });
const refreshNative = (host: string, refreshToken?: string) =>
  request(app)
    .post('/api/auth/sessions/refresh')
    .set('x-tenant-host', host)
    .set(NATIVE)
    .send(refreshToken === undefined ? {} : { refreshToken });
const students = (host: string, token: string) =>
  request(app)
    .get('/api/students')
    .query({ year: FIXTURE_YEAR, page: 1, limit: 50 })
    .set('x-tenant-host', host)
    .set('authorization', `Bearer ${token}`);
const cookieOf = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('refreshToken='));

describe('response shapes', () => {
  test('web login: access token in body, refresh token only as HttpOnly cookie', async () => {
    const res = await login(fx.a.host, fx.a.admin.username);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'user']);
    expect(cookieOf(res)).toMatch(/HttpOnly/i);
  });

  test('native login: refresh token in body, no cookie', async () => {
    const res = await login(fx.a.host, fx.a.admin.username, NATIVE);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
    expect(cookieOf(res)).toBeUndefined();
    const access = jwt.decode(res.body.data.accessToken) as any;
    const refresh = jwt.decode(res.body.data.refreshToken) as any;
    expect(access).toMatchObject({ typ: 'access', sch: fx.a.schoolId, id: fx.a.admin.id });
    expect(refresh).toMatchObject({ typ: 'refresh', sch: fx.a.schoolId });
    expect(refresh.jti).toBeTruthy();
  });

  test.each([
    [{ 'x-client': 'native', 'sec-fetch-mode': 'cors' }],
    [{ 'x-client': 'native', 'sec-fetch-site': 'same-origin' }],
    [{ 'x-client': 'ios' }],
  ])('browser or unknown client %j → 400, nothing issued', async (headers) => {
    const res = await login(fx.a.host, fx.a.admin.username, headers);
    expect(res.status).toBe(400);
    expect(res.body.data?.refreshToken).toBeUndefined();
    expect(cookieOf(res)).toBeUndefined();
  });

  test('web refresh: rotates the cookie, body has no refresh token', async () => {
    const first = await login(fx.a.host, fx.a.admin.username);
    const cookie = cookieOf(first)!.split(';')[0];
    const res = await request(app)
      .post('/api/auth/sessions/refresh')
      .set('x-tenant-host', fx.a.host)
      .set('cookie', cookie);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'user']);
    expect(cookieOf(res)!.split(';')[0]).not.toBe(cookie);
  });

  test('native refresh ignores cookies (body only)', async () => {
    const web = await login(fx.a.host, fx.a.admin.username);
    const res = await request(app)
      .post('/api/auth/sessions/refresh')
      .set('x-tenant-host', fx.a.host)
      .set(NATIVE)
      .set('cookie', cookieOf(web)!.split(';')[0])
      .send({});
    expect(res.status).toBe(401);
  });

  test('a web session cannot be continued in native mode', async () => {
    const web = await login(fx.a.host, fx.a.admin.username);
    const token = cookieOf(web)!.split(';')[0].slice('refreshToken='.length);
    expect((await refreshNative(fx.a.host, decodeURIComponent(token))).status).toBe(401);
  });
});

describe('token types', () => {
  test('refresh token as bearer → 401', async () => {
    const { body } = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const res = await students(fx.a.host, body.data.refreshToken);
    expect(res.status).toBe(401);
  });

  test('access token as refresh token → 401', async () => {
    const { body } = await login(fx.a.host, fx.a.admin.username, NATIVE);
    expect((await refreshNative(fx.a.host, body.data.accessToken)).status).toBe(401);
  });

  test('pre-rollout web refresh cookie is accepted once and upgraded', async () => {
    const legacy = jwt.sign({ id: fx.a.admin.id, role: 'admin', version: 0 }, env.JWT_SECRET, {
      expiresIn: '7d',
    });
    const res = await request(app)
      .post('/api/auth/sessions/refresh')
      .set('x-tenant-host', fx.a.host)
      .set('cookie', `refreshToken=${legacy}`);
    expect(res.status).toBe(200);
    const next = cookieOf(res)!.split(';')[0].slice('refreshToken='.length);
    expect(jwt.decode(decodeURIComponent(next))).toMatchObject({ typ: 'refresh' });
    // Never in native mode.
    expect((await refreshNative(fx.a.host, legacy)).status).toBe(401);
  });
});

describe('rotation and reuse', () => {
  test('each refresh rotates; reusing an old token after the grace window kills the family', async () => {
    const { body } = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const t1 = body.data.refreshToken as string;
    const r1 = await refreshNative(fx.a.host, t1);
    expect(r1.status).toBe(200);
    const t2 = r1.body.data.refreshToken as string;
    expect(t2).not.toBe(t1);
    expect(r1.body.data.accessToken).toBeTruthy();

    // Age the rotation past the 30 s grace window instead of sleeping.
    const jti1 = (jwt.decode(t1) as any).jti;
    await asSuperAdmin(
      async () =>
        await prisma.auth_sessions.updateMany({
          where: { jti: jti1 },
          data: { rotated_at: new Date(Date.now() - 60_000) },
        }),
    );
    expect((await refreshNative(fx.a.host, t1)).status).toBe(401); // reuse detected
    expect((await refreshNative(fx.a.host, t2)).status).toBe(401); // family revoked
  });

  test('reuse inside the grace window (retry/race) still works', async () => {
    const { body } = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const t1 = body.data.refreshToken as string;
    expect((await refreshNative(fx.a.host, t1)).status).toBe(200);
    expect((await refreshNative(fx.a.host, t1)).status).toBe(200);
  });

  test('native logout revokes the session', async () => {
    const { body } = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const res = await request(app)
      .delete('/api/auth/sessions')
      .set('x-tenant-host', fx.a.host)
      .set(NATIVE)
      .send({ refreshToken: body.data.refreshToken });
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toBeUndefined();
    expect((await refreshNative(fx.a.host, body.data.refreshToken)).status).toBe(401);
  });
});

describe('tenant isolation (two schools, two admins)', () => {
  test('each admin sees only their own school’s students', async () => {
    const a = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const b = await login(fx.b.host, fx.b.admin.username, NATIVE);
    const ra = await students(fx.a.host, a.body.data.accessToken);
    const rb = await students(fx.b.host, b.body.data.accessToken);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    const names = (r: request.Response) => r.body.data.data.map((s: any) => s.name);
    expect(names(ra)).toEqual([fx.a.student.name]);
    expect(names(rb)).toEqual([fx.b.student.name]);
  });

  test('school A access token against school B host → rejected', async () => {
    const a = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const res = await students(fx.b.host, a.body.data.accessToken);
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(fx.b.student.name);
  });

  test('school A refresh token against school B host → 401', async () => {
    const a = await login(fx.a.host, fx.a.admin.username, NATIVE);
    expect((await refreshNative(fx.b.host, a.body.data.refreshToken)).status).toBe(401);
  });

  test('school A admin cannot log in through school B host', async () => {
    const res = await login(fx.b.host, fx.a.admin.username, NATIVE);
    expect(res.status).toBe(401);
  });

  test('a client-sent school id is ignored (tenant comes from the host)', async () => {
    const a = await login(fx.a.host, fx.a.admin.username, NATIVE);
    const res = await students(fx.a.host, a.body.data.accessToken).query({
      school_id: fx.b.schoolId,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.data.map((s: any) => s.name)).toEqual([fx.a.student.name]);
  });
});
