import {
  call,
  denied,
  describeHttp,
  run,
  setupWorld,
  teardownWorld,
} from '../../common/http-world.js';
import { prisma } from '@/config/prisma.js';
import { asSuperAdmin } from '../../common/http-test.js';
import { TENANT_VISIBLE_SMS_FIELDS } from './sms-settings.service.js';
import type { World } from '../../common/http-world.js';

const PUBLIC_KEYS = [
  'absent_template',
  'is_active',
  'present_template',
  'run_awayed_template',
  'school_name',
  'send_to_absent',
  'send_to_present',
  'send_to_run_awayed',
  'sms_balance',
].sort();
const LOCKED = [
  'id',
  'school_id',
  'sms_balance',
  'api_key',
  'api_url',
  'sender_id',
  'service_type',
];

describeHttp('sms-settings (http)', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  });
  afterAll(async () => {
    await teardownWorld(w);
  });

  test('roles', async () => {
    await run(w, [
      ...denied('get', '/api/sms/settings'),
      ...denied('patch', '/api/sms/settings', ['adminA'], { send_to_absent: true }),
      ...denied('get', '/api/sms/settings/public', ['adminA', 'teacherA']),
      ...denied('get', '/api/sms/balance'),
      ...denied('get', '/api/sms/message-count?text=hi'),
      ...denied('post', '/api/sms/test-messages', ['adminA'], {
        phoneNumber: '01700000000',
        message: 'hi',
      }),
    ]);
  });

  test('whitelist: credentials, balance and ids are rejected and never change', async () => {
    const before = (await call(w, 'adminA', 'get', '/api/sms/settings')).body.data;
    expect(before.school_id).toBe(w.fx.a.schoolId);
    const forbidden: Record<string, unknown> = {
      id: before.id + 1000,
      school_id: w.fx.b.schoolId,
      sms_balance: 999999,
      api_key: 'stolen',
      api_url: 'http://evil.test',
      sender_id: 'EVIL',
      service_type: 'x',
      updated_at: '2000-01-01T00:00:00.000Z',
    };
    for (const [k, v] of Object.entries(forbidden)) {
      const res = await call(w, 'adminA', 'patch', '/api/sms/settings').send({
        send_to_absent: true,
        [k]: v,
      });
      expect([k, res.status]).toEqual([k, 400]);
    }
    await run(w, [
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: { is_active: 'yes' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: { present_template: '' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: { present_template: 'x'.repeat(1001) },
        expect: 400,
      },
      // template rules from the service
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: { absent_template: 'No name here' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: { absent_template: '{student_name} on {date}' },
        expect: 400,
      },
      {
        method: 'patch',
        path: '/api/sms/settings',
        as: 'adminA',
        body: {
          absent_template: '{student_name} on {date}',
          requiredPlaceholders: ['{date}'],
          send_to_absent: !before.send_to_absent,
        },
        expect: 200,
        check: (b) =>
          expect(b.data).toMatchObject({
            absent_template: '{student_name} on {date}',
            send_to_absent: !before.send_to_absent,
          }),
      },
    ]);
    const after = (await call(w, 'adminA', 'get', '/api/sms/settings')).body.data;
    for (const k of LOCKED) expect([k, after[k]]).toEqual([k, before[k]]);
    // school B is untouched and sees its own row
    const b = (await call(w, 'adminB', 'get', '/api/sms/settings', 'b')).body.data;
    expect(b.school_id).toBe(w.fx.b.schoolId);
    expect(b.absent_template).not.toBe('{student_name} on {date}');
  });

  test('public subset, balance, message count, test message', async () => {
    await run(w, [
      {
        method: 'get',
        path: '/api/sms/settings/public',
        as: 'teacherA',
        expect: 200,
        check: (b) => {
          expect(Object.keys(b.data).sort()).toEqual(PUBLIC_KEYS);
          expect(b.data.school_name).toBe(w.fx.a.name);
        },
      },
      {
        method: 'get',
        path: '/api/sms/settings/public',
        as: 'teacherB',
        host: 'b',
        expect: 200,
        check: (b) => expect(b.data.school_name).toBe(w.fx.b.name),
      },
      {
        method: 'get',
        path: '/api/sms/balance',
        as: 'adminA',
        expect: 200,
        check: (b) =>
          expect(Object.keys(b.data).sort()).toEqual(['estimatedSms', 'message', 'selfHosted']),
      },
      { method: 'get', path: '/api/sms/message-count', as: 'adminA', expect: 400 },
      {
        method: 'get',
        path: '/api/sms/message-count?text=hello',
        as: 'adminA',
        expect: 200,
        check: (b) => expect(b.data).toMatchObject({ count: 1 }),
      },
      { method: 'post', path: '/api/sms/test-messages', as: 'adminA', body: {}, expect: 400 },
      {
        method: 'post',
        path: '/api/sms/test-messages',
        as: 'adminA',
        body: { phoneNumber: '01700000000', message: 'x'.repeat(1001) },
        expect: 400,
      },
      {
        method: 'post',
        path: '/api/sms/test-messages',
        as: 'adminA',
        body: { phoneNumber: '01700000000', message: 'hi', extra: 1 },
        expect: 400,
      },
    ]);
  });

  test('admins never receive credentials: GET and PATCH return only the visible fields', async () => {
    await asSuperAdmin(
      async () =>
        await prisma.sms_settings.update({
          where: { school_id: w.fx.a.schoolId },
          data: {
            api_key: 'enc:secret-key',
            api_url: 'http://provider.test',
            sender_id: 'SND',
            service_type: 'bulksmsbd',
          },
        }),
    );
    try {
      const visible = [...TENANT_VISIBLE_SMS_FIELDS].sort();
      for (const res of [
        await call(w, 'adminA', 'get', '/api/sms/settings'),
        await call(w, 'adminA', 'patch', '/api/sms/settings').send({ is_active: true }),
      ]) {
        expect(res.status).toBe(200);
        expect(Object.keys(res.body.data).sort()).toEqual(visible);
        expect(JSON.stringify(res.body)).not.toMatch(
          /secret-key|provider\.test|api_key|api_url|sender_id|service_type/,
        );
      }
      const pub = await call(w, 'adminA', 'get', '/api/sms/settings/public');
      expect(JSON.stringify(pub.body)).not.toMatch(/secret-key|api_key/);
    } finally {
      await asSuperAdmin(
        async () =>
          await prisma.sms_settings.update({
            where: { school_id: w.fx.a.schoolId },
            data: { api_key: null, api_url: null, sender_id: null, service_type: null },
          }),
      );
    }
  });
});
