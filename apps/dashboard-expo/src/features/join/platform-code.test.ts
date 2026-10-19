/**
 * Super-admin sign-in through the platform access code: no link on the landing screen, the code
 * (typed or scanned) goes through the same lookup as a school code, school codes behave exactly
 * as before, and anything unknown (or a server without the feature) is a plain "not found".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { lookupErrorMessage, resolveCodeLookup } from '@/features/join/join-form';
import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createPlatformApi, PLATFORM_PATHS } from '@/lib/api/platform';
import {
  createSchoolCodeApi,
  formatCodeInput,
  parseLookupResponse,
  parseScannedCode,
} from '@/lib/api/school-codes';

const SCHOOL = {
  target: 'school',
  school: { name: 'Alpha High', shortName: 'AHS', logo: null },
  tenant: {
    host: 'alpha-dashboard.mutiurrahman.com',
    apiBaseUrl: 'https://alpha-dashboard.mutiurrahman.com',
  },
  roleHint: 'teacher',
};
const PLATFORM_CODE = 'PFM-7K4Q';

/** A directory server: the platform code → { target: 'platform' }, school code → SCHOOL, else 404. */
function directory(opts: { platformCode?: string | null } = {}) {
  const sent: string[] = [];
  const client = createApiClient({
    baseUrl: 'https://dir.test',
    fetch: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { code } = JSON.parse(String(init?.body)) as { code: string };
      sent.push(code);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (opts.platformCode && code === opts.platformCode) {
        return json(200, { success: true, data: { target: 'platform' } });
      }
      if (code === 'ABC-7K4Q') return json(200, { success: true, data: SCHOOL });
      return json(404, { success: false, message: 'School code not found' });
    }) as typeof fetch,
  });
  return { api: createSchoolCodeApi(client, { allowHttp: false }), sent };
}

/** What join.tsx does with a code: lookup, then resolveCodeLookup. */
const submit = async (code: string, platformAvailable: boolean, platformCode = PLATFORM_CODE) => {
  const { api, sent } = directory({ platformCode });
  return { outcome: resolveCodeLookup(await api.lookup(code), platformAvailable), sent };
};

describe('landing screen', () => {
  const join = readFileSync(new URL('../../../app/(auth)/join.tsx', import.meta.url), 'utf8');
  it('has no platform sign-in link', () => {
    assert.doesNotMatch(join, /join-platform-admin/);
    assert.doesNotMatch(join, /Platform admin sign in/i);
    // Platform is entered only from a lookup outcome, never from a button of its own.
    assert.equal(join.match(/enterPlatform\(\)/g)?.length, 1);
    assert.match(join, /outcome\.kind === 'platform'\) return enterPlatform\(\)/);
  });
  it('keeps the shared code input, scan button and continue button', () => {
    for (const id of ['school-code-input', 'school-code-scan', 'school-code-submit']) {
      assert.match(join, new RegExp(`testID="${id}"`));
    }
  });
});

describe('platform access code', () => {
  it('typed (any case/spacing) → platform sign-in', async () => {
    const { outcome, sent } = await submit(formatCodeInput('pfm 7k4q'), true);
    assert.deepEqual(outcome, { kind: 'platform' });
    assert.deepEqual(sent, [PLATFORM_CODE]);
  });
  it('scanned (bare QR payload or ?code= link) → platform sign-in', async () => {
    for (const payload of [PLATFORM_CODE, 'https://x.test/join?code=pfm-7k4q']) {
      const scanned = parseScannedCode(payload);
      assert.equal(scanned, PLATFORM_CODE);
      assert.deepEqual((await submit(scanned!, true)).outcome, { kind: 'platform' });
    }
  });
  it('nothing but the target is taken from the answer (no host, school or role)', () => {
    const r = parseLookupResponse(
      {
        target: 'platform',
        tenant: { host: 'evil.test', apiBaseUrl: 'https://evil.test' },
        roleHint: 'super_admin',
      },
      { allowHttp: false },
    );
    assert.deepEqual(r, { target: 'platform' });
  });
  it('a build without a platform URL treats it as not found', async () => {
    await assert.rejects(submit(PLATFORM_CODE, false), (e: ApiError) => {
      assert.equal(e.status, 404);
      assert.match(lookupErrorMessage(e), /couldn't find a school/);
      return true;
    });
  });
  it('a server without the feature (not deployed / env unset) → plain not found', async () => {
    await assert.rejects(submit(PLATFORM_CODE, true, ''), (e: ApiError) => {
      assert.match(lookupErrorMessage(e), /couldn't find a school/);
      return e.status === 404;
    });
  });
});

describe('school codes are unaffected', () => {
  it('a school code still goes to the school confirm step with its role hint', async () => {
    const { outcome } = await submit('abc-7k4q', true);
    assert.equal(outcome.kind, 'school');
    assert.ok(outcome.kind === 'school');
    assert.equal(outcome.lookup.school.name, 'Alpha High');
    assert.equal(outcome.lookup.tenant.host, SCHOOL.tenant.host);
    assert.equal(outcome.lookup.roleHint, 'teacher');
    assert.equal('target' in outcome.lookup, false);
  });
  it('a school answer can never yield super_admin', () => {
    const r = parseLookupResponse({ ...SCHOOL, roleHint: 'super_admin' }, { allowHttp: false });
    assert.ok(!('target' in r));
    assert.equal(r.roleHint, null);
  });
  it('the old answer shape (no target field) still works', () => {
    const { target: _t, ...old } = SCHOOL;
    const r = parseLookupResponse(old, { allowHttp: false });
    assert.ok(!('target' in r) && r.school.name === 'Alpha High');
  });
});

describe('unknown code', () => {
  it('shows the normal not found, with or without platform mode available', async () => {
    for (const platformAvailable of [true, false]) {
      await assert.rejects(submit('ZZZ-ZZZZ', platformAvailable), (e: ApiError) => {
        assert.match(lookupErrorMessage(e), /couldn't find a school/);
        return e.status === 404;
      });
    }
  });
});

describe('platform code in the super-admin menu', () => {
  const api = (status: number, body: unknown, seen: string[] = []) =>
    createPlatformApi(
      createApiClient({
        baseUrl: 'https://sa.test',
        fetch: (async (url: RequestInfo | URL) => {
          seen.push(String(url));
          return new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          });
        }) as typeof fetch,
      }),
    );
  it('reads the code from the super-admin endpoint', async () => {
    const seen: string[] = [];
    const code = await api(
      200,
      { success: true, data: { code: 'pfm-7k4q' } },
      seen,
    ).getPlatformCode();
    assert.equal(code, PLATFORM_CODE);
    assert.deepEqual(seen, [`https://sa.test${PLATFORM_PATHS.platformCode}`]);
  });
  it('unset, malformed, or an older server without the endpoint → null', async () => {
    assert.equal(await api(200, { success: true, data: { code: null } }).getPlatformCode(), null);
    assert.equal(await api(200, { success: true, data: { code: 'nope' } }).getPlatformCode(), null);
    assert.equal(await api(404, { success: false, message: 'Not found' }).getPlatformCode(), null);
  });
  it('other failures surface (so the dialog can retry)', async () => {
    await assert.rejects(
      api(403, { success: false, message: 'Forbidden' }).getPlatformCode(),
      ApiError,
    );
  });
});
