import {
  MISSING_ID,
  denied,
  describeHttp,
  find,
  run,
  setupWorld,
  teardownWorld,
} from '../../common/http-world.js';
import type { World } from '../../common/http-world.js';

describeHttp('events (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const IMG = '/api/events/upload-url?type=image&filename=e.jpg&contentType=image/jpeg';
  const FILE = '/api/events/upload-url?type=file&filename=e.pdf&contentType=application/pdf';

  test('roles: list is public, writes and upload URLs are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/events', expect: 200 },
      ...denied('get', IMG),
      ...denied('post', '/api/events', ['adminA'], { title: 't', date: '2030-01-01' }),
      ...denied('patch', '/api/events/1', ['adminA'], { title: 't' }),
      ...denied('delete', '/api/events/1'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      {
        method: 'get',
        path: '/api/events/upload-url?type=video&filename=a&contentType=x',
        as: 'adminA',
        expect: 400,
      },
      { method: 'get', path: '/api/events/upload-url?type=image', as: 'adminA', expect: 400 },
      {
        method: 'post',
        path: '/api/events',
        as: 'adminA',
        body: { title: 'No date' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/events',
        as: 'adminA',
        body: { title: 't', date: 'someday' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/events',
        as: 'adminA',
        body: { title: 't', date: '2030-01-01', school_id: 1 },
        expect: 400,
      },
      { method: 'patch', path: '/api/events/abc', as: 'adminA', body: { title: 't' }, expect: 400 },
      {
        method: 'patch',
        path: '/api/events/1',
        as: 'adminA',
        body: { featured: true },
        expect: 400,
      },
    ]);
  });

  test('upload image + file → create → update → delete, isolated per school', async () => {
    const { sideEffects } = await run(w, [
      {
        method: 'get',
        path: IMG,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.img = b.data.key),
        check: (b, c) => {
          expect(b.data.key).toMatch(new RegExp(`^${c.schoolA}/`));
          expect(b.data.uploadUrl).toContain(b.data.key);
        },
      },
      {
        method: 'get',
        path: FILE,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.file = b.data.key),
      },
      {
        method: 'post',
        path: '/api/events',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ title: 'Stolen', date: '2030-01-02', imageKey: c.img }),
        expect: 403,
      },
      {
        method: 'post',
        path: '/api/events',
        as: 'adminA',
        body: (c) => ({
          title: 'REST event',
          date: '2030-01-02',
          location: 'Hall',
          imageKey: c.img,
          fileKey: c.file,
        }),
        expect: 201,
        save: (b, c) => (c.ev = b.data.id),
        check: (b) => expect(b.data).toMatchObject({ title: 'REST event', location: 'Hall' }),
      },
      {
        method: 'get',
        path: '/api/events',
        expect: 200,
        check: (b, c) =>
          expect(find(b.data, (o) => o.id === c.ev)).toMatchObject({ title: 'REST event' }),
      },
      {
        method: 'get',
        path: '/api/events',
        host: 'b',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.ev)).toBeUndefined(),
      },
      {
        method: 'patch',
        path: (c) => `/api/events/${c.ev}`,
        as: 'adminB',
        host: 'b',
        body: { title: 'x' },
        expect: 404,
      },
      {
        method: 'delete',
        path: (c) => `/api/events/${c.ev}`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/events/${c.ev}`,
        as: 'adminA',
        body: { title: 'Renamed event' },
        expect: 200,
        check: (b) => expect(b.data.title).toBe('Renamed event'),
      },
      {
        method: 'patch',
        path: `/api/events/${MISSING_ID}`,
        as: 'adminA',
        body: { title: 'x' },
        expect: 404,
      },
      { method: 'delete', path: (c) => `/api/events/${c.ev}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/events/${c.ev}`, as: 'adminA', expect: 404 },
    ]);
    expect(sideEffects.filter((l) => l.startsWith('S3 DELETE')).length).toBeGreaterThanOrEqual(2);
  });
});
