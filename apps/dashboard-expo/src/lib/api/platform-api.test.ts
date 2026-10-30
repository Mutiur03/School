/**
 * Platform (super-admin) API client: every path/method/body matches the server routes
 * (school.route.ts, exam-type.route.ts, auth.route.ts super_admin admin CRUD), ids are checked
 * before they reach a path, and signed uploads never carry the session's bearer token.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { PLATFORM_PATHS, assertId, createPlatformApi, parsePlatformSchool } from './platform';
import type { PickedFile } from './uploads';

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ statusCode: status, success: true, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function harness(respond: (c: Call) => Response = () => ok(null)) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
      headers: Object.fromEntries(new Headers(init?.headers as HeadersInit).entries()),
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://superadmin.test',
    fetch: fetchImpl,
    auth: {
      getAccessToken: () => 'sa-token',
      refresh: async () => false,
      onSessionExpired: () => {},
    },
  });
  return { calls, api: createPlatformApi(client, fetchImpl) };
}
const path = (c: Call) => new URL(c.url).pathname;

const school = {
  id: 3,
  name: 'Lalbagh High School',
  logo: 'logos/a.png',
  district: 'd1',
  upazila: 'u1',
  phone: '01700000000',
  email: 'info@lbhs.edu.bd',
  subdomain: 'lbhs',
  bannerUrls: ['b/1.jpg'],
  subscription: { status: 'trialing', trial_ends_at: '2026-11-01T00:00:00.000Z' },
};

describe('platform api: schools', () => {
  it('lists schools from GET /api/platform/schools and drops malformed rows', async () => {
    const h = harness(() => ok([school, { id: 'x' }, null]));
    const rows = await h.api.listSchools();
    assert.equal(h.calls[0]!.method, 'GET');
    assert.equal(path(h.calls[0]!), '/api/platform/schools');
    assert.equal(h.calls[0]!.headers.authorization, 'Bearer sa-token');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.subscription?.status, 'trialing');
  });

  it('create POSTs the body and reads the new id; update PUTs /api/platform/schools/:id', async () => {
    const h = harness((c) => (c.method === 'POST' ? ok({ id: 41 }, 201) : ok(null)));
    const created = await h.api.createSchool({
      name: 'New',
      initialAdmin: { username: 'a', password: 'secret1' },
    });
    await h.api.updateSchool(41, { name: 'Renamed' });
    assert.deepEqual(created, { id: 41 });
    assert.equal(path(h.calls[0]!), '/api/platform/schools');
    assert.deepEqual(h.calls[0]!.body, {
      name: 'New',
      initialAdmin: { username: 'a', password: 'secret1' },
    });
    assert.equal(h.calls[1]!.method, 'PUT');
    assert.equal(path(h.calls[1]!), '/api/platform/schools/41');
  });

  it('refuses non-positive or fractional ids before any request', async () => {
    const h = harness();
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await assert.rejects(h.api.updateSchool(bad, {}), ApiError);
      await assert.rejects(h.api.deleteAdmin(3, bad), ApiError);
    }
    assert.equal(h.calls.length, 0);
    assert.equal(assertId(7), 7);
  });

  it('uploads: presign on the platform API, then a signed PUT without the bearer token', async () => {
    const h = harness((c) =>
      path(c) === PLATFORM_PATHS.assetUploadUrl
        ? ok({ uploadUrl: 'https://r2.test/put?sig=1', key: 'logos/new.png' })
        : new Response(null, { status: 200 }),
    );
    const file: PickedFile = {
      name: 'logo.png',
      type: 'image/png',
      size: 4,
      body: new Blob(['png!']),
    };
    const key = await h.api.uploadAsset('logo', file);
    assert.equal(key, 'logos/new.png');
    assert.equal(h.calls[0]!.method, 'GET');
    assert.equal(
      new URL(h.calls[0]!.url).search,
      '?filename=logo.png&contentType=image%2Fpng&kind=logo',
    );
    assert.equal(h.calls[0]!.body, undefined);
    assert.equal(h.calls[1]!.method, 'PUT');
    assert.equal(h.calls[1]!.url, 'https://r2.test/put?sig=1');
    assert.equal(h.calls[1]!.headers.authorization, undefined);
  });
});

describe('platform api: billing, tools, sms', () => {
  it('billing GET/PUT /api/platform/schools/:id/billing', async () => {
    const sub = { school_id: 3, status: 'active', currency: 'BDT' };
    const h = harness(() => ok(sub));
    await h.api.getBilling(3);
    await h.api.updateBilling(3, { status: 'suspended' } as never);
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['GET', '/api/platform/schools/3/billing'],
        ['PUT', '/api/platform/schools/3/billing'],
      ],
    );
    assert.deepEqual(h.calls[1]!.body, { status: 'suspended' });
  });

  it('rotate passwords is POST, export is GET; both binary', async () => {
    const h = harness(() => new Response(new Uint8Array([0x50, 0x4b]), { status: 200 }));
    const rotated = await h.api.rotateStudentPasswords(3);
    await h.api.exportStudents(3);
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['POST', '/api/platform/schools/3/student-password-rotations'],
        ['GET', '/api/platform/schools/3/student-export'],
      ],
    );
    assert.ok(rotated instanceof ArrayBuffer);
  });

  it('sms: overview, credentials, top-up (positive integers only)', async () => {
    const h = harness((c) =>
      path(c).endsWith('sms-balance-topups')
        ? ok({ sms_balance: 500 })
        : ok({ schools: [], shared_balance: null }),
    );
    await h.api.smsOverview();
    await h.api.updateSmsCredentials(3, { api_key: null });
    assert.equal(await h.api.addSmsBalance(3, 200), 500);
    for (const bad of [0, -5, 2.5]) await assert.rejects(h.api.addSmsBalance(3, bad), ApiError);
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['GET', '/api/platform/sms-overview'],
        ['PATCH', '/api/platform/schools/3/sms-credentials'],
        ['POST', '/api/platform/schools/3/sms-balance-topups'],
      ],
    );
    assert.deepEqual(h.calls[1]!.body, { api_key: null });
    assert.deepEqual(h.calls[2]!.body, { amount: 200 });
  });
});

describe('platform api: admins and exam types', () => {
  it('admin CRUD under /api/auth/super_admin/schools/:id/admins', async () => {
    const h = harness((c) =>
      c.method === 'GET' ? ok([{ id: 9, username: 'boss', role: 'admin' }, { id: 0 }]) : ok(null),
    );
    const admins = await h.api.listAdmins(3);
    await h.api.addAdmin(3, { username: 'new', password: 'secret1' });
    await h.api.deleteAdmin(3, 9);
    assert.deepEqual(admins, [{ id: 9, username: 'boss', role: 'admin' }]);
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['GET', '/api/auth/super_admin/schools/3/admins'],
        ['POST', '/api/auth/super_admin/schools/3/admins'],
        ['DELETE', '/api/auth/super_admin/schools/3/admins/9'],
      ],
    );
  });

  it('exam types: CRUD, cascade summary, per-school assignment', async () => {
    const h = harness((c) =>
      c.method === 'PUT' && path(c) === '/api/exam-types/5'
        ? ok({ cascade: { updated: 2, skipped_frozen: 1, skipped_overlap: 0 } })
        : ok([]),
    );
    await h.api.listExamTypes();
    await h.api.createExamType({
      name: 'Half Yearly',
      is_year_end: false,
      sort_order: 1,
      assign_to_new_schools: true,
    });
    const cascade = await h.api.updateExamType(5, {
      name: 'Final',
      is_year_end: true,
      sort_order: 9,
      assign_to_new_schools: true,
    });
    await h.api.deleteExamType(5);
    await h.api.setSchoolExamTypes(3, [5, 6]);
    assert.deepEqual(cascade, { updated: 2, skipped_frozen: 1, skipped_overlap: 0 });
    assert.deepEqual(
      h.calls.map((c) => [c.method, path(c)]),
      [
        ['GET', '/api/exam-types'],
        ['POST', '/api/exam-types'],
        ['PUT', '/api/exam-types/5'],
        ['DELETE', '/api/exam-types/5'],
        ['PUT', '/api/exam-types/school/3'],
      ],
    );
    assert.deepEqual(h.calls[4]!.body, { exam_type_ids: [5, 6] });
    await assert.rejects(h.api.setSchoolExamTypes(3, [5, -1]), ApiError);
  });
});

describe('parsePlatformSchool', () => {
  it('needs a positive id; a nameless row stays listed (and editable) like on the web', () => {
    assert.equal(parsePlatformSchool({ ...school, id: 0 }), null);
    assert.equal(parsePlatformSchool({ ...school, name: '' })?.name, '');
    assert.equal(parsePlatformSchool(school)?.bannerUrls.length, 1);
  });
});
