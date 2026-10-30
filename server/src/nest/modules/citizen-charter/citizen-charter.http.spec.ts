import { denied, describeHttp, run, setupWorld, teardownWorld } from '../../common/http-world.js';
import type { World } from '../../common/http-world.js';

describeHttp('citizen-charter (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const URL = '/api/citizen-charter/upload-url?filename=c.pdf&contentType=application/pdf';

  test('roles: document is public, upload URL and replace are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/citizen-charter/document', expect: 404 },
      ...denied('get', URL),
      ...denied('put', '/api/citizen-charter/document', ['adminA'], { key: 'k' }),
    ]);
  });

  test('validation: PDFs only, key required, unknown fields', async () => {
    await run(w, [
      { method: 'get', path: '/api/citizen-charter/upload-url', as: 'adminA', expect: 400 },
      {
        method: 'get',
        path: '/api/citizen-charter/upload-url?filename=c.png&contentType=image/png',
        as: 'adminA',
        expect: 400,
      },
      { method: 'put', path: '/api/citizen-charter/document', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'put',
        path: '/api/citizen-charter/document',
        as: 'adminA',
        body: { key: 'k', x: 1 },
        expect: 400,
      },
    ]);
  });

  test('create, replace (old object deleted), isolated per school', async () => {
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
        method: 'put',
        path: '/api/citizen-charter/document',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ key: c.k }),
        expect: 403,
      },
      {
        method: 'put',
        path: '/api/citizen-charter/document',
        as: 'adminA',
        body: (c) => ({ key: c.k }),
        expect: 200,
      },
      {
        method: 'get',
        path: '/api/citizen-charter/document',
        expect: 200,
        check: (b, c) => expect(JSON.stringify(b.data)).toContain(c.k),
      },
      { method: 'get', path: '/api/citizen-charter/document', host: 'b', expect: 404 },
      {
        method: 'put',
        path: '/api/citizen-charter/document',
        as: 'adminA',
        body: (c) => ({ key: c.k2 }),
        expect: 200,
      },
      {
        method: 'get',
        path: '/api/citizen-charter/document',
        expect: 200,
        check: (b, c) => expect(JSON.stringify(b.data)).toContain(c.k2),
      },
    ]);
    expect(sideEffects.some((l) => l.startsWith('S3 DELETE'))).toBe(true);
  });
});
