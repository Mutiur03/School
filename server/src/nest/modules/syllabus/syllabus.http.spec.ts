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

describeHttp('syllabuses (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
    await clearRedis(['syllabus_*']);
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const URL = '/api/syllabuses/upload-url?filename=s.pdf&contentType=application/pdf';

  test('roles: list is public, writes and upload URLs are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/syllabuses', expect: 200 },
      ...denied('get', URL),
      ...denied('post', '/api/syllabuses', ['adminA'], { key: 'k', class: 6, year: 2030 }),
      ...denied('patch', '/api/syllabuses/1', ['adminA'], { year: 2031 }),
      ...denied('delete', '/api/syllabuses/1'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      { method: 'get', path: '/api/syllabuses?class=13', expect: 400 },
      { method: 'get', path: '/api/syllabuses?year=1999', expect: 400 },
      { method: 'get', path: '/api/syllabuses/upload-url', as: 'adminA', expect: 400 },
      {
        method: 'post',
        path: '/api/syllabuses',
        as: 'adminA',
        body: { key: 'k', class: 13, year: 2030 },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/syllabuses',
        as: 'adminA',
        body: { class: 6, year: 2030 },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/syllabuses',
        as: 'adminA',
        body: { key: 'k', class: 6, year: 2030, x: 1 },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/syllabuses/abc',
        as: 'adminA',
        body: { year: 2031 },
        expect: 400,
      },
    ]);
  });

  test('upload → create → filter → update → delete, isolated per school', async () => {
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
      {
        method: 'post',
        path: '/api/syllabuses',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ key: c.k, class: 6, year: 2030 }),
        expect: 403,
      },
      {
        method: 'post',
        path: '/api/syllabuses',
        as: 'adminA',
        body: (c) => ({ key: c.k, class: 6, year: 2030 }),
        expect: 201,
        save: (b, c) => (c.s = b.data.id),
        check: (b) => expect(b.data).toMatchObject({ class: 6, year: 2030 }),
      },
      {
        method: 'get',
        path: '/api/syllabuses?class=6&year=2030',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.s)).toBeDefined(),
      },
      {
        method: 'get',
        path: '/api/syllabuses?class=7&year=2030',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.s)).toBeUndefined(),
      },
      {
        method: 'get',
        path: '/api/syllabuses?class=6&year=2030',
        host: 'b',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.s)).toBeUndefined(),
      },
      {
        method: 'patch',
        path: (c) => `/api/syllabuses/${c.s}`,
        as: 'adminB',
        host: 'b',
        body: { year: 2031 },
        expect: 404,
      },
      {
        method: 'delete',
        path: (c) => `/api/syllabuses/${c.s}`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/syllabuses/${c.s}`,
        as: 'adminA',
        body: { year: 2031 },
        expect: 200,
        check: (b) => expect(b.data.year).toBe(2031),
      },
      // the cache is invalidated on write
      {
        method: 'get',
        path: '/api/syllabuses?class=6&year=2031',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.s)).toBeDefined(),
      },
      {
        method: 'patch',
        path: `/api/syllabuses/${MISSING_ID}`,
        as: 'adminA',
        body: { year: 2031 },
        expect: 404,
      },
      { method: 'delete', path: (c) => `/api/syllabuses/${c.s}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/syllabuses/${c.s}`, as: 'adminA', expect: 404 },
    ]);
    expect(sideEffects.some((l) => l.startsWith('S3 DELETE'))).toBe(true);
  });
});
