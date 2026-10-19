/**
 * Platform (super-admin) mode isolation: it has its own tenant key, connection, cache namespace
 * and SecureStore slot; a school session can never reach platform routes (or the reverse); the
 * stored platform choice is honoured only for this build's super-admin origin; school codes can
 * never select super_admin.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { buildAppConfig } from '@/config/build-config';
import { AUTH_PATHS, createAuthApi } from '@/lib/api/auth';
import { createApiClient } from '@/lib/api/client';
import { SessionManager } from '@/lib/api/session';
import { createMemorySessionPersistence } from '@/lib/api/token-store';
import { createMemoryKeyValueStore } from '@/lib/storage/key-value';
import {
  clearTenantStorage,
  createTenantScopedStorage,
  tenantStorageKey,
} from '@/lib/storage/tenant-scoped-storage';
import {
  homeForRole,
  loginRouteFor,
  PLATFORM_HOME,
  PLATFORM_LOGIN,
} from '@/navigation/role-routes';
import {
  clearSelection,
  loadStoredSelection,
  parseSelection,
  parseStoredSelection,
  platformSelectionFor,
  savePlatformSelection,
  saveSelection,
  selectionFromLookup,
  SELECTION_KEY,
} from '@/school/selection';
import { privateQueryKey, purgeOtherTenantQueries, tenantQueryKey } from './query-keys';
import {
  isPlatformTenantKey,
  LOCAL_SUPER_ADMIN_HOST,
  normalizeHost,
  platformTenantKey,
  resolveTenant,
  tenantConnection,
  type TenantResolution,
} from './resolve';

const SA = 'https://superadmin.mutiurrahman.com';
const base = { platform: 'android' as const, pageHost: null, apiBaseUrl: '', devTenantHost: null };
const cfg = (appEnv: 'local' | 'staging') => ({
  appEnv,
  apiBaseUrl: '',
  directoryUrl: 'https://dir.test',
  superAdminUrl: appEnv === 'local' ? 'http://localhost:4000' : SA,
});

describe('platform tenant resolution', () => {
  it('gets its own `_platform.<host>` key, which no school host can produce', () => {
    const r = resolveTenant({ ...base, platformHost: 'superadmin.mutiurrahman.com' });
    assert.deepEqual(r, {
      tenantKey: '_platform.superadmin.mutiurrahman.com',
      host: 'superadmin.mutiurrahman.com',
      source: 'platform',
    });
    assert.equal(isPlatformTenantKey(r.tenantKey), true);
    // A school on the very same host is a different namespace.
    const school = resolveTenant({ ...base, selectedHost: 'superadmin.mutiurrahman.com' });
    assert.equal(school.source, 'school-code');
    assert.notEqual(school.tenantKey, r.tenantKey);
    for (const evil of ['_platform.x', 'a_b.test', '_platform.superadmin.mutiurrahman.com']) {
      assert.equal(normalizeHost(evil), null);
      assert.equal(resolveTenant({ ...base, selectedHost: evil }).source, 'unresolved');
    }
  });

  it('separate SecureStore slot and query namespace from every school', async () => {
    const platformKey = platformTenantKey('superadmin.mutiurrahman.com');
    assert.equal(
      tenantStorageKey(platformKey, 'session'),
      'sd.t._platform.superadmin.mutiurrahman.com.session',
    );
    assert.notEqual(
      tenantStorageKey('superadmin.mutiurrahman.com', 'session'),
      tenantStorageKey(platformKey, 'session'),
    );

    const store = createMemoryKeyValueStore();
    await createTenantScopedStorage(store, platformKey).set('session', 'P');
    await createTenantScopedStorage(store, 'lbhs.test').set('session', 'S');
    await clearTenantStorage(store, platformKey);
    assert.equal(await createTenantScopedStorage(store, platformKey).get('session'), null);
    assert.equal(await createTenantScopedStorage(store, 'lbhs.test').get('session'), 'S');

    const qc = new QueryClient();
    qc.setQueryData(privateQueryKey(platformKey, 'platform', 'schools'), ['all schools']);
    qc.setQueryData(privateQueryKey('lbhs.test', 'students'), ['s']);
    purgeOtherTenantQueries(qc, 'lbhs.test');
    assert.equal(qc.getQueryData(privateQueryKey(platformKey, 'platform', 'schools')), undefined);
    qc.setQueryData(privateQueryKey(platformKey, 'platform', 'schools'), ['all schools']);
    purgeOtherTenantQueries(qc, platformKey);
    assert.equal(qc.getQueryData(privateQueryKey('lbhs.test', 'students')), undefined);
    assert.deepEqual(
      qc.getQueryData(tenantQueryKey(platformKey, 'private', 'platform', 'schools')),
      ['all schools'],
    );
  });

  it('connection is always the build super-admin origin (admin.localhost header in local dev)', () => {
    const r: TenantResolution = {
      tenantKey: platformTenantKey('x'),
      host: 'x',
      source: 'platform',
    };
    assert.deepEqual(tenantConnection(r, cfg('staging'), 'https://evil.test'), {
      baseUrl: SA,
      tenantHeader: null,
    });
    assert.deepEqual(tenantConnection(r, cfg('local'), null), {
      baseUrl: 'http://localhost:4000',
      tenantHeader: LOCAL_SUPER_ADMIN_HOST,
    });
  });

  it('a pinned school build (api host / dev override) never resolves to platform', () => {
    assert.equal(
      resolveTenant({ ...base, apiBaseUrl: 'https://lbhs.test', platformHost: 'sa.test' }).source,
      'api-host',
    );
    assert.equal(
      resolveTenant({ ...base, devTenantHost: 'lbhs.test', platformHost: 'sa.test' }).source,
      'dev-override',
    );
  });
});

describe('role routing between school and platform', () => {
  it('super_admin only lands in platform mode; school roles never do', () => {
    assert.equal(homeForRole('super_admin', 'platform'), PLATFORM_HOME);
    for (const role of ['admin', 'teacher', 'student', 'x', undefined])
      assert.equal(homeForRole(role, 'platform'), null);
    for (const source of ['school-code', 'api-host', 'page-host', 'dev-override'] as const) {
      assert.equal(homeForRole('super_admin', source), null);
      assert.equal(homeForRole('admin', source), '/');
    }
    assert.equal(loginRouteFor('platform'), PLATFORM_LOGIN);
    assert.equal(loginRouteFor('school-code'), '/login');
    assert.equal(loginRouteFor('unresolved'), '/join');
  });
});

describe('stored selection', () => {
  it('platform choice persists, and is honoured only for this build super-admin origin', async () => {
    const store = createMemoryKeyValueStore();
    const p = platformSelectionFor(SA, 5)!;
    await savePlatformSelection(store, p);
    assert.deepEqual(await loadStoredSelection(store, SA), { kind: 'platform', platform: p });
    // Another build (different origin) or a tampered entry reads as nothing stored.
    assert.equal(await loadStoredSelection(store, 'https://other.test'), null);
    assert.equal(
      parseStoredSelection(JSON.stringify({ ...p, apiBaseUrl: 'https://evil.test' }), SA),
      null,
    );
    assert.equal(parseStoredSelection(JSON.stringify({ ...p, host: 'evil.test' }), SA), null);
    assert.equal(parseStoredSelection('{bad', SA), null);
    // Not available at all without a super-admin origin.
    assert.equal(platformSelectionFor(''), null);
    assert.equal(platformSelectionFor('https://sa.test/api'), null);
    // The old school-only reader never mistakes the platform entry for a school.
    assert.equal(parseSelection(store.dump()[SELECTION_KEY]!), null);
    await clearSelection(store);
    assert.equal(await loadStoredSelection(store, SA), null);
  });

  it('a school selection still loads, and school codes can never hint super_admin', async () => {
    const store = createMemoryKeyValueStore();
    const sel = selectionFromLookup(
      {
        school: { name: 'LBHS', shortName: null, logo: null },
        tenant: { host: 'lbhs.test', apiBaseUrl: 'https://lbhs.test' },
        roleHint: 'super_admin' as never,
      },
      1,
    );
    assert.equal(sel.roleHint, null);
    await saveSelection(store, sel);
    const loaded = await loadStoredSelection(store, SA);
    assert.equal(loaded?.kind, 'school');
  });
});

describe('build config', () => {
  it('superAdminUrl: explicit, else the directory origin; validated like the others', () => {
    const explicit = buildAppConfig(
      { appEnv: 'staging', directoryUrl: 'https://dir.test', superAdminUrl: `${SA}/api/` },
      'android',
    );
    assert.equal(explicit.config.superAdminUrl, SA);
    assert.equal(
      buildAppConfig({ directoryUrl: 'https://dir.test' }, 'android').config.superAdminUrl,
      'https://dir.test',
    );
    const bad = buildAppConfig(
      { appEnv: 'staging', directoryUrl: 'https://dir.test', superAdminUrl: 'http://sa.test' },
      'android',
    );
    assert.ok(bad.issues.some((i) => i.key === 'EXPO_PUBLIC_SUPERADMIN_URL'));
  });
});

describe('native super_admin session', () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  it('login on the super-admin endpoint, refresh rotates via body, logout revokes', async () => {
    const calls: { url: string; body: unknown; method: string }[] = [];
    const responses = [
      () =>
        json(200, {
          success: true,
          data: { accessToken: 'a1', refreshToken: 'r1', user: { id: 1, role: 'super_admin' } },
        }),
      () =>
        json(200, {
          success: true,
          data: { accessToken: 'a2', refreshToken: 'r2', user: { id: 1, role: 'super_admin' } },
        }),
      () => json(200, { success: true, data: null }),
    ];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return responses.shift()!();
    }) as typeof fetch;
    const auth = createAuthApi(createApiClient({ baseUrl: SA, fetch: fetchImpl }));
    const persistence = createMemorySessionPersistence();
    const manager = new SessionManager({
      persistence,
      transport: 'body',
      refreshRequest: (t) => auth.refresh(t),
    });

    await manager.signIn(
      await auth.loginSuperAdmin({ email: 'root@example.com', password: 'pw123456' }),
    );
    assert.equal(calls[0]!.url, `${SA}${AUTH_PATHS.superAdminLogin}`);
    assert.equal((await persistence.load())?.refreshToken, 'r1');
    assert.equal(await manager.refresh(), true);
    assert.deepEqual(calls[1]!.body, { refreshToken: 'r1' });
    assert.equal((await persistence.load())?.refreshToken, 'r2');
    await auth.logout((await manager.storedRefreshToken()) ?? undefined);
    assert.equal(calls[2]!.method, 'DELETE');
    assert.deepEqual(calls[2]!.body, { refreshToken: 'r2' });
  });
});
