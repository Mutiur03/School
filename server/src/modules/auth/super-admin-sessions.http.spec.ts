import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { asSuperAdmin } from '../../nest/common/http-test.js';
import { closeAppResources, seedTwoSchools } from '../../nest/common/two-schools.fixture.js';

// Super-admin refresh-token sessions (auth_sessions rows with school_id NULL) against a real DB
// as the RLS-restricted runtime role. Before 20261019100000 every super-admin login and refresh
// failed with a 500 ('school_id is required for super_admin inserts'). Real-DB spec: excluded in
// CI by `--testPathIgnorePatterns http.spec`; run locally as in docs/native-auth.md.
const HOST = 'admin.localhost'; // a super-admin host (utils/superAdminDomain.ts)
const PASSWORD = 'Fixture-super-1';

let app: Express;
let fx: Awaited<ReturnType<typeof seedTwoSchools>>;
let superAdmin: { id: number; email: string };

beforeAll(async () => {
  app = await createApp();
  fx = await seedTwoSchools();
  const email = `fx-super-${randomBytes(4).toString('hex')}@fixture.test`;
  const row = await prisma.superAdmin.create({
    data: { email, password: await bcrypt.hash(PASSWORD, 4) },
  });
  superAdmin = { id: row.id, email };
});

afterAll(async () => {
  if (superAdmin) {
    await asSuperAdmin(
      async () =>
        await prisma.auth_sessions.deleteMany({
          where: { user_role: 'super_admin', user_id: superAdmin.id },
        }),
    );
    await prisma.superAdmin.delete({ where: { id: superAdmin.id } });
  }
  await fx?.cleanup();
  await closeAppResources();
});

const cookieOf = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('refreshToken=') && !c.startsWith('refreshToken=;'))
    ?.split(';')[0];
const login = () =>
  request(app)
    .post('/api/auth/super_admin/sessions')
    .set('x-tenant-host', HOST)
    .send({ email: superAdmin.email, password: PASSWORD });
const refresh = (cookie: string) =>
  request(app).post('/api/auth/sessions/refresh').set('x-tenant-host', HOST).set('cookie', cookie);
const jtiOf = (cookie: string) => (jwt.decode(cookie.slice('refreshToken='.length)) as any).jti;
const rowsFor = () =>
  asSuperAdmin(
    async () =>
      await prisma.auth_sessions.findMany({
        where: { user_role: 'super_admin', user_id: superAdmin.id },
        orderBy: { created_at: 'asc' },
      }),
  );

describe('super-admin sessions', () => {
  let firstCookie = '';
  let secondCookie = '';

  test('login creates a session row with no school', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: superAdmin.id, role: 'super_admin' });
    firstCookie = cookieOf(res)!;
    expect(firstCookie).toBeTruthy();
    const claims = jwt.decode(firstCookie.slice('refreshToken='.length)) as any;
    expect(claims).toMatchObject({ typ: 'refresh', role: 'super_admin', sch: null });

    const rows = await rowsFor();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      jti: claims.jti,
      school_id: null,
      user_role: 'super_admin',
      client: 'web',
      replaced_by: null,
      revoked_at: null,
    });
  });

  test('refresh rotates it within the same family', async () => {
    const res = await refresh(firstCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: superAdmin.id, role: 'super_admin' });
    secondCookie = cookieOf(res)!;
    expect(secondCookie).toBeTruthy();
    expect(secondCookie).not.toBe(firstCookie);

    const rows = await rowsFor();
    const [old, next] = rows;
    expect(rows).toHaveLength(2);
    expect(old.jti).toBe(jtiOf(firstCookie));
    expect(old.replaced_by).toBe(jtiOf(secondCookie));
    expect(old.rotated_at).not.toBeNull();
    expect(next).toMatchObject({
      jti: jtiOf(secondCookie),
      family_id: old.family_id,
      school_id: null,
      revoked_at: null,
    });
  });

  test('logout revokes the family and the token stops working', async () => {
    const before = await prisma.superAdmin.findUnique({ where: { id: superAdmin.id } });
    const res = await request(app)
      .delete('/api/auth/sessions')
      .set('x-tenant-host', HOST)
      .set('cookie', secondCookie);
    expect(res.status).toBe(200);

    const rows = await rowsFor();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.revoked_at).not.toBeNull();
    const after = await prisma.superAdmin.findUnique({ where: { id: superAdmin.id } });
    expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);

    expect((await refresh(secondCookie)).status).toBe(401);
  });
});

describe('auth_sessions trigger still rejects rows without a school', () => {
  // Raw SQL in one transaction, with the RLS GUCs the app sets (config/prisma.ts), so the
  // trigger itself is exercised (the Prisma extension would refuse some of these earlier).
  const insertAs = (ctx: { superAdmin: boolean; schoolId: number | null }, role: string) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.is_super_admin', ${ctx.superAdmin ? '1' : '0'}, true),
               set_config('app.school_id', ${ctx.schoolId ? String(ctx.schoolId) : ''}, true)`;
      await tx.$executeRaw`
        INSERT INTO auth_sessions (jti, family_id, user_role, user_id, school_id, client, expires_at)
        VALUES (gen_random_uuid(), gen_random_uuid(), ${role}, 1, NULL, 'web', now() + interval '1 day')`;
    });

  test('a school role with no school, in super-admin context', async () => {
    await expect(insertAs({ superAdmin: true, schoolId: null }, 'admin')).rejects.toThrow(
      /school_id is required for super_admin inserts/,
    );
  });

  test('a school role with no school and no tenant context', async () => {
    await expect(insertAs({ superAdmin: false, schoolId: null }, 'teacher')).rejects.toThrow(
      /missing tenant context/,
    );
  });

  test('a super_admin row outside super-admin context (no tenant)', async () => {
    await expect(insertAs({ superAdmin: false, schoolId: null }, 'super_admin')).rejects.toThrow(
      /missing tenant context/,
    );
  });

  test('a super_admin row outside super-admin context (school context)', async () => {
    // The school is filled in from context, which the scope CHECK forbids for super_admin.
    await expect(
      insertAs({ superAdmin: false, schoolId: fx.a.schoolId }, 'super_admin'),
    ).rejects.toThrow(/auth_sessions_school_scope_check/);
  });

  test('control: a school role in its school context still gets the school filled in', async () => {
    const jti = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.is_super_admin', '0', true),
               set_config('app.school_id', ${String(fx.a.schoolId)}, true)`;
      const rows = await tx.$queryRaw<{ jti: string; school_id: number }[]>`
        INSERT INTO auth_sessions (jti, family_id, user_role, user_id, school_id, client, expires_at)
        VALUES (gen_random_uuid(), gen_random_uuid(), 'admin', ${fx.a.admin.id}, NULL, 'web', now() + interval '1 day')
        RETURNING jti, school_id`;
      expect(rows[0]!.school_id).toBe(fx.a.schoolId);
      return rows[0]!.jti;
    });
    await asSuperAdmin(async () => await prisma.auth_sessions.delete({ where: { jti } }));
  });
});
