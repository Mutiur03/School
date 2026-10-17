import { httpTest } from '../../../common/http-test.js';

// HTTP contract for /api/fee-structures. Needs the dev DB with the fee_collection migration applied.
const api = httpTest();
beforeAll(() => api.start());
afterAll(() => api.stop());

test.each([
  ['GET', '/api/fee-structures?year=2026'],
  ['PUT', '/api/fee-structures'],
  ['POST', '/api/fee-structures/copy'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await api.call(method, path, {
    body: method === 'GET' ? undefined : {},
  });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test('GET without year → 400', async () => {
  expect((await api.call('GET', '/api/fee-structures', { auth: true })).status).toBe(400);
});

test.each([
  ['empty body', {}, 'year must not be less than 2000'],
  ['class 0', { year: 2026, class: 0, items: [] }, 'class must not be less than 1'],
  [
    'zero amount',
    { year: 2026, class: 8, items: [{ fee_head_id: 1, amount: 0 }] },
    'amount must not be less than 0.01',
  ],
  [
    'extra field',
    { year: 2026, class: 8, items: [], school_id: 2 },
    'property school_id should not exist',
  ],
])('PUT /fee-structures %s → 400', async (_n, payload, message) => {
  const { status, body } = await api.call('PUT', '/api/fee-structures', {
    auth: true,
    body: payload,
  });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('PUT with an unknown fee head → 400', async () => {
  const { status, body } = await api.call('PUT', '/api/fee-structures', {
    auth: true,
    body: { year: 2026, class: 12, items: [{ fee_head_id: 2_000_000_000, amount: 10 }] },
  });
  expect(status).toBe(400);
  expect(body.message).toBe('Unknown fee head');
});

test('POST /copy to the same year → 400', async () => {
  const { status } = await api.call('POST', '/api/fee-structures/copy', {
    auth: true,
    body: { from_year: 2026, to_year: 2026 },
  });
  expect(status).toBe(400);
});

test('an empty class list is accepted and returns []', async () => {
  // Year 2099 / class 12 holds no data in any school, so clearing it changes nothing.
  const { status, body } = await api.call('PUT', '/api/fee-structures', {
    auth: true,
    body: { year: 2099, class: 12, items: [] },
  });
  expect(status).toBe(200);
  expect(body.data).toEqual([]);
});
