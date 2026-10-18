import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { buildAppConfig } from '@/config/build-config';
import { createMemoryKeyValueStore } from '@/lib/storage/key-value';
import {
  clearTenantStorage,
  createTenantScopedStorage,
  tenantStorageKey,
} from '@/lib/storage/tenant-scoped-storage';
import {
  defaultBranding,
  mapSchoolInfoToBranding,
  parseCachedBranding,
  resolveFileUrl,
  serializeBranding,
} from './branding';
import {
  privateQueryKey,
  purgeOtherTenantQueries,
  purgePrivateQueries,
  tenantQueryKey,
} from './query-keys';
import { normalizeHost, resolveTenant } from './resolve';

describe('resolveTenant', () => {
  it('web same-origin uses the page host (port stripped)', () => {
    assert.deepEqual(
      resolveTenant({
        platform: 'web',
        pageHost: 'LBP-Dashboard.mutiurrahman.com:443',
        apiBaseUrl: '',
        devTenantHost: null,
      }),
      {
        tenantKey: 'lbp-dashboard.mutiurrahman.com',
        host: 'lbp-dashboard.mutiurrahman.com',
        source: 'page-host',
      },
    );
  });
  it('an explicit API base URL wins over the page host', () => {
    const r = resolveTenant({
      platform: 'web',
      pageHost: 'localhost:8081',
      apiBaseUrl: 'https://abc-dashboard.example.com',
      devTenantHost: null,
    });
    assert.equal(r.tenantKey, 'abc-dashboard.example.com');
    assert.equal(r.source, 'api-host');
  });
  it('native uses the API host and is unresolved without one', () => {
    assert.equal(
      resolveTenant({
        platform: 'android',
        pageHost: null,
        apiBaseUrl: 'https://x.example.com',
        devTenantHost: null,
      }).source,
      'api-host',
    );
    assert.equal(
      resolveTenant({ platform: 'ios', pageHost: null, apiBaseUrl: '', devTenantHost: null })
        .source,
      'unresolved',
    );
  });
  it('dev override wins', () => {
    assert.equal(
      resolveTenant({
        platform: 'android',
        pageHost: null,
        apiBaseUrl: 'http://10.0.2.2:5000',
        devTenantHost: 'demo.localhost',
      }).tenantKey,
      'demo.localhost',
    );
  });
  it('rejects junk hosts', () => {
    assert.equal(normalizeHost('https://user@evil.com/path'), 'evil.com');
    assert.equal(normalizeHost('bad host!'), null);
  });
});

describe('buildAppConfig', () => {
  it('requires an API base URL on native, https outside local, and ignores dev host outside local', () => {
    assert.equal(buildAppConfig({}, 'android').issues.length, 1);
    assert.equal(buildAppConfig({}, 'web').issues.length, 0);
    const stg = buildAppConfig(
      { appEnv: 'staging', apiBaseUrl: 'http://x.example.com/api/', devTenantHost: 'a.localhost' },
      'web',
    );
    assert.equal(stg.config.apiBaseUrl, 'http://x.example.com');
    assert.equal(stg.config.devTenantHost, null);
    assert.ok(stg.issues.some((i) => /https/.test(i.message)));
  });
});

describe('branding', () => {
  const info = {
    id: 7,
    name: ' Lalbagh High School ',
    shortName: 'LBP',
    nameBn: null,
    logo: '7/logo/1-logo.png',
    headerLogo: null,
    subdomain: 'lbp',
    customDomain: null,
    district: null,
    upazila: null,
  };
  it('maps public school info and resolves the logo against the CDN', () => {
    const b = mapSchoolInfoToBranding(info, 'https://cdn.example.com', 'lbp-dashboard.example.com');
    assert.equal(b.displayName, 'Lalbagh High School');
    assert.equal(b.logoUrl, 'https://cdn.example.com/7/logo/1-logo.png');
    assert.deepEqual(b.theme, {});
  });
  it('bare keys without a CDN give no logo (never a broken relative URL)', () => {
    assert.equal(resolveFileUrl('7/logo.png', ''), null);
    assert.equal(resolveFileUrl('https://x/y.png', ''), 'https://x/y.png');
  });
  it('a cached branding for school A is rejected while school B is active', () => {
    const a = mapSchoolInfoToBranding(info, '', 'a.example.com');
    const raw = serializeBranding(a);
    assert.equal(parseCachedBranding(raw, 'b.example.com'), null);
    assert.equal(parseCachedBranding(raw, 'a.example.com')?.displayName, 'Lalbagh High School');
    assert.equal(parseCachedBranding('{bad', 'a.example.com'), null);
    assert.equal(defaultBranding('b.example.com').displayName, 'School Dashboard');
  });
});

describe('tenant-scoped storage', () => {
  it('namespaces keys and clears only the previous tenant', async () => {
    const store = createMemoryKeyValueStore();
    const a = createTenantScopedStorage(store, 'a.example.com');
    const b = createTenantScopedStorage(store, 'b.example.com');
    await a.set('branding', 'A');
    await a.set('prefs', 'A2');
    await b.set('branding', 'B');
    assert.equal(await b.get('branding'), 'B');
    assert.match(tenantStorageKey('a.example.com:8081', 'x y'), /^[A-Za-z0-9._-]+$/);
    await clearTenantStorage(store, 'a.example.com');
    assert.equal(await a.get('branding'), null);
    assert.equal(await a.get('prefs'), null);
    assert.equal(await b.get('branding'), 'B');
  });
});

describe('tenant-scoped queries', () => {
  it('purges every other tenant and un-namespaced queries on switch', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKey('a', 'branding'), 'A');
    qc.setQueryData(privateQueryKey('a', 'students'), ['a1']);
    qc.setQueryData(tenantQueryKey('b', 'branding'), 'B');
    qc.setQueryData(['legacy'], 'x');
    purgeOtherTenantQueries(qc, 'b');
    assert.equal(qc.getQueryData(tenantQueryKey('a', 'branding')), undefined);
    assert.equal(qc.getQueryData(privateQueryKey('a', 'students')), undefined);
    assert.equal(qc.getQueryData(['legacy']), undefined);
    assert.equal(qc.getQueryData(tenantQueryKey('b', 'branding')), 'B');
  });
  it('sign-out drops private data but keeps public branding', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKey('a', 'branding'), 'A');
    qc.setQueryData(privateQueryKey('a', 'me'), { id: 1 });
    purgePrivateQueries(qc, 'a');
    assert.equal(qc.getQueryData(privateQueryKey('a', 'me')), undefined);
    assert.equal(qc.getQueryData(tenantQueryKey('a', 'branding')), 'A');
  });
});
