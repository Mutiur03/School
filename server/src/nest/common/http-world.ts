import type { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import { signAccessToken } from '../../modules/auth/auth-tokens.js';
import { asSuperAdmin } from './http-test.js';
import { closeAppResources, seedTwoSchools } from './two-schools.fixture.js';

/**
 * World for module http specs: the real app, two seeded schools (admin, teacher, student and one
 * event each), signed tokens, and `run()` which sends a request script and checks every step's
 * status, the `{ success }` envelope and an optional per-step `check`. R2/SMS calls go to the fake
 * server (scripts/ci/fake-r2-sms.mjs); `run()` returns what it logged.
 */
export const MOCK = process.env.R2_ENDPOINT ?? 'http://127.0.0.1:9900';
/** Needs the fake R2/SMS server; skipped otherwise so a bare `pnpm test:nest` stays usable. */
export const HAS_FAKES = !!process.env.R2_ENDPOINT && !!process.env.SMSPIT_URL;
export const describeHttp = HAS_FAKES ? describe : describe.skip;

export type Who =
  'none' | 'adminA' | 'adminB' | 'studentA' | 'studentB' | 'teacherA' | 'teacherB' | 'superAdmin';
/** A super-admin host (utils/superAdminDomain.ts): no school resolves from it. */
export const SUPER_HOST = 'admin.localhost';
export type Host = 'a' | 'b' | 'super';
export type Ctx = Record<string, any>;
export type Step = {
  as?: Who;
  /** `super` = the super-admin host, not a tenant. */
  host?: Host;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string | ((c: Ctx) => string);
  body?: object | ((c: Ctx) => unknown);
  expect: number;
  /** Saves ids/keys for later steps. Runs before `check`. */
  save?: (body: any, c: Ctx) => void;
  check?: (body: any, c: Ctx) => void;
  /** File response: the body is a Buffer (no envelope check). */
  binary?: boolean;
};

export interface World {
  app: Express;
  fx: Awaited<ReturnType<typeof seedTwoSchools>>;
  tokens: Record<Exclude<Who, 'none'>, string>;
  ids: { teacherA: number; teacherB: number; eventA: number; eventB: number };
  superAdminId: number;
}

export async function setupWorld(): Promise<World> {
  const app = await createApp();
  const fx = await seedTwoSchools();
  const password = await bcrypt.hash('Fixture-pass-1', 4);
  const ids = { teacherA: 0, teacherB: 0, eventA: 0, eventB: 0 };
  await asSuperAdmin(async () => {
    for (const k of ['a', 'b'] as const) {
      const school = fx[k];
      const t = await prisma.teachers.create({
        data: {
          name: `Teacher ${k}`,
          email: `world-${school.schoolId}-${k}@example.test`,
          phone: '01700000000',
          password,
          school_id: school.schoolId,
        },
      });
      ids[k === 'a' ? 'teacherA' : 'teacherB'] = t.id;
      const ev = await prisma.events.create({
        data: { title: `Event ${k}`, date: '2030-01-01', school_id: school.schoolId } as any,
      });
      ids[k === 'a' ? 'eventA' : 'eventB'] = ev.id;
    }
  });
  const sign = (id: number, role: string, sch: number) => signAccessToken({ id, role, sch } as any);
  const tokens = {
    adminA: sign(fx.a.admin.id, 'admin', fx.a.schoolId),
    adminB: sign(fx.b.admin.id, 'admin', fx.b.schoolId),
    studentA: sign(fx.a.student.id, 'student', fx.a.schoolId),
    studentB: sign(fx.b.student.id, 'student', fx.b.schoolId),
    teacherA: sign(ids.teacherA, 'teacher', fx.a.schoolId),
    teacherB: sign(ids.teacherB, 'teacher', fx.b.schoolId),
  };
  const superRow = await asSuperAdmin(async () =>
    prisma.superAdmin.create({
      data: { email: `world-super-${fx.a.schoolId}@example.test`, password },
    }),
  );
  const superAdmin = signAccessToken({ id: superRow.id, role: 'super_admin', sch: null } as any);
  return { app, fx, tokens: { ...tokens, superAdmin }, ids, superAdminId: superRow.id };
}

export async function teardownWorld(w?: World) {
  if (w)
    await asSuperAdmin(async () => prisma.superAdmin.deleteMany({ where: { id: w.superAdminId } }));
  await w?.fx.cleanup();
  await closeAppResources();
}

/** One request as `who` on school A's (or B's) host. */
export function call(w: World, who: Who, method: Step['method'], path: string, host: Host = 'a') {
  const h = host === 'super' ? SUPER_HOST : (host === 'a' ? w.fx.a : w.fx.b).host;
  let req = request(w.app)[method](path).set('x-tenant-host', h);
  if (who !== 'none') req = req.set('authorization', `Bearer ${w.tokens[who]}`);
  return req;
}

const mockLog = async (): Promise<string[]> => (await fetch(`${MOCK}/__log`)).json();

export async function clearRedis(patterns: string[]) {
  for (const p of patterns) {
    const keys = await redis.keys(p);
    if (keys.length) await redis.del(...keys);
  }
}

const ctxOf = (w: World, c: Ctx) => ({ ...c, schoolA: w.fx.a.schoolId, schoolB: w.fx.b.schoolId });

/**
 * Runs the script. Fails with the full `METHOD path as who@host -> status` list when any status
 * differs, checks `success: true` on 2xx and `success: false` on errors, then each step's `check`.
 * Returns the fake R2/SMS log lines produced by the script.
 */
export async function run(w: World, steps: Step[], ctx: Ctx = {}) {
  const c: Ctx = { ...w.ids, ...ctx };
  await mockLog();
  const got: string[] = [];
  const want: string[] = [];
  const bodies: any[] = [];
  for (const s of steps) {
    const path = typeof s.path === 'function' ? s.path(ctxOf(w, c)) : s.path;
    const body = typeof s.body === 'function' ? (s.body as any)(ctxOf(w, c)) : s.body;
    let req = call(w, s.as ?? 'none', s.method, path, s.host);
    if (s.binary)
      req = req.buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (x: Buffer) => chunks.push(x));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const res = body === undefined ? await req : await req.send(body as any);
    const label = `${s.method.toUpperCase()} ${path} as ${s.as ?? 'none'}@${s.host ?? 'a'}`;
    got.push(`${label} -> ${res.status}`);
    want.push(`${label} -> ${s.expect}`);
    // a refused file request still answers with the JSON error envelope
    bodies.push(
      s.binary && res.status >= 300 && Buffer.isBuffer(res.body)
        ? JSON.parse(res.body.toString('utf8') || 'null')
        : res.body,
    );
    if (res.status === s.expect) s.save?.(res.body, c);
  }
  expect(got).toEqual(want);
  steps.forEach((s, i) => {
    const b = bodies[i];
    if (s.binary && s.expect < 300) expect(Buffer.isBuffer(b) && b.length > 0).toBe(true);
    else if (s.expect < 300 && b && typeof b === 'object' && !Buffer.isBuffer(b) && 'success' in b)
      expect(b.success).toBe(true);
    if (s.expect >= 400) expect(b).toMatchObject({ success: false });
    s.check?.(b, ctxOf(w, c));
  });
  return { ctx: c, bodies, sideEffects: await mockLog() };
}

