import { httpTest } from '../../../common/http-test.js';

// HTTP contract for /api/fee-receipts. Needs the dev DB with the fee_collection migration applied.
// Rejection cases only: they write nothing. The collect → post → delete round trip is covered by
// the service spec (exact Prisma calls) and should be clicked through once on a dev school.
const api = httpTest();
beforeAll(() => api.start());
afterAll(() => api.stop());

const body = {
  student_id: 1,
  year: 2026,
  date: '2026-03-05',
  pay_head_id: 1,
  items: [{ fee_head_id: 1, month: 1 }],
};

test.each([
  ['GET', '/api/fee-receipts'],
  ['GET', '/api/fee-receipts/statement?student_id=1&year=2026'],
  ['GET', '/api/fee-receipts/1'],
  ['GET', '/api/fee-receipts/1/pdf'],
  ['POST', '/api/fee-receipts'],
  ['DELETE', '/api/fee-receipts/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body: b } = await api.call(method, path, {
    body: method === 'POST' ? {} : undefined,
  });
  expect(status).toBe(401);
  expect(b.success).toBe(false);
});

test.each([
  ['empty body', {}, 'student_id must be an integer'],
  ['no items', { ...body, items: [] }, 'items must contain at least 1 elements'],
  [
    'month 13',
    { ...body, items: [{ fee_head_id: 1, month: 13 }] },
    'month must not be greater than 12',
  ],
  ['client amount', { ...body, total: 5 }, 'property total should not exist'],
])('POST /fee-receipts %s → 400', async (_n, payload, message) => {
  const { status, body: b } = await api.call('POST', '/api/fee-receipts', {
    auth: true,
    body: payload,
  });
  expect(status).toBe(400);
  expect(b.message).toContain(message);
});

test('GET /fee-receipts/statement without year → 400', async () => {
  const { status } = await api.call('GET', '/api/fee-receipts/statement?student_id=1', {
    auth: true,
  });
  expect(status).toBe(400);
});

test('GET /fee-receipts/abc → 400 invalid id', async () => {
  const { status, body: b } = await api.call('GET', '/api/fee-receipts/abc', { auth: true });
  expect(status).toBe(400);
  expect(b.message).toBe('Validation failed (numeric string is expected)');
});

test('GET /fee-receipts/0 → 404', async () => {
  expect((await api.call('GET', '/api/fee-receipts/0', { auth: true })).status).toBe(404);
});

test('POST for a student with no enrollment → 404', async () => {
  const { status, body: b } = await api.call('POST', '/api/fee-receipts', {
    auth: true,
    body: { ...body, student_id: 2_000_000_000 },
  });
  expect(status).toBe(404);
  expect(b.message).toBe('Student is not enrolled in this year');
});
