import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { redis } from '../../config/redis.js';
import { runWithRlsContext } from '../../config/rlsContextStore.js';
import { attendanceSheetQueue } from '../../modules/attendence/attendence-sheet.queue.js';
import { MARKSHEET_QUEUE } from '../modules/marksheets/jobs/marksheet.queue.js';
import type { MarksheetQueue } from '../modules/marksheets/jobs/marksheet.queue.js';
import { nestApp } from './nest-app.js';

/**
 * Boots the real app on port 0 as a seeded school admin (real DB). Call `start()` in beforeAll and
 * `stop()` in afterAll; `call()` sends a request with the tenant header and an optional bearer token.
 */
export function httpTest() {
  let server: Server;
  let base = '';
  let host = '';
  let token = '';

  return {
    async start() {
      const app = await createApp();
      server = app.listen(0);
      await new Promise((r) => server.once('listening', r));
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      const admin = await runWithRlsContext(
        { isSuperAdmin: true },
        async () =>
          await prisma.admin.findFirst({ where: { role: 'admin' }, include: { school: true } }),
      );
      if (!admin?.school?.subdomain) throw new Error('need a seeded admin with a school subdomain');
      host = `${admin.school.subdomain}.localhost`;
      token = jwt.sign({ id: admin.id, role: 'admin' }, env.JWT_SECRET);
    },

    async stop() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await Promise.all([
        nestApp().get<MarksheetQueue>(MARKSHEET_QUEUE).close(),
        attendanceSheetQueue.close(),
        prisma.$disconnect(),
      ]);
      redis.disconnect();
    },

    async call(method: string, path: string, opts: { auth?: boolean; body?: unknown } = {}) {
      const res = await fetch(base + path, {
        method,
        headers: {
          'x-tenant-host': host,
          'content-type': 'application/json',
          ...(opts.auth ? { authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* PDF or empty body */
      }
      return { status: res.status, body, headers: res.headers };
    },
  };
}

/** Runs `fn` as super admin, for seeding and cleaning rows outside the request path. */
export const asSuperAdmin = <T>(fn: () => Promise<T>) =>
  runWithRlsContext({ isSuperAdmin: true }, fn);
