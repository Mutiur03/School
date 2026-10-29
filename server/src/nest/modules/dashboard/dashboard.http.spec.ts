import { denied, describeHttp, run, setupWorld, teardownWorld } from '../../common/http-world.js';
import type { World } from '../../common/http-world.js';

describeHttp('dashboard (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  test('roles: admin only, own school only', async () => {
    await run(w, [
      ...denied('get', '/api/dashboard/overview'),
      ...denied('get', '/api/dashboard/attendance-summary'),
    ]);
  });

  test('overview counts only the host school', async () => {
    const { bodies } = await run(w, [
      { method: 'get', path: '/api/dashboard/overview', as: 'adminA', expect: 200 },
      { method: 'get', path: '/api/dashboard/overview', as: 'adminB', host: 'b', expect: 200 },
    ]);
    const [a, b] = bodies.map((x) => x.data);
    // each fixture school has one student, one teacher and one event
    for (const d of [a, b]) {
      expect(d.quickStats).toEqual({ students: 1, teachers: 1, events: 1 });
      expect(d).toMatchObject({ announcements: [], examSchedule: [] });
    }
    expect(a.events.map((e: any) => e.title)).toEqual(['Event a']);
    expect(b.events.map((e: any) => e.title)).toEqual(['Event b']);
  });

  test('attendance summary: windows 7/15/30 only', async () => {
    await run(w, [
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary',
        as: 'adminA',
        expect: 200,
        check: (b) => expect(b.data).toBeDefined(),
      },
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary?days=15',
        as: 'adminA',
        expect: 200,
      },
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary?days=30',
        as: 'adminA',
        expect: 200,
      },
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary?days=9',
        as: 'adminA',
        expect: 400,
        check: (b) => expect(b.message).toMatch(/7, 15, 30/),
      },
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary?days=abc',
        as: 'adminA',
        expect: 400,
      },
      {
        method: 'get',
        path: '/api/dashboard/attendance-summary?attendanceDays=7',
        as: 'adminA',
        expect: 400,
      },
    ]);
  });
});
