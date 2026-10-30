import {
  MISSING_ID,
  call,
  denied,
  describeHttp,
  find,
  run,
  setupWorld,
  teardownWorld,
} from '../../common/http-world.js';
import type { Ctx, World } from '../../common/http-world.js';

const UPLOAD = '/api/gallery/upload-url?filename=g.jpg&contentType=image/jpeg';
const captions = (b: any) => JSON.stringify(b);

describeHttp('gallery (http)', () => {
  let w: World;
  const c: Ctx = {};
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const presign = async (
    who: 'adminA' | 'teacherA' | 'studentA' | 'adminB',
    host: 'a' | 'b' = 'a',
  ) => (await call(w, who, 'get', UPLOAD, host)).body.data.key as string;

  test('roles per endpoint', async () => {
    await run(w, [
      { method: 'get', path: '/api/gallery', expect: 200 },
      { method: 'get', path: '/api/gallery/categories', expect: 200 },
      { method: 'get', path: '/api/gallery/categories/1/images', expect: 200 },
      { method: 'get', path: '/api/gallery/events/1/images', expect: 200 },
      ...denied('get', UPLOAD, ['adminA', 'teacherA', 'studentA']),
      ...denied('post', '/api/gallery/images', ['adminA', 'teacherA', 'studentA'], { keys: ['k'] }),
      ...denied('get', '/api/gallery/images?status=pending'),
      ...denied('get', '/api/gallery/my-images?status=pending', ['studentA']),
      ...denied('patch', '/api/gallery/images', ['adminA'], { ids: [1], status: 'rejected' }),
      ...denied('delete', '/api/gallery/images', ['adminA'], { ids: [1] }),
      ...denied('patch', '/api/gallery/images/1', ['adminA'], { caption: 'x' }),
      ...denied('patch', '/api/gallery/images/1/status', ['adminA'], { status: 'approved' }),
      ...denied('delete', '/api/gallery/images/1'),
      ...denied('post', '/api/gallery/categories', ['adminA'], { category: 'x' }),
      ...denied('patch', '/api/gallery/categories/1/images', ['adminA'], { status: 'rejected' }),
      ...denied('put', '/api/gallery/categories/1/thumbnail', ['adminA'], { imageId: 1 }),
      ...denied('delete', '/api/gallery/events/1/images'),
      ...denied('put', '/api/gallery/events/1/thumbnail', ['adminA'], { imageId: 1 }),
    ]);
  });

  test('validation and unknown fields', async () => {
    await run(w, [
      { method: 'get', path: '/api/gallery/upload-url', as: 'adminA', expect: 400 },
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'adminA',
        body: { keys: [] },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'adminA',
        body: { keys: [''] },
        expect: 400,
      },
      // the client may not choose the moderation status
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'studentA',
        body: { keys: ['k'], status: 'approved' },
        expect: 400,
      },
      { method: 'get', path: '/api/gallery/images', as: 'adminA', expect: 400 },
      { method: 'get', path: '/api/gallery/images?status=approved', as: 'adminA', expect: 400 },
      { method: 'get', path: '/api/gallery/my-images?status=maybe', as: 'studentA', expect: 400 },
      {
        method: 'patch',
        path: '/api/gallery/images',
        as: 'adminA',
        body: { ids: [1], status: 'approved' },
        expect: 400,
      },
      {
        method: 'delete',
        path: '/api/gallery/images',
        as: 'adminA',
        body: { ids: [] },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/gallery/images/1/status',
        as: 'adminA',
        body: { status: 'maybe' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/gallery/images/abc',
        as: 'adminA',
        body: { caption: 'x' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/gallery/images/1',
        as: 'adminA',
        body: { status: 'approved' },
        expect: 400,
      },
      { method: 'post', path: '/api/gallery/categories', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'post',
        path: '/api/gallery/categories',
        as: 'adminA',
        body: { category: 'x', school_id: 1 },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/gallery/categories/1/images',
        as: 'adminA',
        body: { status: 'approved' },
        expect: 400,
      },
      {
        method: 'put',
        path: '/api/gallery/categories/1/thumbnail',
        as: 'adminA',
        body: { imageId: 0 },
        expect: 400,
      },
    ]);
  });

  test('status is set by the server: admin → approved, teacher/student → pending', async () => {
    const [ka, kt, ks] = [
      await presign('adminA'),
      await presign('teacherA'),
      await presign('studentA'),
    ];
    expect(ka).toMatch(new RegExp(`^${w.fx.a.schoolId}/`));
    const res = await run(w, [
      {
        method: 'post',
        path: '/api/gallery/categories',
        as: 'adminA',
        body: { category: 'Campus' },
        expect: 201,
        save: (b, x) => (x.cat = b.data.id),
      },
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'adminA',
        body: (x) => ({ keys: [ka], caption: 'By admin', categoryId: x.cat }),
        expect: 201,
        check: (b) => expect(b.data).toEqual({ count: 1 }),
      },
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'teacherA',
        body: (x) => ({ keys: [kt], caption: 'By teacher', eventId: x.eventA }),
        expect: 201,
      },
      {
        method: 'post',
        path: '/api/gallery/images',
        as: 'studentA',
        body: (x) => ({ keys: [ks], caption: 'By student', categoryId: x.cat }),
        expect: 201,
      },
      {
        method: 'get',
        path: '/api/gallery',
        expect: 200,
        check: (b) => {
          expect(Object.keys(b.data)).toEqual(['events', 'categories']);
          expect(b.data.categories.Campus.map((i: any) => i.caption)).toEqual(['By admin']);
          expect(captions(b)).not.toMatch(/By teacher|By student/);
        },
      },
      {
        method: 'get',
        path: '/api/gallery/images?status=pending',
        as: 'adminA',
        expect: 200,
        save: (b, x) => {
          x.pendS = find(b, (o) => o.caption === 'By student')?.id;
          x.pendT = find(b, (o) => o.caption === 'By teacher')?.id;
        },
        check: (b) => {
          expect(captions(b)).toMatch(/By teacher/);
          expect(captions(b)).toMatch(/By student/);
          expect(captions(b)).not.toMatch(/By admin/);
        },
      },
      {
        method: 'get',
        path: '/api/gallery/my-images?status=pending',
        as: 'studentA',
        expect: 200,
        check: (b) => expect(captions(b)).toMatch(/By student/),
      },
      {
        method: 'get',
        path: '/api/gallery/my-images?status=pending',
        as: 'studentB',
        host: 'b',
        expect: 200,
        check: (b) => expect(captions(b)).not.toMatch(/By student/),
      },
      {
        method: 'get',
        path: '/api/gallery/images?status=pending',
        as: 'adminB',
        host: 'b',
        expect: 200,
        check: (b) => expect(captions(b)).not.toMatch(/By student|By teacher/),
      },
    ]);
    Object.assign(c, res.ctx);
  });

  test('moderation, thumbnails, deletes; school B cannot touch school A', async () => {
    const { sideEffects } = await run(
      w,
      [
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.pendS}/status`,
          as: 'adminB',
          host: 'b',
          body: { status: 'approved' },
          expect: 404,
        },
        {
          method: 'patch',
          path: `/api/gallery/images/${MISSING_ID}/status`,
          as: 'adminA',
          body: { status: 'approved' },
          expect: 404,
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.pendS}/status`,
          as: 'adminA',
          body: { status: 'approved' },
          expect: 200,
          check: (b) => expect(b.data.status).toBe('approved'),
        },
        {
          method: 'get',
          path: (x) => `/api/gallery/categories/${x.cat}/images`,
          expect: 200,
          check: (b) => expect(captions(b)).toMatch(/By student/),
        },
        {
          method: 'get',
          path: (x) => `/api/gallery/categories/${x.cat}/images`,
          host: 'b',
          expect: 200,
          check: (b) => expect(b.data).toEqual([]),
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.pendS}`,
          as: 'adminB',
          host: 'b',
          body: { caption: 'x' },
          expect: 404,
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.pendS}`,
          as: 'adminA',
          body: { caption: 'Renamed' },
          expect: 200,
          check: (b) => expect(b.data.caption).toBe('Renamed'),
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/categories/${x.cat}/thumbnail`,
          as: 'adminB',
          host: 'b',
          body: (x) => ({ imageId: x.pendS }),
          expect: 404,
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/categories/${x.cat}/thumbnail`,
          as: 'adminA',
          body: (x) => ({ imageId: x.pendS }),
          expect: 200,
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/events/${x.eventA}/thumbnail`,
          as: 'adminA',
          body: (x) => ({ imageId: x.pendS }),
          expect: 200,
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/events/${x.eventB}/thumbnail`,
          as: 'adminB',
          host: 'b',
          body: (x) => ({ imageId: x.pendS }),
          expect: 404,
        },
        // bulk reject + category reject only touch the host school
        {
          method: 'patch',
          path: '/api/gallery/images',
          as: 'adminB',
          host: 'b',
          body: (x) => ({ ids: [x.pendT], status: 'rejected' }),
          expect: 200,
          check: (b) => expect(b.data.count).toBe(0),
        },
        {
          method: 'patch',
          path: '/api/gallery/images',
          as: 'adminA',
          body: (x) => ({ ids: [x.pendT], status: 'rejected' }),
          expect: 200,
          check: (b) => expect(b.data.count).toBe(1),
        },
        {
          method: 'get',
          path: '/api/gallery/images?status=rejected',
          as: 'adminA',
          expect: 200,
          check: (b) => expect(captions(b)).toMatch(/By teacher/),
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/categories/${x.cat}/images`,
          as: 'adminB',
          host: 'b',
          body: { status: 'rejected' },
          expect: 200,
          check: (b) => expect(b.data.count).toBe(0),
        },
        { method: 'get', path: (x) => `/api/gallery/events/${x.eventA}/images`, expect: 200 },
        {
          method: 'delete',
          path: (x) => `/api/gallery/images/${x.pendS}`,
          as: 'adminB',
          host: 'b',
          expect: 404,
        },
        {
          method: 'delete',
          path: '/api/gallery/images',
          as: 'adminB',
          host: 'b',
          body: (x) => ({ ids: [x.pendT] }),
          expect: 200,
        },
        {
          method: 'delete',
          path: (x) => `/api/gallery/events/${x.eventA}/images`,
          as: 'adminB',
          host: 'b',
          expect: 200,
        },
        {
          method: 'get',
          path: '/api/gallery/images?status=rejected',
          as: 'adminA',
          expect: 200,
          check: (b) => expect(captions(b)).toMatch(/By teacher/),
        },
        {
          method: 'delete',
          path: (x) => `/api/gallery/images/${x.pendS}`,
          as: 'adminA',
          expect: 200,
        },
        {
          method: 'delete',
          path: (x) => `/api/gallery/images/${x.pendS}`,
          as: 'adminA',
          expect: 404,
        },
        {
          method: 'delete',
          path: '/api/gallery/images',
          as: 'adminA',
          body: (x) => ({ ids: [x.pendT] }),
          expect: 200,
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/categories/${x.cat}/images`,
          as: 'adminA',
          body: { status: 'rejected' },
          expect: 200,
          check: (b) => expect(b.data.count).toBe(1),
        },
      ],
      c,
    );
    expect(sideEffects.filter((l) => l.startsWith('S3 DELETE')).length).toBeGreaterThanOrEqual(2);
  });

  test('uploads cannot reuse another school’s object, event or category', async () => {
    const kb = await presign('adminB', 'b');
    const ka = await presign('adminA');
    await run(
      w,
      [
        {
          method: 'post',
          path: '/api/gallery/images',
          as: 'adminA',
          body: { keys: [kb] },
          expect: 403,
        },
        {
          method: 'post',
          path: '/api/gallery/images',
          as: 'adminA',
          body: (x) => ({ keys: [ka], eventId: x.eventB }),
          expect: 404,
        },
        {
          method: 'post',
          path: '/api/gallery/categories',
          as: 'adminB',
          host: 'b',
          body: { category: 'B only' },
          expect: 201,
          save: (b, x) => (x.catB = b.data.id),
        },
        {
          method: 'post',
          path: '/api/gallery/images',
          as: 'adminA',
          body: (x) => ({ keys: [ka], categoryId: x.catB }),
          expect: 404,
        },
        {
          method: 'post',
          path: '/api/gallery/images',
          as: 'adminA',
          body: (x) => ({ keys: [ka], caption: 'Keep', eventId: x.eventA, categoryId: x.cat }),
          expect: 201,
        },
        {
          method: 'get',
          path: '/api/gallery',
          expect: 200,
          save: (b, x) => (x.keep = find(b, (o) => o.caption === 'Keep')?.id),
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.keep}`,
          as: 'adminA',
          body: (x) => ({ categoryId: x.catB }),
          expect: 404,
        },
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.keep}`,
          as: 'adminA',
          body: (x) => ({ eventId: x.eventB }),
          expect: 404,
        },
        // PATCH keeps fields it was not sent
        {
          method: 'patch',
          path: (x) => `/api/gallery/images/${x.keep}`,
          as: 'adminA',
          body: { caption: 'Kept' },
          expect: 200,
          check: (b, x) =>
            expect(b.data).toMatchObject({
              caption: 'Kept',
              event_id: x.eventA,
              category_id: x.cat,
            }),
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/categories/${x.catB}/thumbnail`,
          as: 'adminA',
          body: (x) => ({ imageId: x.keep }),
          expect: 404,
        },
        {
          method: 'put',
          path: (x) => `/api/gallery/events/${x.eventB}/thumbnail`,
          as: 'adminA',
          body: (x) => ({ imageId: x.keep }),
          expect: 404,
        },
      ],
      c,
    );
  });
});
