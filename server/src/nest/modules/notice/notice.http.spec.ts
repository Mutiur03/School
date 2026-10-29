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

describeHttp('notices (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
    await clearRedis(['notices:*']);
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const URL = '/api/notices/upload-url?filename=n.pdf&contentType=application/pdf';

  test('roles: list is public, writes and upload URLs are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/notices', expect: 200 },
      ...denied('get', URL),
      ...denied('post', '/api/notices', ['adminA'], { title: 't', key: 'k' }),
      ...denied('patch', '/api/notices/1', ['adminA'], { title: 't' }),
      ...denied('delete', '/api/notices/1'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      { method: 'get', path: '/api/notices?limit=0', expect: 400 },
      { method: 'get', path: '/api/notices/upload-url', as: 'adminA', expect: 400 },
      { method: 'post', path: '/api/notices', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'post',
        path: '/api/notices',
        as: 'adminA',
        body: { title: 'x'.repeat(300), key: 'k' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/notices',
        as: 'adminA',
        body: { title: 't', key: 'k', school_id: 1 },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/notices',
        as: 'adminA',
        body: { title: 't', key: 'k', created_at: 'soon' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/notices/abc',
        as: 'adminA',
        body: { title: 't' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/notices/1',
        as: 'adminA',
        body: { pinned: true },
        expect: 400,
      },
    ]);
  });

  test('upload → create → list → update → delete, isolated per school', async () => {
    const { sideEffects } = await run(w, [
      {
        method: 'get',
        path: URL,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.k = b.data.key),
        check: (b, c) => {
          expect(b.data.key).toMatch(new RegExp(`^${c.schoolA}/notices/.+\\.pdf$`));
          expect(b.data.uploadUrl).toContain(b.data.key);
        },
      },
      // school B cannot attach school A's object
      {
        method: 'post',
        path: '/api/notices',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ title: 'Stolen', key: c.k }),
        expect: 403,
      },
      {
        method: 'post',
        path: '/api/notices',
        as: 'adminA',
        body: (c) => ({ title: 'REST notice', key: c.k }),
        expect: 201,
        save: (b, c) => (c.n = b.data.id),
        check: (b) => expect(b.data).toMatchObject({ title: 'REST notice' }),
      },
      {
        method: 'get',
        path: '/api/notices?limit=5',
        expect: 200,
        check: (b, c) =>
          expect(find(b.data, (o) => o.id === c.n)).toMatchObject({ title: 'REST notice' }),
      },
      {
        method: 'get',
        path: '/api/notices',
        host: 'b',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.n)).toBeUndefined(),
      },
      {
        method: 'patch',
        path: (c) => `/api/notices/${c.n}`,
        as: 'adminB',
        host: 'b',
        body: { title: 'x' },
        expect: 404,
      },
      {
        method: 'delete',
        path: (c) => `/api/notices/${c.n}`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/notices/${c.n}`,
        as: 'adminA',
        body: { title: 'Renamed' },
        expect: 200,
        check: (b) => expect(b.data.title).toBe('Renamed'),
      },
      {
        method: 'get',
        path: '/api/notices',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.n)?.title).toBe('Renamed'),
      },
      {
        method: 'patch',
        path: `/api/notices/${MISSING_ID}`,
        as: 'adminA',
        body: { title: 'x' },
        expect: 404,
      },
      { method: 'delete', path: (c) => `/api/notices/${c.n}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/notices/${c.n}`, as: 'adminA', expect: 404 },
    ]);
    expect(sideEffects.some((l) => l.startsWith('S3 DELETE') && l.includes('/notices/'))).toBe(
      true,
    );
  });
});
