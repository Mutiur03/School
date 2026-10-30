import { jest } from '@jest/globals';

type Fn = (...args: any[]) => Promise<any>;
const db: any = {
  sms_settings: {
    findUnique: jest.fn<Fn>(),
    create: jest.fn<Fn>(),
    update: jest.fn<Fn>(),
    updateMany: jest.fn<Fn>(),
  },
};
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: db }));
jest.unstable_mockModule('@/config/rlsContextStore.js', () => ({
  getRlsContext: () => ({ schoolId: 7 }),
}));
const {
  SmsSettingsService,
  TENANT_EDITABLE_SMS_FIELDS,
  TENANT_VISIBLE_SMS_FIELDS,
  toTenantSmsSettings,
} = await import('./sms-settings.service.js');

const row = { id: 1, school_id: 7, api_key: null, sms_balance: 10 };
beforeEach(() => {
  jest.clearAllMocks();
  db.sms_settings.findUnique.mockResolvedValue(row);
  db.sms_settings.update.mockImplementation(async (a: any) => a);
});

test('updateSettings writes only the tenant-editable fields', async () => {
  await SmsSettingsService.updateSettings({
    send_to_absent: true,
    is_active: false,
    api_key: 'stolen',
    api_url: 'http://evil.test',
    sender_id: 'EVIL',
    service_type: 'x',
    sms_balance: 999999,
    school_id: 8,
    id: 2,
  });
  const { where, data } = db.sms_settings.update.mock.calls[0][0];
  expect(where).toEqual({ id: 1 });
  expect(data).toEqual({ send_to_absent: true, is_active: false });
  for (const k of Object.keys(data)) expect(TENANT_EDITABLE_SMS_FIELDS).toContain(k);
});

test('updateSettings tolerates a non-object body', async () => {
  await SmsSettingsService.updateSettings(null);
  expect(db.sms_settings.update.mock.calls[0][0].data).toEqual({});
});

test.each([
  ['Hello', undefined, /missing mandatory placeholders: \{student_name\}/],
  ['{student_name} {roll}', undefined, /forbidden placeholders.*\{roll\}/],
  ['{student_name}', ['{date}'], /missing.*\{date\}/],
])('template %s with %j is rejected', async (tpl, req, msg) => {
  await expect(
    SmsSettingsService.updateSettings({ present_template: tpl, requiredPlaceholders: req }),
  ).rejects.toThrow(msg);
  expect(db.sms_settings.update).not.toHaveBeenCalled();
});

test('a template with all required placeholders is saved', async () => {
  await SmsSettingsService.updateSettings({
    absent_template: '{student_name} {date}',
    requiredPlaceholders: ['{date}'],
  });
  expect(db.sms_settings.update.mock.calls[0][0].data).toEqual({
    absent_template: '{student_name} {date}',
  });
});

test('getSettings creates the default row the first time', async () => {
  db.sms_settings.findUnique.mockResolvedValue(null);
  db.sms_settings.create.mockResolvedValue(row);
  await SmsSettingsService.getSettings();
  expect(db.sms_settings.create.mock.calls[0][0].data.school_id).toBe(7);
});

test('addBalanceForSchool: 404 without settings, 400 for self-hosted, increments otherwise', async () => {
  db.sms_settings.findUnique.mockResolvedValueOnce(null);
  await expect(SmsSettingsService.addBalanceForSchool(7, 5)).rejects.toMatchObject({
    statusCode: 404,
  });
  db.sms_settings.findUnique.mockResolvedValueOnce({ ...row, api_key: 'enc' });
  await expect(SmsSettingsService.addBalanceForSchool(7, 5)).rejects.toMatchObject({
    statusCode: 400,
  });
  await SmsSettingsService.addBalanceForSchool(7, 5);
  expect(db.sms_settings.update.mock.calls[0][0].data).toEqual({ sms_balance: { increment: 5 } });
});

test('reserveBalance: free for 0 and for self-hosted; false when the counter is short', async () => {
  expect(await SmsSettingsService.reserveBalance(0)).toBe(true);
  db.sms_settings.findUnique.mockResolvedValueOnce({ ...row, api_key: 'enc' });
  expect(await SmsSettingsService.reserveBalance(5)).toBe(true);
  db.sms_settings.updateMany.mockResolvedValue({ count: 0 });
  expect(await SmsSettingsService.reserveBalance(50)).toBe(false);
  expect(db.sms_settings.updateMany.mock.calls[0][0].where).toEqual({
    id: 1,
    sms_balance: { gte: 50 },
  });
});

test('toTenantSmsSettings drops credentials and unknown columns', () => {
  const out = toTenantSmsSettings({
    ...row,
    api_key: 'enc',
    api_url: 'http://p',
    sender_id: 'S',
    service_type: 'x',
    future_secret: 'y',
    is_active: true,
  });
  expect(Object.keys(out).sort()).toEqual([...TENANT_VISIBLE_SMS_FIELDS].sort());
  for (const k of ['api_key', 'api_url', 'sender_id', 'service_type', 'future_secret'])
    expect(out).not.toHaveProperty(k);
  for (const k of ['api_key', 'api_url', 'sender_id', 'service_type'])
    expect(TENANT_VISIBLE_SMS_FIELDS).not.toContain(k);
});
