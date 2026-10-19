/**
 * Platform admin: confirm/double-submit guard, sign-in role check, and the pure page models
 * (overview stats, SMS, billing, school form, banners, exam types, confirm wording).
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { ApiError } from '@/lib/api/errors';
import type { SessionPayload } from '@/lib/api';
import { parsePlatformSchool } from '@/lib/api/platform';
import {
  NotPlatformAdminError,
  buildSuperAdminLoginBody,
  platformLoginErrorMessage,
  requirePlatformSession,
} from './auth';
import { createConfirmGate } from './confirm-gate';
import {
  applyStatusDefaults,
  billingConfirm,
  billingPayload,
  cascadeMessage,
  createEmptySchool,
  emptyTypeForm,
  examTypePayload,
  toFormValues,
  domainChanges,
  fleetStats,
  issuesToErrors,
  moveItem,
  orderedBannerKeys,
  parseBalanceAmount,
  parseEditorTab,
  parseSchoolParam,
  saveSchoolConfirm,
  schoolTypesDiff,
  smsCredentialsPayload,
  smsMode,
  smsSummary,
  tabForPath,
  validateAdminForm,
  validateImageDimensions,
  validateImageFile,
  validateSchoolForm,
  type BannerSlot,
  type BillingForm,
  type ConfirmCopy,
  type PlatformSchemas,
} from './model';

// ESM-only package; loaded the way the CJS test runner can (as in features/import).
let S: PlatformSchemas;
before(async () => {
  S = await import('@school/shared-schemas');
});

const copy: ConfirmCopy = { title: 't', message: 'm', confirmLabel: 'ok', tone: 'destructive' };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('confirm gate (double-submit guard)', () => {
  it('nothing runs until confirmed; cancel drops it', async () => {
    let runs = 0;
    const gate = createConfirmGate();
    assert.equal(
      gate.request(copy, async () => void runs++),
      true,
    );
    assert.equal(runs, 0);
    assert.equal(gate.cancel(), true);
    assert.equal(gate.pending, null);
    assert.equal(await gate.confirm(), 'skipped');
    assert.equal(runs, 0);
  });

  it('a double tap on Confirm sends once; new requests are refused while busy', async () => {
    let runs = 0;
    const d = deferred();
    const gate = createConfirmGate();
    gate.request(copy, async () => {
      runs++;
      await d.promise;
    });
    const first = gate.confirm();
    const second = gate.confirm();
    assert.equal(gate.busy, true);
    assert.equal(
      gate.request(copy, async () => void runs++),
      false,
    );
    assert.equal(gate.cancel(), false, 'cannot dismiss an in-flight request');
    d.resolve();
    assert.deepEqual(await Promise.all([first, second]), ['ran', 'skipped']);
    assert.equal(runs, 1);
    assert.equal(gate.busy, false);
    assert.equal(gate.pending, null);
  });

  it('a second request while one is pending is ignored (no silent swap)', () => {
    const gate = createConfirmGate();
    const a = async () => {};
    gate.request(copy, a);
    assert.equal(
      gate.request({ ...copy, title: 'other' }, async () => {}),
      false,
    );
    assert.equal(gate.pending?.copy.title, 't');
  });

  it('a failing action closes the dialog and frees the gate', async () => {
    const gate = createConfirmGate();
    gate.request(copy, async () => {
      throw new Error('boom');
    });
    assert.equal(await gate.confirm(), 'failed');
    assert.equal(gate.pending, null);
    assert.equal(
      gate.request(copy, async () => {}),
      true,
    );
  });
});

const payload = (role: string): SessionPayload =>
  ({ accessToken: 'a', refreshToken: 'r', user: { id: 1, role } }) as SessionPayload;

describe('platform sign-in', () => {
  it('builds the superAdminLoginSchema body (trimmed, lowercased email)', () => {
    assert.deepEqual(buildSuperAdminLoginBody('  Root@Example.COM ', 'pw123456', S), {
      ok: true,
      value: { email: 'root@example.com', password: 'pw123456' },
    });
    assert.equal(buildSuperAdminLoginBody('', 'x', S).ok, false);
    assert.equal(buildSuperAdminLoginBody('a@b.co', '', S).ok, false);
    assert.equal(buildSuperAdminLoginBody('not-an-email', 'x', S).ok, false);
  });

  it('only a super_admin session may be kept', () => {
    assert.equal(requirePlatformSession(payload('super_admin')).user.role, 'super_admin');
    for (const role of ['admin', 'teacher', 'student', 'unknown']) {
      assert.throws(() => requirePlatformSession(payload(role)), NotPlatformAdminError);
    }
  });

  it('errors never say which credential was wrong', () => {
    const msg = (status: number) =>
      platformLoginErrorMessage(new ApiError({ kind: 'http', status, message: 'x' }));
    assert.equal(msg(401), msg(404));
    assert.equal(msg(400), msg(401));
    assert.match(msg(429), /Too many/);
    assert.match(msg(403), /not available/);
  });
});

describe('overview + sms models', () => {
  const now = Date.parse('2026-10-19T00:00:00Z');
  it('counts trialing/past-due/locked and trials ending within 14 days', () => {
    const s = (status: string | null, trial?: string) => ({
      subscription: status
        ? { status, trial_ends_at: trial ?? null, current_period_ends_at: null }
        : null,
    });
    const stats = fleetStats(
      [
        s('trialing', '2026-10-25T00:00:00Z'),
        s('trialing', '2026-12-25T00:00:00Z'),
        s('past_due'),
        s('suspended'),
        s('expired'),
        s('active'),
        s(null),
      ] as never,
      now,
    );
    assert.deepEqual(stats, {
      total: 7,
      trialing: 2,
      pastDue: 1,
      expiredOrLocked: 2,
      trialsEndingSoon: 1,
      attention: 4,
    });
  });

  it('sms modes and the "needs attention" rule (not configured or < 200 left)', () => {
    const row = (configured: boolean, self_hosted: boolean, estimated_sms: number | null) =>
      ({ school_id: 1, school_name: 'x', configured, self_hosted, estimated_sms }) as never;
    assert.equal(smsMode(row(false, false, null)), 'not-configured');
    assert.equal(smsMode(row(true, true, null)), 'self-hosted');
    assert.equal(smsMode(row(true, false, 10)), 'shared');
    assert.deepEqual(
      smsSummary([
        row(false, false, null),
        row(true, true, 1000),
        row(true, false, 50),
        row(true, false, 900),
      ]),
      {
        selfHosted: 1,
        shared: 2,
        needsAttention: 2,
      },
    );
  });

  it('sms credentials payload never sends display-only values; top-up is a positive integer', () => {
    const creds = { api_key_masked: null, api_url: '  ', sender_id: 'SCHOOL', service_type: null };
    assert.deepEqual(smsCredentialsPayload(creds, ''), { sender_id: 'SCHOOL' });
    assert.deepEqual(smsCredentialsPayload(creds, ' key '), {
      api_url: '  ',
      sender_id: 'SCHOOL',
      service_type: 'onecode',
      api_key: 'key',
    });
    assert.equal(parseBalanceAmount('250'), 250);
    for (const bad of ['0', '-1', '2.5', 'abc', '']) assert.equal(parseBalanceAmount(bad), null);
  });
});

describe('billing model', () => {
  const blank: BillingForm = {
    status: 'trialing',
    annual_price: '',
    currency: 'BDT',
    trial_started_at: '',
    trial_ends_at: '',
    subscription_started_at: '',
    current_period_started_at: '',
    current_period_ends_at: '',
    cancelled_at: '',
    notes: '',
  };
  const now = new Date('2026-10-19T08:00:00Z');
  it('status defaults fill the dates each status needs', () => {
    const active = applyStatusDefaults(blank, 'active', S, now);
    assert.equal(active.current_period_started_at, '2026-10-19');
    assert.equal(active.current_period_ends_at, '2027-10-19');
    const expired = applyStatusDefaults(active, 'expired', S, now);
    assert.equal(expired.current_period_ends_at, '2026-10-18');
    const trial = applyStatusDefaults(blank, 'trialing', S, now);
    assert.equal(trial.trial_ends_at, '2026-11-18');
    assert.equal(billingPayload(trial, S).ok, true);
  });

  it('locking an active school is a destructive confirm; other saves are not', () => {
    const label = (s: string) => s.replace('_', ' ');
    for (const to of ['suspended', 'cancelled', 'expired'] as const) {
      assert.equal(billingConfirm('LBHS', 'active', to, label).tone, 'destructive');
    }
    assert.equal(billingConfirm('LBHS', 'suspended', 'suspended', label).tone, 'default');
    assert.equal(billingConfirm('LBHS', 'trialing', 'active', label).tone, 'default');
  });
});

describe('school form model', () => {
  it('url params: only positive ids or "new"; unknown tabs fall back to identity', () => {
    assert.equal(parseSchoolParam('12'), 12);
    assert.equal(parseSchoolParam('new'), 'new');
    for (const bad of ['0', '-3', '1e3', 'abc', undefined, ['1']])
      assert.equal(parseSchoolParam(bad), null);
    assert.equal(parseEditorTab('billing'), 'billing');
    assert.equal(parseEditorTab('../x'), 'identity');
  });

  it('validates with updateSchoolSchema and maps errors to their tab', () => {
    const empty = validateSchoolForm(createEmptySchool(2026), S);
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.ok(empty.errors.name);
      assert.equal(tabForPath('name'), 'identity');
      assert.equal(tabForPath('academicProfile.grades'), 'academic');
      assert.equal(tabForPath('initialAdmin.password'), 'identity');
    }
    assert.equal(validateAdminForm({ username: '', password: '' }, S).ok, false);
  });

  it('server field errors map onto paths (first message wins)', () => {
    assert.deepEqual(
      issuesToErrors([
        { path: ['subdomain'], message: 'Subdomain already in use' },
        { path: ['subdomain'], message: 'second' },
        { path: ['descriptions', 'main'], message: '' },
        'junk',
      ]),
      { subdomain: 'Subdomain already in use', 'descriptions.main': 'Invalid value' },
    );
  });

  it('domain changes make the update confirm destructive and name both sides', () => {
    const before = { subdomain: 'lbhs', customDomain: '' };
    assert.deepEqual(domainChanges(before, { subdomain: ' LBHS ', customDomain: '' }), []);
    const diff = domainChanges(before, { subdomain: 'lbhs2', customDomain: 'lbhs.edu.bd' });
    assert.deepEqual(diff, ['Subdomain: lbhs → lbhs2', 'Custom domain: (none) → lbhs.edu.bd']);
    assert.equal(saveSchoolConfirm('update', 'LBHS', diff).tone, 'destructive');
    assert.equal(saveSchoolConfirm('update', 'LBHS', []).tone, 'default');
    assert.match(
      saveSchoolConfirm('create', 'LBHS', [], { adminUsername: 'boss', trialEnds: '2026-11-18' })
        .message,
      /boss.*2026-11-18/,
    );
  });

  it('banner order survives upload (new slides keep the position they were moved to)', () => {
    const slots: BannerSlot<string>[] = [
      { kind: 'saved', key: 'b/1' },
      { kind: 'pending', file: 'new-a' },
      { kind: 'saved', key: 'b/2' },
      { kind: 'pending', file: 'new-b' },
    ];
    assert.deepEqual(orderedBannerKeys(slots, ['u/a', 'u/b']), ['b/1', 'u/a', 'b/2', 'u/b']);
    assert.deepEqual(
      moveItem(slots, 3, 0).map((s) => s.kind),
      ['pending', 'saved', 'pending', 'saved'],
    );
    assert.deepEqual(moveItem([1, 2], 0, 5), [1, 2]);
  });

  it('image rules: type, size, square logo, wide header', () => {
    assert.match(validateImageFile({ type: 'application/pdf', size: 1 }, 'logo') ?? '', /image/);
    assert.match(
      validateImageFile({ type: 'image/png', size: 5 * 1024 * 1024 }, 'logo') ?? '',
      /under 2 MB/,
    );
    assert.equal(validateImageDimensions({ width: 512, height: 512 }, 'logo'), null);
    assert.match(validateImageDimensions({ width: 512, height: 400 }, 'logo') ?? '', /square/);
    assert.match(
      validateImageDimensions({ width: 900, height: 900 }, 'header') ?? '',
      /wide|at least/,
    );
  });
});

describe('exam type model', () => {
  it('cascade summary and per-school diff', () => {
    assert.equal(cascadeMessage(null), 'Exam type updated');
    assert.equal(
      cascadeMessage({ updated: 1, skipped_frozen: 2, skipped_overlap: 0 }),
      '1 exam updated. 2 frozen skipped',
    );
    assert.deepEqual(schoolTypesDiff([1, 2, 3], [2, 3, 4]), { added: [4], removed: [1] });
  });
});

describe('round trips with the shared schemas', () => {
  it('a saved school loads into the form and validates unchanged', () => {
    const school = parsePlatformSchool({
      id: 3,
      name: 'Lalbagh High School',
      logo: 'logos/a.png',
      district: 'Joypurhat',
      upazila: 'Panchbibi',
      phone: '01711111111',
      email: 'info@lbhs.edu.bd',
      establishedIn: 1950,
      board: 'not-a-board',
    })!;
    const form = toFormValues(school, S, 2026);
    assert.equal(form.board, '', 'unknown enum values are dropped, not sent back');
    const v = validateSchoolForm(form, S);
    assert.ok(v.ok, JSON.stringify(!v.ok && v.errors));
  });

  it('exam type payload: defaults pass once named; blank sort order is 0', () => {
    assert.equal(examTypePayload(emptyTypeForm(), S).ok, false);
    const r = examTypePayload({ ...emptyTypeForm(), name: 'Half Yearly', sort_order: '' }, S);
    assert.ok(r.ok);
    if (r.ok)
      assert.deepEqual(r.value, {
        name: 'Half Yearly',
        is_year_end: false,
        sort_order: 0,
        assign_to_new_schools: true,
      });
  });
});
