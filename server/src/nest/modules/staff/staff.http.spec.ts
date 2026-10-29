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
import type { World } from '../../common/http-world.js';

const PUBLIC_KEYS = ['designation', 'email', 'id', 'image', 'name', 'phone'];

describeHttp('staff (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  const row = {
    name: 'Rahim Uddin',
    phone: '01711111111',
    designation: 'Clerk',
    address: 'Road 1, Dhaka',
  };

  test('roles: list is public (optional auth), writes and photo are admin only', async () => {
    await run(w, [
      { method: 'get', path: '/api/staff', expect: 200 },
      ...denied('post', '/api/staff', ['adminA'], { staff: [row] }),
      ...denied('patch', '/api/staff/1', ['adminA'], { designation: 'x' }),
      ...denied('delete', '/api/staff/1'),
      ...denied('get', '/api/staff/1/image/upload-url?filename=p.jpg&contentType=image/jpeg'),
      ...denied('put', '/api/staff/1/image', ['adminA'], { key: 'k' }),
      ...denied('delete', '/api/staff/1/image'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      { method: 'get', path: '/api/staff?limit=500', expect: 400 },
      { method: 'get', path: '/api/staff?page=0', expect: 400 },
      { method: 'post', path: '/api/staff', as: 'adminA', body: { staff: [] }, expect: 400 },
      {
        method: 'post',
        path: '/api/staff',
        as: 'adminA',
        body: { staff: [{ name: 'Bad', phone: '123' }] },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/staff',
        as: 'adminA',
        body: { staff: [{ ...row, email: 'nope' }] },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/staff',
        as: 'adminA',
        body: { staff: [{ ...row, salary: 1 }] },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/staff',
        as: 'adminA',
        body: { staff: [row], school_id: 1 },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/staff/abc',
        as: 'adminA',
        body: { designation: 'x' },
        expect: 400,
      },
      { method: 'patch', path: '/api/staff/1', as: 'adminA', body: { school_id: 1 }, expect: 400 },
      { method: 'get', path: '/api/staff/1/image/upload-url', as: 'adminA', expect: 400 },
      { method: 'put', path: '/api/staff/1/image', as: 'adminA', body: {}, expect: 400 },
    ]);
  });

  test('admins get full rows; the public and other roles get the trimmed profile', async () => {
    await run(w, [
      { method: 'post', path: '/api/staff', as: 'adminA', body: { staff: [row] }, expect: 201 },
    ]);
    const pick = (b: any) => find(b.data, (o) => o.name === row.name);
    const admin = pick((await call(w, 'adminA', 'get', '/api/staff')).body);
    expect(admin).toMatchObject({ address: row.address, school_id: w.fx.a.schoolId });
    for (const who of ['none', 'teacherA', 'studentA'] as const) {
      for (const path of ['/api/staff', '/api/staff?page=1&limit=10', '/api/staff?search=Rahim']) {
        const res = await call(w, who, 'get', path);
        expect(res.status).toBe(200);
        expect(Object.keys(pick(res.body)).sort()).toEqual(PUBLIC_KEYS);
      }
    }
    const paged = (await call(w, 'adminA', 'get', '/api/staff?page=1&limit=10&search=Rahim')).body
      .data;
    expect(paged.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(paged.data[0]).toHaveProperty('address', row.address);
    // school B sees none of school A's staff
    expect(pick((await call(w, 'adminB', 'get', '/api/staff', 'b')).body)).toBeUndefined();
  });

  test('update, photo upload/replace/remove, delete; isolated per school', async () => {
    const { sideEffects } = await run(w, [
      {
        method: 'get',
        path: '/api/staff?search=Rahim',
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.st = find(b, (o) => o.name === row.name)?.id),
      },
      {
        method: 'patch',
        path: (c) => `/api/staff/${c.st}`,
        as: 'adminB',
        host: 'b',
        body: { designation: 'Head' },
        expect: 404,
      },
      { method: 'delete', path: (c) => `/api/staff/${c.st}`, as: 'adminB', host: 'b', expect: 404 },
      {
        method: 'get',
        path: (c) => `/api/staff/${c.st}/image/upload-url?filename=p.jpg&contentType=image/jpeg`,
        as: 'adminB',
        host: 'b',
        expect: 404,
      },
      {
        method: 'patch',
        path: (c) => `/api/staff/${c.st}`,
        as: 'adminA',
        body: { designation: 'Head Clerk' },
        expect: 200,
        check: (b) => expect(b.data.designation).toBe('Head Clerk'),
      },
      {
        method: 'patch',
        path: `/api/staff/${MISSING_ID}`,
        as: 'adminA',
        body: { designation: 'x' },
        expect: 404,
      },
      {
        method: 'get',
        path: (c) => `/api/staff/${c.st}/image/upload-url?filename=p.jpg&contentType=image/jpeg`,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.k = b.data.key),
        check: (b, c) => {
          expect(b.data.key).toMatch(new RegExp(`^${c.schoolA}/`));
          expect(b.data.uploadUrl).toContain(b.data.key);
        },
      },
      {
        method: 'get',
        path: (c) => `/api/staff/${c.st}/image/upload-url?filename=q.jpg&contentType=image/jpeg`,
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.k2 = b.data.key),
      },
      {
        method: 'put',
        path: (c) => `/api/staff/${c.st}/image`,
        as: 'adminA',
        body: (c) => ({ key: c.k }),
        expect: 200,
      },
      {
        method: 'put',
        path: (c) => `/api/staff/${c.st}/image`,
        as: 'adminA',
        body: (c) => ({ key: c.k2 }),
        expect: 200,
      },
      { method: 'delete', path: (c) => `/api/staff/${c.st}/image`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/staff/${c.st}`, as: 'adminA', expect: 200 },
      { method: 'delete', path: (c) => `/api/staff/${c.st}`, as: 'adminA', expect: 404 },
    ]);
    // first photo replaced, second removed
    expect(sideEffects.filter((l) => l.startsWith('S3 DELETE')).length).toBeGreaterThanOrEqual(2);
  });
});
