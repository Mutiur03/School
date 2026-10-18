import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../config/prisma.js';
import { redis } from '../../../config/redis.js';
import { signAccessToken } from '../../../modules/auth/auth-tokens.js';
import { asSuperAdmin } from '../../common/http-test.js';
import { closeAppResources, seedTwoSchools } from '../../common/two-schools.fixture.js';
import { LOOKUP_KEY_PREFIX, LOOKUP_LIMIT } from './lookup-throttle.guard.js';

// /api/school-codes (admin, tenant-scoped) and /api/school-code-lookups (public, pre-tenant).
// Real DB as the RLS-restricted runtime role + real Redis.
let app: Express;
let fx: Awaited<ReturnType<typeof seedTwoSchools>>;
let tokenA = '';
let tokenB = '';

const clearLookupBudget = async () => {
  const keys = await redis.keys(`${LOOKUP_KEY_PREFIX}*`);
  if (keys.length) await redis.del(...keys);
};

beforeAll(async () => {
  app = await createApp();
  fx = await seedTwoSchools();
  tokenA = signAccessToken({ id: fx.a.admin.id, role: 'admin', sch: fx.a.schoolId });
  tokenB = signAccessToken({ id: fx.b.admin.id, role: 'admin', sch: fx.b.schoolId });
  await clearLookupBudget();
});

afterAll(async () => {
  await clearLookupBudget();
  await fx?.cleanup();
  await closeAppResources();
});

const admin = (method: 'get' | 'post' | 'delete', path: string, host: string, token?: string) => {
  const req = request(app)[method](path).set('x-tenant-host', host);
  return token ? req.set('authorization', `Bearer ${token}`) : req;
};
// No tenant header at all: the app does not know its school yet.
const lookup = (code: unknown) => request(app).post('/api/school-code-lookups').send({ code });

const GENERIC_404 = { success: false, message: 'School code not found' };

describe('admin endpoints', () => {
  test('no token → 401, student token → 403', async () => {
    expect((await admin('get', '/api/school-codes', fx.a.host)).status).toBe(401);
    const student = signAccessToken({ id: fx.a.student.id, role: 'student', sch: fx.a.schoolId });
    expect((await admin('post', '/api/school-codes', fx.a.host, student).send({})).status).toBe(
      403,
    );
  });

  test('rejects unknown fields (no client-chosen code or school)', async () => {
    const res = await admin('post', '/api/school-codes', fx.a.host, tokenA).send({
      school_id: fx.b.schoolId,
      code: 'AAA-AAAA',
    });
    expect(res.status).toBe(400);
  });

  test('create → list → isolated from school B → revoke', async () => {
    const created = await admin('post', '/api/school-codes', fx.a.host, tokenA).send({
      role_hint: 'teacher',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      role_hint: 'teacher',
      status: 'active',
      created_by: fx.a.admin.id,
    });
    const { id, code } = created.body.data;

    const listA = await admin('get', '/api/school-codes', fx.a.host, tokenA);
    expect(listA.body.data.map((c: any) => c.code)).toContain(code);
    const listB = await admin('get', '/api/school-codes', fx.b.host, tokenB);
    expect(listB.body.data.map((c: any) => c.code)).not.toContain(code);

    expect((await admin('delete', `/api/school-codes/${id}`, fx.b.host, tokenB)).status).toBe(404);
    // School A token on school B host is refused before any lookup.
    expect([401, 403]).toContain(
      (await admin('delete', `/api/school-codes/${id}`, fx.b.host, tokenA)).status,
    );

    const revoked = await admin('delete', `/api/school-codes/${id}`, fx.a.host, tokenA);
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.status).toBe('revoked');
  });
});

describe('public lookup', () => {
  let active = '';

  beforeAll(async () => {
    const res = await admin('post', '/api/school-codes', fx.a.host, tokenA).send({
      role_hint: 'student',
    });
    active = res.body.data.code;
  });

  test('valid code → public info, host and role hint only', async () => {
    const res = await lookup(active.toLowerCase().replace('-', ' '));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        school: { name: fx.a.name, shortName: 'A', logo: null },
        tenant: { host: fx.a.host, apiBaseUrl: expect.stringContaining(fx.a.host) },
        roleHint: 'student',
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/school_?id|"id"|created_by|email|phone/i);
  });

  test('the request host does not matter (works on another school’s host)', async () => {
    const res = await request(app)
      .post('/api/school-code-lookups')
      .set('x-tenant-host', fx.b.host)
      .send({ code: active });
    expect(res.body.data.tenant.host).toBe(fx.a.host);
  });

  test('revoked, expired, unknown and malformed codes all get the same 404', async () => {
    const revoke = await admin('post', '/api/school-codes', fx.a.host, tokenA).send({});
    await admin('delete', `/api/school-codes/${revoke.body.data.id}`, fx.a.host, tokenA);
    const expire = await admin('post', '/api/school-codes', fx.a.host, tokenA).send({});
    await asSuperAdmin(
      async () =>
        await prisma.school_access_codes.update({
          where: { id: expire.body.data.id },
          data: { expires_at: new Date(Date.now() - 1000) },
        }),
    );
    const bodies = [];
    for (const code of [revoke.body.data.code, expire.body.data.code, 'ZZZ-ZZZZ', 'AB0-1OIL']) {
      const res = await lookup(code);
      expect(res.status).toBe(404);
      bodies.push(res.body);
    }
    for (const body of bodies) expect(body).toMatchObject(GENERIC_404);
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });

  test('school_app cannot read codes directly; only through the definer function', async () => {
    // Raw query outside any RLS context, as the runtime role.
    const direct = await prisma.$queryRaw<unknown[]>`SELECT code FROM public.school_access_codes`;
    expect(direct).toEqual([]);
    const fn = await prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM app.lookup_school_access_code(${active})`;
    expect(fn).toHaveLength(1);
  });

  test(`rate limited after ${LOOKUP_LIMIT} attempts per window`, async () => {
    await clearLookupBudget();
    const statuses: number[] = [];
    for (let i = 0; i < LOOKUP_LIMIT + 2; i++) statuses.push((await lookup('ZZZ-ZZZZ')).status);
    expect(statuses.slice(0, LOOKUP_LIMIT).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(LOOKUP_LIMIT)).toEqual([429, 429]);
    const limited = await lookup(active);
    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.data).toBeUndefined();
  });
});

test('unrelated tenant routes still require a school host', async () => {
  const res = await request(app).get('/api/holidays');
  expect(res.status).toBe(404);
});
