import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiClient } from './client';
import { ApiError } from './errors';
import {
  createSchoolCodeApi,
  formatCodeInput,
  normalizeSchoolCode,
  parseScannedCode,
  SCHOOL_CODE_PATHS,
  validateLookup,
} from './school-codes';

const good = {
  school: { name: 'Lalbagh High School', shortName: 'LBHS', logo: 'logos/lbhs.png' },
  tenant: {
    host: 'lbhs-dashboard.mutiurrahman.com',
    apiBaseUrl: 'https://lbhs-dashboard.mutiurrahman.com',
  },
  roleHint: 'teacher',
};

describe('school code input', () => {
  it('normalizes case, spaces and dashes; rejects ambiguous characters and wrong lengths', () => {
    assert.equal(normalizeSchoolCode('abc-7k4q'), 'ABC-7K4Q');
    assert.equal(normalizeSchoolCode(' abc 7k4q '), 'ABC-7K4Q');
    assert.equal(normalizeSchoolCode('ABC7K4Q'), 'ABC-7K4Q');
    assert.equal(normalizeSchoolCode('AB0-7K4Q'), null); // 0 is not in the alphabet
    assert.equal(normalizeSchoolCode('ABI-7K4Q'), null); // I
    assert.equal(normalizeSchoolCode('ABC-7K4'), null);
    assert.equal(normalizeSchoolCode('ABC-7K4QQ'), null);
  });
  it('formats as you type and drops characters outside the alphabet', () => {
    assert.equal(formatCodeInput('a'), 'A');
    assert.equal(formatCodeInput('abc'), 'ABC');
    assert.equal(formatCodeInput('abc7'), 'ABC-7');
    assert.equal(formatCodeInput('abc-7k4q-extra'), 'ABC-7K4Q');
    assert.equal(formatCodeInput('a0b1c'), 'ABC');
  });
  it('reads a scanned bare code or a ?code= link, nothing else', () => {
    assert.equal(parseScannedCode('ABC-7K4Q'), 'ABC-7K4Q');
    assert.equal(parseScannedCode('https://x.test/join?code=abc-7k4q&x=1'), 'ABC-7K4Q');
    assert.equal(parseScannedCode('https://evil.test/'), null);
    assert.equal(parseScannedCode('?code=%E0%A4%A'), null);
  });
});

describe('validateLookup', () => {
  it('accepts the server shape and keeps only known fields', () => {
    const r = validateLookup({ ...good, extra: 1 }, { allowHttp: false });
    assert.deepEqual(r, {
      school: good.school,
      tenant: { host: good.tenant.host, apiBaseUrl: good.tenant.apiBaseUrl },
      roleHint: 'teacher',
    });
  });
  it('rejects an API host that differs from the tenant host, a path, or plain http', () => {
    const bad = (tenant: object, allowHttp = false) =>
      assert.throws(() => validateLookup({ ...good, tenant }, { allowHttp }), ApiError);
    bad({ host: good.tenant.host, apiBaseUrl: 'https://evil.test' });
    bad({ host: good.tenant.host, apiBaseUrl: `${good.tenant.apiBaseUrl}/api` });
    bad({ host: good.tenant.host, apiBaseUrl: `http://${good.tenant.host}` });
    bad({ host: 'no_dots', apiBaseUrl: 'https://no_dots' });
    assert.equal(
      validateLookup(
        { ...good, tenant: { host: 'fx.localhost', apiBaseUrl: 'http://fx.localhost:5000' } },
        { allowHttp: true },
      ).tenant.apiBaseUrl,
      'http://fx.localhost:5000',
    );
  });
  it('unknown role hints become null', () => {
    assert.equal(
      validateLookup({ ...good, roleHint: 'super_admin' }, { allowHttp: false }).roleHint,
      null,
    );
  });
});

describe('createSchoolCodeApi', () => {
  it('POSTs the normalized code without auth and validates the answer', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = createApiClient({
      baseUrl: 'https://dir.test',
      auth: {
        getAccessToken: () => 'should-not-be-sent',
        refresh: async () => false,
        onSessionExpired: () => {},
      },
      fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ success: true, data: good }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const r = await createSchoolCodeApi(client, { allowHttp: false }).lookup('abc 7k4q');
    assert.equal(r.school.name, good.school.name);
    assert.equal(calls[0]!.url, `https://dir.test${SCHOOL_CODE_PATHS.lookup}`);
    assert.equal(calls[0]!.init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { code: 'ABC-7K4Q' });
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, undefined);
  });
  it('a malformed code fails locally with the same 404 as an unknown one', async () => {
    let called = false;
    const client = createApiClient({
      baseUrl: '',
      fetch: (async () => {
        called = true;
        return new Response('{}');
      }) as typeof fetch,
    });
    await assert.rejects(
      createSchoolCodeApi(client, { allowHttp: false }).lookup('nope'),
      (e: ApiError) => e.status === 404,
    );
    assert.equal(called, false);
  });
  it('surfaces 404 and 429 from the server', async () => {
    for (const status of [404, 429]) {
      const client = createApiClient({
        baseUrl: '',
        fetch: (async () =>
          new Response(JSON.stringify({ success: false, message: 'x' }), {
            status,
            headers: { 'content-type': 'application/json' },
          })) as typeof fetch,
      });
      await assert.rejects(
        createSchoolCodeApi(client, { allowHttp: false }).lookup('ABC-7K4Q'),
        (e: ApiError) => e.status === status,
      );
    }
  });
});
