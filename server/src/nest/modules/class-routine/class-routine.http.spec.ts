import {
  MISSING_ID,
  clearRedis,
  denied,
  describeHttp,
  find,
  run,
  setupWorld,
  teardownWorld,
} from '../../common/http-world.js';
import type { World } from '../../common/http-world.js';

describeHttp('class-routines (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
    await clearRedis(['class_routine_pdfs*']);
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const URL = '/api/class-routines/upload-url?filename=r.pdf&contentType=application/pdf';

  test('roles: list is public, writes and upload URLs are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/class-routines', expect: 200 },
      ...denied('get', URL),
      ...denied('post', '/api/class-routines', ['adminA'], { key: 'k' }),
      ...denied('patch', '/api/class-routines/1', ['adminA'], { key: 'k' }),
      ...denied('delete', '/api/class-routines/1'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      { method: 'get', path: '/api/class-routines/upload-url', as: 'adminA', expect: 400 },
      { method: 'post', path: '/api/class-routines', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'post',
        path: '/api/class-routines',
        as: 'adminA',
        body: { key: 'k', x: 1 },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/class-routines/abc',
        as: 'adminA',
        body: { key: 'k' },
        expect: 400,
      },
    ]);
  });

  test('upload → create → replace file → delete, isolated per school', async () => {
    const { sideEffects } = await run(w, [
      {
        method: 'get',
        path: URL,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.k = b.data.key),
        check: (b, c) => {
          expect(b.data.key).toMatch(new RegExp(`^${c.schoolA}/`));
          expect(b.data.uploadUrl).toContain(b.data.key);
        },
      },
      { method: 'get', path: URL, as: 'adminA', expect: 200, save: (b, c) => (c.k2 = b.data.key) },
      {
        method: 'post',
        path: '/api/class-routines',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ key: c.k }),
        expect: 403,
      },
      {
        method: 'post',
        path: '/api/class-routines',
        as: 'adminA',
        body: (c) => ({ key: c.k }),
        expect: 201,
        save: (b, c) => (c.r = b.data.id),
      },
      {
        method: 'get',
        path: '/api/class-routines',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.r)).toBeDefined(),
      },
      {
        method: 'get',
        path: '/api/class-routines',
        host: 'b',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.r)).toBeUndefined(),
      },
      {
        method: 'patch',
        path: (c) => `/api/class-routines/${c.r}`,
        as: 'adminB',
        host: 'b',
        body: (c) => ({ key: c.k2 }),
        expect: 404,
      },
      {
        method: 'delete',
        path: (c) => `/api/class-routines/${c.r}`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/class-routines/${c.r}`,
        as: 'adminA',
        body: (c) => ({ key: c.k2 }),
        expect: 200,
      },
      {
        method: 'patch',
        path: `/api/class-routines/${MISSING_ID}`,
        as: 'adminA',
        body: (c) => ({ key: c.k2 }),
        expect: 404,
      },
      { method: 'delete', path: (c) => `/api/class-routines/${c.r}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/class-routines/${c.r}`, as: 'adminA', expect: 404 },
    ]);
    // the replaced file and the final file are both removed from R2
    expect(sideEffects.filter((l) => l.startsWith('S3 DELETE')).length).toBeGreaterThanOrEqual(2);
  });
});
