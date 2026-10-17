import { prisma } from '../../../config/prisma.js';
import { asSuperAdmin, httpTest } from '../../common/http-test.js';

// HTTP contract for /api/fee-heads. Needs the dev DB with the fee_collection migration applied.
const api = httpTest();
const headIds: number[] = [];
let incomeHeadId = 0;
let expenseHeadId = 0;
const tag = `test-fee-${Date.now()}`;

beforeAll(async () => {
  await api.start();
  // Heads are created through the API so the school is whatever the test admin belongs to.
  const income = await api.call('POST', '/api/acc-heads', {
    auth: true,
    body: { name: `${tag}-income`, type: 'income' },
  });
  const expense = await api.call('POST', '/api/acc-heads', {
    auth: true,
    body: { name: `${tag}-expense`, type: 'expense' },
  });
  incomeHeadId = income.body.data.id;
  expenseHeadId = expense.body.data.id;
});

afterAll(async () => {
  await asSuperAdmin(async () => {
    await prisma.fee_heads.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.acc_heads.deleteMany({ where: { id: { in: [incomeHeadId, expenseHeadId] } } });
  });
  await api.stop();
});

test.each([
  ['GET', '/api/fee-heads'],
  ['POST', '/api/fee-heads'],
  ['PATCH', '/api/fee-heads/1'],
  ['DELETE', '/api/fee-heads/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await api.call(method, path, {
    body: method === 'GET' ? undefined : {},
  });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test.each([
  ['empty body', {}, 'name must be a string'],
  [
    'bad frequency',
    { name: 'x', income_head_id: 1, frequency: 'weekly' },
    'frequency must be one of',
  ],
  [
    'extra field',
    { name: 'x', income_head_id: 1, school_id: 2 },
    'property school_id should not exist',
  ],
])('POST /fee-heads %s → 400', async (_n, payload, message) => {
  const { status, body } = await api.call('POST', '/api/fee-heads', { auth: true, body: payload });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('POST /fee-heads rejects a non-income head → 400', async () => {
  const { status, body } = await api.call('POST', '/api/fee-heads', {
    auth: true,
    body: { name: `${tag}-bad`, income_head_id: expenseHeadId },
  });
  expect(status).toBe(400);
  expect(body.message).toBe('Income head not found');
});

test('create → list → update → delete → 404', async () => {
  const created = await api.call('POST', '/api/fee-heads', {
    auth: true,
    body: { name: `${tag}-tuition`, income_head_id: incomeHeadId },
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id as number;
  headIds.push(id);
  expect(created.body.data).toMatchObject({
    frequency: 'monthly',
    is_waivable: true,
    is_active: true,
  });

  expect(
    (
      await api.call('POST', '/api/fee-heads', {
        auth: true,
        body: { name: `${tag}-tuition`, income_head_id: incomeHeadId },
      })
    ).status,
  ).toBe(409);

  const list = await api.call('GET', '/api/fee-heads', { auth: true });
  expect(list.body.data.some((h: any) => h.id === id)).toBe(true);

  const updated = await api.call('PATCH', `/api/fee-heads/${id}`, {
    auth: true,
    body: { frequency: 'once', is_active: false },
  });
  expect(updated.body.data).toMatchObject({ frequency: 'once', is_active: false });

  expect((await api.call('DELETE', `/api/fee-heads/${id}`, { auth: true })).status).toBe(200);
  expect((await api.call('DELETE', `/api/fee-heads/${id}`, { auth: true })).status).toBe(404);
});
