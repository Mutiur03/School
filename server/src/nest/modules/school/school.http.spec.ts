import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { prisma } from '../../../config/prisma.js';
import { getRlsContext } from '../../../config/rlsContextStore.js';
import { asSuperAdmin } from '../../common/http-test.js';
import {
  HAS_FAKES,
  SUPER_HOST,
  clearRedis,
  run as runSteps,
  setupWorld,
  teardownWorld,
} from '../../common/http-world.js';
import type { Step, World } from '../../common/http-world.js';
import { SchoolService } from './school.service.js';

/**
 * School module over HTTP (real Postgres + Redis + the fake R2/SMS server from
 * scripts/ci/fake-r2-sms.mjs). Platform routes (`/api/platform/*`, super admin, pre-tenant) and
 * tenant routes (`/api/school*`): envelope + status per step with explicit body checks, role checks,
 * cross-school isolation, the pre-tenant RLS context, the 402 lock and its allow-list,
 * validation, 404s, upload URLs, the xlsx export / password rotation and the SMS endpoints.
 */
type CStep = Step;

const maybe = HAS_FAKES ? describe : describe.skip;

maybe('school module (HTTP)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const run = async (steps: CStep[], redis: string[] = []) => {
    if (redis.length) await clearRedis(redis);
    return runSteps(w, steps);
  };

  /** Supertest helpers: `sa` = super admin on the super-admin host; `on` = a tenant host + token. */
  const sa = (r: request.Test) =>
    r.set('x-tenant-host', SUPER_HOST).set('authorization', `Bearer ${w.tokens.superAdmin}`);
  const on = (r: request.Test, host: string, token?: string) => {
    r.set('x-tenant-host', host);
    return token ? r.set('authorization', `Bearer ${token}`) : r;
  };
  /** Collects a binary body as a Buffer. */
  const binary = (r: request.Test) =>
    r.buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  const sheet = (buf: Buffer) => {
    const wb = XLSX.read(buf, { type: 'buffer' });
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
  };

  // ---- school (super-admin platform routes are pre-tenant; /school is the current tenant) ----
  const schoolBody = (sub: string, name: string) => ({
    name,
    logo: 'schools/logos/1-logo.png',
    district: 'Bagerhat',
    upazila: 'Bagerhat Sadar',
    phone: '01700000000',
    email: 'school@example.test',
    subdomain: sub,
  });
  const subOf = (host: string) => host.replace('.localhost', '');
  const ACTIVE = {
    status: 'active',
    currency: 'BDT',
    subscription_started_at: '2026-01-01',
    current_period_started_at: '2026-01-01',
    current_period_ends_at: '2030-06-01',
  };
  const EXPIRED = { ...ACTIVE, status: 'expired', current_period_ends_at: '2026-02-01' };
  const S = 'super' as const;

  test('platform schools (super admin, no tenant)', async () => {
    const created: number[] = [];
    const tag = w.fx.a.name.split(' ').pop();
    try {
      await run([
        // role checks: anonymous, tenant roles, super admin on a tenant host
        { method: 'get', path: '/api/platform/schools', host: S, expect: 401 },
        { method: 'get', path: '/api/platform/schools', as: 'adminA', expect: 403 },
        { method: 'get', path: '/api/platform/schools', as: 'adminA', host: S, expect: 403 },
        { method: 'get', path: '/api/platform/schools', as: 'teacherA', expect: 403 },
        { method: 'get', path: '/api/platform/schools', as: 'studentA', expect: 403 },
        { method: 'get', path: '/api/platform/schools', as: 'superAdmin', expect: 401 },
        {
          method: 'get',
          path: '/api/platform/schools',
          as: 'superAdmin',
          host: S,
          check: (b, c) => {
            const ids = b.data.map((x: any) => x.id);
            expect(ids).toEqual(expect.arrayContaining([c.schoolA, c.schoolB]));
            // super admin sees each school's subscription (RLS context is super admin)
            const a = b.data.find((x: any) => x.id === c.schoolA);
            expect(a).toMatchObject({ id: c.schoolA, name: w.fx.a.name });
            expect(a.subscription).toMatchObject({ status: 'active' });
          },
          expect: 200,
        },
        // create
        {
          method: 'post',
          path: '/api/platform/schools',
          as: 'superAdmin',
          host: S,
          body: {},
          expect: 400,
        },
        {
          method: 'post',
          path: '/api/platform/schools',
          as: 'superAdmin',
          host: S,
          body: {
            ...schoolBody(`pr${tag}n`, `Created ${tag}`),
            initialAdmin: { username: `pr-admin-${tag}`, password: 'secret12' },
            trialEndsAt: '2099-01-01',
          },
          save: (b, c) => {
            c.created = b?.data?.id;
            if (c.created) created.push(c.created);
          },
          expect: 201,
        },
        {
          method: 'post',
          path: '/api/platform/schools',
          as: 'superAdmin',
          host: S,
          body: {
            ...schoolBody(`pr${tag}n`, `Dup ${tag}`),
            initialAdmin: { username: `pr-admin2-${tag}`, password: 'secret12' },
            trialEndsAt: '2099-01-01',
          },
          save: (b) => b?.data?.id && created.push(b.data.id),
          expect: 409,
        },
        // update (full replace)
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolA}`,
          as: 'superAdmin',
          host: S,
          body: {},
          expect: 400,
        },
        {
          method: 'put',
          path: '/api/platform/schools/abc',
          as: 'superAdmin',
          host: S,
          body: schoolBody('x', 'X x'),
          expect: 400,
        },
        {
          method: 'put',
          path: '/api/platform/schools/99999999',
          as: 'superAdmin',
          host: S,
          body: schoolBody(`pr${tag}z`, 'Nobody'),
          expect: 404,
        },
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolA}`,
          as: 'adminA',
          body: schoolBody(subOf(w.fx.a.host), 'Hacked'),
          expect: 403,
        },
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolA}`,
          as: 'superAdmin',
          host: S,
          body: schoolBody(subOf(w.fx.a.host), `Renamed A ${tag}`),
          expect: 200,
        },
        { method: 'get', path: '/api/school', expect: 200 },
        // branding uploads
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=a.png&contentType=image/png',
          host: S,
          expect: 401,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url',
          as: 'superAdmin',
          host: S,
          expect: 400,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=a.pdf&contentType=application/pdf',
          as: 'superAdmin',
          host: S,
          expect: 400,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=a.png&contentType=image/png&kind=bogus',
          as: 'superAdmin',
          host: S,
          expect: 400,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=my%20logo!.png&contentType=image/png',
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=b.jpg&contentType=image/jpeg&kind=banner',
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        {
          method: 'get',
          path: '/api/platform/schools/upload-url?filename=h.webp&contentType=image/webp&kind=header',
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        // billing; locking B blocks B's tenant routes but not its billing reads
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolB}/billing`,
          as: 'adminB',
          host: 'b',
          expect: 403,
        },
        {
          method: 'get',
          path: '/api/platform/schools/abc/billing',
          as: 'superAdmin',
          host: S,
          expect: 400,
        },
        {
          method: 'get',
          path: '/api/platform/schools/99999999/billing',
          as: 'superAdmin',
          host: S,
          expect: 404,
        },
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolB}/billing`,
          as: 'superAdmin',
          host: S,
          body: { status: 'active' },
          expect: 400,
        },
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolB}/billing`,
          as: 'superAdmin',
          host: S,
          body: EXPIRED,
          expect: 200,
        },
        { method: 'get', path: '/api/school/billing', as: 'adminB', host: 'b', expect: 200 },
        {
          method: 'get',
          path: '/api/school/subscription-access',
          as: 'adminB',
          host: 'b',
          expect: 200,
        },
        { method: 'get', path: '/api/levels', as: 'adminB', host: 'b', expect: 402 },
        { method: 'get', path: '/api/school', host: 'b', expect: 200 },
        { method: 'get', path: '/api/levels', as: 'adminA', expect: 200 },
        // super-admin routes keep working for a locked school (no tenant check runs)
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolB}/billing`,
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        {
          method: 'put',
          path: (c) => `/api/platform/schools/${c.schoolB}/billing`,
          as: 'superAdmin',
          host: S,
          body: ACTIVE,
          expect: 200,
        },
        { method: 'get', path: '/api/levels', as: 'adminB', host: 'b', expect: 200 },
        // SMS credentials + balance
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolA}/sms-credentials`,
          as: 'adminA',
          expect: 403,
        },
        {
          method: 'get',
          path: '/api/platform/schools/abc/sms-credentials',
          as: 'superAdmin',
          host: S,
          expect: 400,
        },
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-credentials`,
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        {
          method: 'patch',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-credentials`,
          as: 'superAdmin',
          host: S,
          body: { sender_id: 'X', school_id: 1 },
          expect: 400,
        },
        {
          method: 'patch',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-credentials`,
          as: 'superAdmin',
          host: S,
          body: { sender_id: 'PARITY' },
          expect: 200,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-balance-topups`,
          as: 'superAdmin',
          host: S,
          body: {},
          expect: 400,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-balance-topups`,
          as: 'superAdmin',
          host: S,
          body: { amount: -5 },
          expect: 400,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-balance-topups`,
          as: 'superAdmin',
          host: S,
          body: { amount: '3x' },
          expect: 400,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-balance-topups`,
          as: 'superAdmin',
          host: S,
          body: { amount: 7 },
          expect: 201,
        },
        {
          method: 'post',
          path: '/api/platform/schools/99999999/sms-balance-topups',
          as: 'superAdmin',
          host: S,
          body: { amount: 7 },
          expect: 404,
        },
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolB}/sms-credentials`,
          as: 'superAdmin',
          host: S,
          expect: 200,
        },
        // files
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolA}/student-export`,
          as: 'adminA',
          binary: true,
          expect: 403,
        },
        {
          method: 'get',
          path: '/api/platform/schools/abc/student-export',
          as: 'superAdmin',
          host: S,
          binary: true,
          expect: 400,
        },
        {
          method: 'get',
          path: (c) => `/api/platform/schools/${c.schoolA}/student-export`,
          as: 'superAdmin',
          host: S,
          binary: true,
          expect: 200,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/student-password-rotations`,
          as: 'adminB',
          host: 'b',
          binary: true,
          expect: 403,
        },
        {
          method: 'post',
          path: (c) => `/api/platform/schools/${c.schoolB}/student-password-rotations`,
          as: 'superAdmin',
          host: S,
          binary: true,
          expect: 201,
        },
      ]);
    } finally {
      if (created.length)
        await asSuperAdmin(() => prisma.school.deleteMany({ where: { id: { in: created } } }));
    }
  });

  test('platform sms overview', async () => {
    await run([
      { method: 'get', path: '/api/platform/sms-overview', host: S, expect: 401 },
      { method: 'get', path: '/api/platform/sms-overview', as: 'adminA', expect: 403 },
      {
        method: 'get',
        path: '/api/platform/sms-overview',
        as: 'superAdmin',
        host: S,
        check: (b, c) => {
          const mine = b.data.schools.filter((x: any) =>
            [c.schoolA, c.schoolB].includes(x.school_id),
          );
          expect(mine).toHaveLength(2);
          expect(b.data).toHaveProperty('system');
        },
        expect: 200,
      },
    ]);
  });

  test('current school (tenant)', async () => {
    await run([
      { method: 'get', path: '/api/school', expect: 200 },
      { method: 'get', path: '/api/school', host: 'b', expect: 200 },
      // no school on the super-admin host: tenant routes refuse instead of guessing one
      { method: 'get', path: '/api/school', host: S, expect: 400 },
      { method: 'get', path: '/api/school/billing', as: 'superAdmin', host: S, expect: 400 },
      { method: 'get', path: '/api/school/subscription-access', expect: 401 },
      { method: 'get', path: '/api/school/subscription-access', as: 'studentA', expect: 200 },
      { method: 'get', path: '/api/school/subscription-access', as: 'teacherA', expect: 200 },
      { method: 'get', path: '/api/school/subscription-access', as: 'adminB', expect: 403 },
      { method: 'get', path: '/api/school/billing', as: 'adminA', expect: 200 },
      { method: 'get', path: '/api/school/billing', as: 'adminB', host: 'b', expect: 200 },
      { method: 'get', path: '/api/school/billing', as: 'teacherA', expect: 403 },
      { method: 'get', path: '/api/school/billing', as: 'adminA', host: 'b', expect: 403 },
    ]);
  });

  test('school: each tenant sees only its own school and billing', async () => {
    const get = (path: string, host: string, token?: string) => {
      const r = request(w.app).get(path).set('x-tenant-host', host);
      return token ? r.set('authorization', `Bearer ${token}`) : r;
    };
    const [a, b] = await Promise.all([
      get('/api/school', w.fx.a.host),
      get('/api/school', w.fx.b.host),
    ]);
    expect(a.body.data.id).toBe(w.fx.a.schoolId);
    expect(b.body.data.id).toBe(w.fx.b.schoolId);
    const billA = await get('/api/school/billing', w.fx.a.host, w.tokens.adminA);
    const billB = await get('/api/school/billing', w.fx.b.host, w.tokens.adminB);
    expect(billA.body.data.school_id).toBe(w.fx.a.schoolId);
    expect(billB.body.data.school_id).toBe(w.fx.b.schoolId);
  });

  test('school: super-admin requests carry no tenant context, even with a tenant header', async () => {
    // A super-admin token presented on a tenant host is refused by the host check...
    const onTenant = await request(w.app)
      .get('/api/platform/schools')
      .set('x-tenant-host', w.fx.a.host)
      .set('authorization', `Bearer ${w.tokens.superAdmin}`);
    expect(onTenant.status).toBe(401);
    // ...and a tenant admin token cannot reach platform routes from either host.
    for (const host of [w.fx.a.host, SUPER_HOST]) {
      const r = await request(w.app)
        .get('/api/platform/schools')
        .set('x-tenant-host', host)
        .set('authorization', `Bearer ${w.tokens.adminA}`);
      expect(r.status).toBe(403);
    }
    // Super admin sees every school (no tenant RLS filter), including both fixtures.
    const all = await request(w.app)
      .get('/api/platform/schools')
      .set('x-tenant-host', SUPER_HOST)
      .set('authorization', `Bearer ${w.tokens.superAdmin}`);
    const ids = all.body.data.map((s: any) => s.id);
    expect(ids).toEqual(expect.arrayContaining([w.fx.a.schoolId, w.fx.b.schoolId]));
    expect(all.body.data.find((s: any) => s.id === w.fx.b.schoolId).subscription).toBeTruthy();
  });

  // ---- explicit checks beyond the snapshot script ----

  const PLATFORM: [method: 'get' | 'post' | 'put' | 'patch', path: (id: number) => string][] = [
    ['get', () => '/api/platform/schools'],
    ['post', () => '/api/platform/schools'],
    ['get', () => '/api/platform/schools/upload-url?filename=a.png&contentType=image/png'],
    ['put', (id) => `/api/platform/schools/${id}`],
    ['get', (id) => `/api/platform/schools/${id}/billing`],
    ['put', (id) => `/api/platform/schools/${id}/billing`],
    ['post', (id) => `/api/platform/schools/${id}/student-password-rotations`],
    ['get', (id) => `/api/platform/schools/${id}/student-export`],
    ['get', () => '/api/platform/sms-overview'],
    ['get', (id) => `/api/platform/schools/${id}/sms-credentials`],
    ['patch', (id) => `/api/platform/schools/${id}/sms-credentials`],
    ['post', (id) => `/api/platform/schools/${id}/sms-balance-topups`],
  ];

  test('every platform endpoint: 401 anonymous / super admin on a tenant host, 403 tenant roles', async () => {
    const id = w.fx.a.schoolId;
    for (const [m, p] of PLATFORM) {
      const path = p(id);
      const anon = await request(w.app)[m](path).set('x-tenant-host', SUPER_HOST);
      expect([path, anon.status]).toEqual([path, 401]);
      const superOnTenant = await on(request(w.app)[m](path), w.fx.a.host, w.tokens.superAdmin);
      expect([path, superOnTenant.status]).toEqual([path, 401]);
      for (const who of ['adminA', 'teacherA', 'studentA'] as const) {
        const r = await on(request(w.app)[m](path), w.fx.a.host, w.tokens[who]);
        expect([path, who, r.status]).toEqual([path, who, 403]);
        expect(r.body).toMatchObject({ success: false });
      }
      // A tenant admin cannot use the super-admin host to get in either.
      const adminOnSuper = await on(request(w.app)[m](path), SUPER_HOST, w.tokens.adminA);
      expect([path, adminOnSuper.status]).toEqual([path, 403]);
    }
    // Nothing above changed school A.
    const a = await asSuperAdmin(async () => await prisma.school.findUnique({ where: { id } }));
    expect(a?.name).not.toMatch(/^Hacked/);
  });

  test('the removed /api/schools paths are gone: 404 on a tenant host, 400 (no school) on the super host', async () => {
    // No longer pre-tenant, so on the super-admin host they stop at "school context required".
    for (const p of [
      '/api/schools',
      '/api/schools/sms-overview',
      `/api/schools/${w.fx.a.schoolId}/billing`,
    ]) {
      expect([p, (await sa(request(w.app).get(p))).status]).toEqual([p, 400]);
    }
    expect((await on(request(w.app).get('/api/schools/public'), w.fx.a.host)).status).toBe(404);
    expect(
      (await on(request(w.app).get('/api/schools/billing'), w.fx.a.host, w.tokens.adminA)).status,
    ).toBe(404);
    const nest = await sa(request(w.app).get('/api/platform/nope'));
    expect(nest.status).toBe(404);
    expect(nest.headers.deprecation).toBeUndefined();
  });

  test('platform routes run pre-tenant: no school id, super-admin RLS; tenant routes get their school', async () => {
    const seen: unknown[] = [];
    const spy = jest.spyOn(SchoolService, 'getSchools').mockImplementation(async () => {
      seen.push({ ...getRlsContext() });
      return [];
    });
    try {
      const r = await sa(request(w.app).get('/api/platform/schools'));
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ success: true, data: [] });
    } finally {
      spy.mockRestore();
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ isSuperAdmin: true });
    expect((seen[0] as any).schoolId).toBeUndefined();

    const tenant: unknown[] = [];
    const spy2 = jest.spyOn(SchoolService, 'getSchoolInfo').mockImplementation(async (id) => {
      tenant.push({ id, ...getRlsContext() });
      return { id } as any;
    });
    try {
      expect((await on(request(w.app).get('/api/school'), w.fx.b.host)).status).toBe(200);
    } finally {
      spy2.mockRestore();
    }
    expect(tenant[0]).toMatchObject({ id: w.fx.b.schoolId, schoolId: w.fx.b.schoolId });
    expect((tenant[0] as any).isSuperAdmin).toBeFalsy();
  });

  test('GET /api/school: public profile shape, per host, 400 without a school', async () => {
    const r = await on(request(w.app).get('/api/school'), w.fx.a.host);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data).toMatchObject({ id: w.fx.a.schoolId, subdomain: expect.any(String) });
    // Public projection only: no relations / secrets.
    for (const k of ['subscription', 'admins', 'sms_settings', 'createdAt', 'updatedAt'])
      expect(r.body.data).not.toHaveProperty(k);
    expect((await on(request(w.app).get('/api/school'), SUPER_HOST)).status).toBe(400);
  });

  test('subscription lock: 402 for every tenant role, allow-list and public profile stay open', async () => {
    const expired = {
      status: 'expired',
      currency: 'BDT',
      subscription_started_at: '2026-01-01',
      current_period_started_at: '2026-01-01',
      current_period_ends_at: '2026-02-01',
    };
    const active = { ...expired, status: 'active', current_period_ends_at: '2030-06-01' };
    const b = w.fx.b.host;
    const put = (body: object) =>
      sa(request(w.app).put(`/api/platform/schools/${w.fx.b.schoolId}/billing`)).send(body);
    expect((await put(expired)).status).toBe(200);
    try {
      for (const who of ['adminB', 'teacherB', 'studentB'] as const) {
        const blocked = await on(request(w.app).get('/api/levels'), b, w.tokens[who]);
        expect([who, blocked.status]).toEqual([who, 402]);
        const access = await on(
          request(w.app).get('/api/school/subscription-access'),
          b,
          w.tokens[who],
        );
        expect([who, access.status]).toEqual([who, 200]);
      }
      expect((await on(request(w.app).get('/api/school/billing'), b, w.tokens.adminB)).status).toBe(
        200,
      );
      expect((await on(request(w.app).get('/api/school'), b)).status).toBe(200);
      // School A is unaffected.
      expect(
        (await on(request(w.app).get('/api/levels'), w.fx.a.host, w.tokens.adminA)).status,
      ).toBe(200);
      // Platform reads of the locked school still work.
      expect(
        (await sa(request(w.app).get(`/api/platform/schools/${w.fx.b.schoolId}/billing`))).body.data
          .status,
      ).toBe('expired');
    } finally {
      expect((await put(active)).status).toBe(200);
    }
    expect((await on(request(w.app).get('/api/levels'), b, w.tokens.adminB)).status).toBe(200);
  });

  test('school bodies: zod validation, unknown fields are not persisted, 404 / 400 ids', async () => {
    const before = await asSuperAdmin(
      async () => await prisma.school.findUniqueOrThrow({ where: { id: w.fx.b.schoolId } }),
    );
    const body = {
      name: before.name,
      logo: 'schools/logos/1-logo.png',
      district: 'Bagerhat',
      upazila: 'Bagerhat Sadar',
      phone: '01700000000',
      email: 'school@example.test',
      subdomain: before.subdomain,
    };
    const bad = await sa(request(w.app).put(`/api/platform/schools/${w.fx.b.schoolId}`)).send({
      ...body,
      email: 'not-an-email',
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ success: false });
    const extra = await sa(request(w.app).put(`/api/platform/schools/${w.fx.b.schoolId}`)).send({
      ...body,
      id: 1,
      promotionVersion: 99,
      bogus: 'x',
    });
    // zod strips unknown keys (or rejects them); either way nothing outside the schema is written.
    expect([200, 400]).toContain(extra.status);
    const after = await asSuperAdmin(
      async () => await prisma.school.findUniqueOrThrow({ where: { id: w.fx.b.schoolId } }),
    );
    expect(after.id).toBe(w.fx.b.schoolId);
    expect(after.promotionVersion).toBe(before.promotionVersion);
    expect((await sa(request(w.app).put('/api/platform/schools/1.5')).send(body)).status).toBe(400);
    expect(
      (await sa(request(w.app).put('/api/platform/schools/2147483000')).send(body)).status,
    ).toBe(404);
    expect((await sa(request(w.app).post('/api/platform/schools')).send({ bogus: 1 })).status).toBe(
      400,
    );
  });

  test('upload-url: images only, sanitized key per kind, presigned against R2', async () => {
    const url = (q: string) => sa(request(w.app).get(`/api/platform/schools/upload-url?${q}`));
    for (const q of [
      'filename=a.pdf&contentType=application/pdf',
      'filename=a.svg&contentType=text/xml',
      'filename=&contentType=image/png',
      'contentType=image/png',
      'filename=a.png',
      'filename=a.png&contentType=image/png&kind=avatar',
    ]) {
      expect([q, (await url(q)).status]).toEqual([q, 400]);
    }
    const kinds = { logo: 'logos', header: 'headers', banner: 'banners', hotline: 'hotlines' };
    for (const [kind, folder] of Object.entries(kinds)) {
      const r = await url(
        `filename=${encodeURIComponent('My Logo!.webp')}&contentType=image/webp&kind=${kind}`,
      );
      expect(r.status).toBe(200);
      expect(r.body.data.kind).toBe(kind);
      expect(r.body.data.key).toMatch(new RegExp(`^schools/${folder}/\\d+-My-Logo-\\.webp$`));
      expect(r.body.data.uploadUrl).toContain(r.body.data.key);
    }
    const def = await url('filename=noext&contentType=image/png');
    expect(def.body.data).toMatchObject({ kind: 'logo' });
    expect(def.body.data.key).toMatch(/^schools\/logos\/\d+-noext\.png$/);
  });

  test('student export: xlsx of that school only', async () => {
    const r = await binary(
      sa(request(w.app).get(`/api/platform/schools/${w.fx.a.schoolId}/student-export`)),
    );
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    expect(r.headers['content-disposition']).toBe(
      `attachment; filename="school-${w.fx.a.schoolId}-students.xlsx"`,
    );
    const rows = sheet(r.body);
    expect(rows.map((x) => x['Login ID'])).toEqual([w.fx.a.student.login_id]);
    expect(rows[0]).toMatchObject({ Name: w.fx.a.student.name, Class: 6, Section: 'A', Roll: 1 });
    expect(rows[0]).not.toHaveProperty('Password');
    expect(
      (await sa(request(w.app).get('/api/platform/schools/2147483000/student-export'))).status,
    ).toBe(404);
  });

  test('password rotation: new working passwords for that school only, sessions revoked', async () => {
    const read = (id: number) =>
      asSuperAdmin(
        async () =>
          await prisma.students.findUniqueOrThrow({
            where: { id },
            select: { password: true, tokenVersion: true },
          }),
      );
    const [a0, b0] = [await read(w.fx.a.student.id), await read(w.fx.b.student.id)];
    const r = await binary(
      sa(
        request(w.app).post(`/api/platform/schools/${w.fx.a.schoolId}/student-password-rotations`),
      ),
    );
    expect(r.status).toBe(201);
    expect(r.headers['content-disposition']).toBe(
      `attachment; filename="school-${w.fx.a.schoolId}-rotated-passwords.xlsx"`,
    );
    const rows = sheet(r.body);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Login ID']).toBe(w.fx.a.student.login_id);
    const pw = String(rows[0]['New Password']);
    expect(pw).toHaveLength(8);
    const [a1, b1] = [await read(w.fx.a.student.id), await read(w.fx.b.student.id)];
    expect(await bcrypt.compare(pw, a1.password as string)).toBe(true);
    expect(a1.tokenVersion).toBe(a0.tokenVersion + 1);
    expect(b1).toEqual(b0);

    // A school with no students, and an unknown school, are 404s.
    const empty = await asSuperAdmin(
      async () =>
        await prisma.school.create({
          data: { name: 'Empty', shortName: 'E', subdomain: `empty${w.fx.a.schoolId}x` },
        }),
    );
    try {
      expect(
        (
          await sa(
            request(w.app).post(`/api/platform/schools/${empty.id}/student-password-rotations`),
          )
        ).status,
      ).toBe(404);
    } finally {
      await asSuperAdmin(async () => await prisma.school.delete({ where: { id: empty.id } }));
    }
    expect(
      (await sa(request(w.app).post('/api/platform/schools/2147483000/student-password-rotations')))
        .status,
    ).toBe(404);
  });

  test('sms-credentials and sms-balance-topups validation; balance moves for that school only', async () => {
    const id = w.fx.a.schoolId;
    const creds = await sa(request(w.app).get(`/api/platform/schools/${id}/sms-credentials`));
    expect(creds.status).toBe(200);
    expect(creds.body.data).toHaveProperty('api_key_masked');
    expect(JSON.stringify(creds.body)).not.toMatch(/"api_key"/);
    const patch = (body: object) =>
      sa(request(w.app).patch(`/api/platform/schools/${id}/sms-credentials`)).send(body);
    for (const body of [{ api_key: 5 }, { sender_id: 7 }, { sms_balance: 100 }, { school_id: 1 }]) {
      expect([body, (await patch(body)).status]).toEqual([body, 400]);
    }
    const ok = await patch({ sender_id: 'SCHOOLA' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.sender_id).toBe('SCHOOLA');

    const bal = (sid: number) =>
      asSuperAdmin(
        async () =>
          await prisma.sms_settings.findUnique({
            where: { school_id: sid },
            select: { sms_balance: true },
          }),
      );
    // make sure B has settings so we can compare
    await sa(request(w.app).get(`/api/platform/schools/${w.fx.b.schoolId}/sms-credentials`));
    const [a0, b0] = [await bal(id), await bal(w.fx.b.schoolId)];
    const top = (body: object, sid = id) =>
      sa(request(w.app).post(`/api/platform/schools/${sid}/sms-balance-topups`)).send(body);
    for (const body of [
      {},
      { amount: 0 },
      { amount: -1 },
      { amount: 1.5 },
      { amount: 'abc' },
      { amount: 10_000_001 },
    ]) {
      expect([body, (await top(body)).status]).toEqual([body, 400]);
    }
    const r = await top({ amount: 25 });
    expect(r.status).toBe(201);
    expect(r.body.data.sms_balance).toBe((a0?.sms_balance ?? 0) + 25);
    expect((await bal(id))?.sms_balance).toBe((a0?.sms_balance ?? 0) + 25);
    expect(await bal(w.fx.b.schoolId)).toEqual(b0);
    expect((await top({ amount: 5 }, 2147483000)).status).toBe(404);
  });
});
