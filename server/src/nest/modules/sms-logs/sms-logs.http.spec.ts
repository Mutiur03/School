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

describeHttp('sms-logs (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  test('admin only', async () => {
    await run(w, [
      ...denied('get', '/api/sms/logs'),
      ...denied('delete', '/api/sms/logs', ['adminA'], { ids: [1] }),
      ...denied('post', '/api/sms/logs/retries', ['adminA'], { ids: [1] }),
      ...denied('get', '/api/sms/usage'),
      ...denied('post', '/api/sms/bulk-messages', ['adminA'], { classNames: [6], message: 'hi' }),
      ...denied('get', '/api/sms/recipient-counts?classes=6'),
    ]);
  });

  test('validation', async () => {
    await run(w, [
      { method: 'get', path: '/api/sms/logs?limit=1000', as: 'adminA', expect: 400 },
      { method: 'get', path: '/api/sms/logs?foo=1', as: 'adminA', expect: 400 },
      { method: 'delete', path: '/api/sms/logs', as: 'adminA', body: { ids: [] }, expect: 400 },
      {
        method: 'post',
        path: '/api/sms/logs/retries',
        as: 'adminA',
        body: { ids: ['a'] },
        expect: 400,
      },
      { method: 'get', path: '/api/sms/usage?days=0', as: 'adminA', expect: 400 },
      {
        method: 'post',
        path: '/api/sms/bulk-messages',
        as: 'adminA',
        body: { classNames: [6], message: '' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/sms/bulk-messages',
        as: 'adminA',
        body: { classNames: [], message: 'hi' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/sms/bulk-messages',
        as: 'adminA',
        body: { classNames: [12], message: 'hi' },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/sms/bulk-messages',
        as: 'adminA',
        body: { classNames: [6], message: 'hi', school_id: 1 },
        expect: 400,
      },
      { method: 'get', path: '/api/sms/recipient-counts?classes=a', as: 'adminA', expect: 400 },
    ]);
  });

  test('logs, usage and recipient counts are per school; delete cannot reach another school', async () => {
    await run(w, [
      {
        method: 'post',
        path: '/api/sms/test-messages',
        as: 'adminA',
        body: { phoneNumber: '01700000001', message: 'log me' },
        expect: 201,
      },
      {
        method: 'get',
        path: '/api/sms/logs?category=test',
        as: 'adminA',
        expect: 200,
        save: (b, c) => (c.log = find(b, (o) => o.message === 'log me')?.id),
        check: (b) =>
          expect(find(b, (o) => o.message === 'log me')).toMatchObject({
            category: 'test',
            phone_number: '01700000001',
          }),
      },
      {
        method: 'get',
        path: '/api/sms/logs?category=all',
        as: 'adminB',
        host: 'b',
        expect: 200,
        check: (b) => expect(find(b, (o) => o.message === 'log me')).toBeUndefined(),
      },
      {
        method: 'get',
        path: '/api/sms/logs?page=1&limit=5&category=test',
        as: 'adminA',
        expect: 200,
        check: (b) => expect(find(b, (o) => o.message === 'log me')).toBeDefined(),
      },
      { method: 'get', path: '/api/sms/usage?days=7', as: 'adminA', expect: 200 },
      {
        method: 'get',
        path: '/api/sms/recipient-counts?classes=6,7',
        as: 'adminA',
        expect: 200,
        check: (b) =>
          expect(b.data).toMatchObject({ totalStudents: 1, classBreakdown: { 6: { total: 1 } } }),
      },
      {
        method: 'post',
        path: '/api/sms/logs/retries',
        as: 'adminA',
        body: { ids: [MISSING_ID] },
        expect: 201,
      },
      {
        method: 'delete',
        path: '/api/sms/logs',
        as: 'adminB',
        host: 'b',
        body: (c) => ({ ids: [c.log] }),
        expect: 200,
        check: (b) => expect(b.data.deletedCount).toBe(0),
      },
      {
        method: 'delete',
        path: '/api/sms/logs',
        as: 'adminA',
        body: (c) => ({ ids: [c.log] }),
        expect: 200,
        check: (b) => expect(b.data.deletedCount).toBe(1),
      },
      {
        method: 'delete',
        path: '/api/sms/logs',
        as: 'adminA',
        body: { ids: [MISSING_ID] },
        expect: 200,
        check: (b) => expect(b.data.deletedCount).toBe(0),
      },
    ]);
    expect((await call(w, 'adminA', 'get', '/api/sms/logs')).status).toBe(200);
  });
});