/**
 * Role matrix for one endpoint: anonymous → 401, every tenant role not in `allow` → 403, and a
 * school-B admin token on school A's host → 403. Body defaults to `{}` for writes.
 */
export function denied(
  method: Step['method'],
  path: string | ((c: Ctx) => string),
  allow: ('adminA' | 'teacherA' | 'studentA')[] = ['adminA'],
  body?: Step['body'],
): Step[] {
  const b = body ?? (method === 'get' || method === 'delete' ? undefined : {});
  const out: Step[] = [{ method, path, body: b, expect: 401 }];
  for (const who of ['adminA', 'teacherA', 'studentA'] as const) {
    if (!allow.includes(who)) out.push({ method, path, body: b, as: who, expect: 403 });
  }
  out.push({ method, path, body: b, as: 'adminB', expect: 403 });
  return out;
}

/** First nested object matching `pred` (response shapes vary: arrays, pages, groups). */
export const find = (v: unknown, pred: (o: any) => boolean): any => {
  if (!v || typeof v !== 'object') return undefined;
  if (!Array.isArray(v) && pred(v)) return v;
  for (const x of Object.values(v)) {
    const hit = find(x, pred);
    if (hit) return hit;
  }
  return undefined;
};

/** A row id that exists in no school. */
export const MISSING_ID = 99999999;
