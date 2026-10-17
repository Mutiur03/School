import { httpTest } from '../../../common/http-test.js';

// HTTP contract for /api/fee-waivers. Needs the dev DB with the fee_collection migration applied.
const api = httpTest();
beforeAll(() => api.start());
afterAll(() => api.stop());

test.each([
  ['GET', '/api/fee-waivers'],
  ['POST', '/api/fee-waivers'],
  ['PATCH', '/api/fee-waivers/1'],
  ['DELETE', '/api/fee-waivers/1'],
])('%s %s without token → 401', async (method, path) => {
  const { status, body } = await api.call(method, path, {
    body: method === 'GET' ? undefined : {},
  });
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test.each([
  ['empty body', {}, 'student_id must be an integer'],
  ['zero value', { student_id: 1, year: 2026, value: 0 }, 'value must not be less than 0.01'],
  [
    'extra field',
    { student_id: 1, year: 2026, value: 5, school_id: 2 },
    'property school_id should not exist',
  ],
])('POST /fee-waivers %s → 400', async (_n, payload, message) => {
  const { status, body } = await api.call('POST', '/api/fee-waivers', {
    auth: true,
    body: payload,
  });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('percent over 100 → 400', async () => {
  const { status, body } = await api.call('POST', '/api/fee-waivers', {
    auth: true,
    body: { student_id: 1, year: 2026, percent: true, value: 101 },
  });
  expect(status).toBe(400);
  expect(body.message).toBe('Percentage cannot exceed 100');
});

test('unknown student → 400', async () => {
  const { status, body } = await api.call('POST', '/api/fee-waivers', {
    auth: true,
    body: { student_id: 2_000_000_000, year: 2026, value: 5 },
  });
  expect(status).toBe(400);
  expect(body.message).toBe('Student not found');
});

test('PATCH / DELETE of a missing waiver → 404', async () => {
  expect(
    (await api.call('PATCH', '/api/fee-waivers/0', { auth: true, body: { value: 5 } })).status,
  ).toBe(404);
  expect((await api.call('DELETE', '/api/fee-waivers/0', { auth: true })).status).toBe(404);
});
