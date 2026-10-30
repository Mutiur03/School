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

describeHttp('levels (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const valid = (c: any) => ({ class_name: 7, section: 'B', year: 2030, teacher_id: c.teacherA });

  test('roles: admin only, own school only', async () => {
    await run(w, [
      ...denied('get', '/api/levels'),
      ...denied('post', '/api/levels', ['adminA'], valid),
      ...denied('patch', '/api/levels/1', ['adminA'], { section: 'C' }),
      ...denied('delete', '/api/levels/1'),
    ]);
  });

  test('validation: required fields, ranges, unknown fields, bad ids', async () => {
    await run(w, [
      { method: 'post', path: '/api/levels', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: (c) => ({ ...valid(c), class_name: 13 }),
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: (c) => ({ ...valid(c), year: 1999 }),
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: (c) => ({ ...valid(c), section: '' }),
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: (c) => ({ ...valid(c), school_id: c.schoolB }),
        expect: 400,
        check: (b) => expect(b.message).toMatch(/school_id should not exist/),
      },
      {
        method: 'patch',
        path: '/api/levels/abc',
        as: 'adminA',
        body: { section: 'C' },
        expect: 400,
      },
      { method: 'patch', path: '/api/levels/1', as: 'adminA', body: { x: 1 }, expect: 400 },
    ]);
  });

  test('lifecycle with cross-school isolation and 404s', async () => {
    await run(w, [
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: valid,
        expect: 201,
        save: (b, c) => (c.level = b.data.id),
        check: (b, c) =>
          expect(b.data).toMatchObject({
            class_name: 7,
            section: 'B',
            year: 2030,
            teacher_id: c.teacherA,
          }),
      },
      // a teacher of school B cannot be assigned in school A
      {
        method: 'post',
        path: '/api/levels',
        as: 'adminA',
        body: (c) => ({ ...valid(c), section: 'Z', teacher_id: c.teacherB }),
        expect: 404,
      },
      {
        method: 'get',
        path: '/api/levels',
        as: 'adminA',
        expect: 200,
        check: (b, c) => {
          expect(Array.isArray(b.data)).toBe(true);
          expect(find(b.data, (o) => o.id === c.level)).toMatchObject({
            section: 'B',
            teacher_name: 'Teacher a',
          });
        },
      },
      {
        method: 'get',
        path: '/api/levels',
        as: 'adminB',
        host: 'b',
        expect: 200,
        check: (b, c) => expect(find(b.data, (o) => o.id === c.level)).toBeUndefined(),
      },
      {
        method: 'patch',
        path: (c) => `/api/levels/${c.level}`,
        as: 'adminB',
        host: 'b',
        body: { section: 'X' },
        expect: 404,
      },
      {
        method: 'delete',
        path: (c) => `/api/levels/${c.level}`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/levels/${c.level}`,
        as: 'adminA',
        body: { section: 'C' },
        expect: 200,
        check: (b) => expect(b.data).toMatchObject({ section: 'C', class_name: 7, year: 2030 }),
      },
      {
        method: 'patch',
        path: (c) => `/api/levels/${c.level}`,
        as: 'adminA',
        body: (c) => ({ teacher_id: c.teacherB }),
        expect: 404,
      },
      {
        method: 'patch',
        path: `/api/levels/${MISSING_ID}`,
        as: 'adminA',
        body: { section: 'C' },
        expect: 404,
      },
      { method: 'delete', path: `/api/levels/${MISSING_ID}`, as: 'adminA', expect: 404 },
      { method: 'delete', path: (c) => `/api/levels/${c.level}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/levels/${c.level}`, as: 'adminA', expect: 404 },
    ]);
  });
});
