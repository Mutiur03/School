import { httpTest } from '../../../common/http-test.js';

// HTTP contract for /api/fee-reports. Read-only. Needs the dev DB with the fee_collection migration applied.
const api = httpTest();
beforeAll(() => api.start());
afterAll(() => api.stop());

test.each([
  ['/api/fee-reports/summary?date=2026-03-05'],
  ['/api/fee-reports/collection?from=2026-03-01&to=2026-03-31'],
  ['/api/fee-reports/collection/pdf?from=2026-03-01&to=2026-03-31'],
  ['/api/fee-reports/dues?year=2026&class=8'],
  ['/api/fee-reports/dues/pdf?year=2026&class=8'],
])('GET %s without token → 401', async (path) => {
  const { status, body } = await api.call('GET', path);
  expect(status).toBe(401);
  expect(body.success).toBe(false);
});

test.each([
  ['/api/fee-reports/summary', 'date must be YYYY-MM-DD'],
  ['/api/fee-reports/collection?from=2026-03-01', 'to must be YYYY-MM-DD'],
  ['/api/fee-reports/dues?year=2026', 'class must not be less than 1'],
])('GET %s → 400', async (path, message) => {
  const { status, body } = await api.call('GET', path, { auth: true });
  expect(status).toBe(400);
  expect(body.message).toContain(message);
});

test('collection with an inverted range → 400', async () => {
  const { status } = await api.call(
    'GET',
    '/api/fee-reports/collection?from=2026-04-02&to=2026-04-01',
    {
      auth: true,
    },
  );
  expect(status).toBe(400);
});

test('empty far-future data returns zeroed reports', async () => {
  const collection = await api.call(
    'GET',
    '/api/fee-reports/collection?from=2099-01-01&to=2099-01-31',
    {
      auth: true,
    },
  );
  expect(collection.status).toBe(200);
  expect(collection.body.data).toMatchObject({ total: 0, count: 0, by_day: [], by_head: [] });

  const dues = await api.call('GET', '/api/fee-reports/dues?year=2099&class=12', { auth: true });
  expect(dues.body.data).toMatchObject({ rows: [], total_due: 0 });

  const summary = await api.call('GET', '/api/fee-reports/summary?date=2099-01-15', { auth: true });
  expect(summary.body.data.last_7_days).toHaveLength(7);
  expect(summary.body.data.today).toBe(0);
});
