import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryKeyValueStore } from '@/lib/storage/key-value';
import { validateLookup } from '@/lib/api/school-codes';
import {
  clearSelection,
  loadSelection,
  parseSelection,
  saveSelection,
  selectionFromLookup,
} from '@/school/selection';
import { effectiveLoginRole, lockedLoginRole, LOGIN_ROLES, loginRoles } from './role-lock';

const HOST = 'demo-dashboard.mutiurrahman.com';
const server = (roleHint: unknown) => ({
  school: { name: 'Kashipur Model High School', shortName: 'KMHS', logo: null },
  tenant: { host: HOST, apiBaseUrl: `https://${HOST}` },
  roleHint,
});
const codeTenant = { source: 'school-code', host: HOST };
const lookup = (roleHint: unknown) => validateLookup(server(roleHint), { allowHttp: false });

describe('login role lock', () => {
  for (const role of ['student', 'teacher', 'admin'] as const) {
    it(`a ${role} code locks the form to ${role} only`, () => {
      const locked = lockedLoginRole(selectionFromLookup(lookup(role)), codeTenant);
      assert.equal(locked, role);
      assert.deepEqual(loginRoles(locked), [role]);
      // A stale tab choice can never submit another role while locked.
      for (const chosen of LOGIN_ROLES) assert.equal(effectiveLoginRole(locked, chosen), role);
    });
  }

  it('a school-wide code (no role) keeps every role selectable', () => {
    const locked = lockedLoginRole(selectionFromLookup(lookup(null)), codeTenant);
    assert.equal(locked, null);
    assert.deepEqual(loginRoles(locked), ['admin', 'teacher', 'student']);
    assert.equal(effectiveLoginRole(locked, 'teacher'), 'teacher');
  });

  it('ignores roles the server does not issue', () => {
    assert.equal(lookup('super_admin').roleHint, null);
    assert.equal(lockedLoginRole(selectionFromLookup(lookup('SUPER')), codeTenant), null);
  });

  it('only applies to a school picked with a code, for that same host', () => {
    const sel = selectionFromLookup(lookup('teacher'));
    for (const source of ['page-host', 'api-host', 'dev-override', 'unresolved'])
      assert.equal(lockedLoginRole(sel, { source, host: HOST }), null, source);
    assert.equal(lockedLoginRole(sel, { source: 'school-code', host: 'other.school.test' }), null);
    assert.equal(lockedLoginRole(null, codeTenant), null);
  });
});

describe('web page-host role lock', () => {
  const page = (host: string) => ({ source: 'page-host', host });

  it('a role subdomain locks to that role, ahead of ?role=', () => {
    for (const role of ['admin', 'teacher', 'student'] as const)
      assert.equal(lockedLoginRole(null, page(`${role}.lbphs.gov.bd`), 'student'), role);
  });

  it('?role= locks a plain school host; bad or missing values keep every role', () => {
    assert.equal(lockedLoginRole(null, page('lbphs.gov.bd'), 'teacher'), 'teacher');
    for (const v of [undefined, 'super_admin', ['teacher'], 'TEACHER'])
      assert.equal(lockedLoginRole(null, page('lbphs.gov.bd'), v), null, String(v));
    assert.equal(lockedLoginRole(null, page('demo-dashboard.mutiurrahman.com')), null);
  });
});

describe('role lock persistence', () => {
  it('survives a restart / sign-out (it is stored with the school)', async () => {
    const store = createMemoryKeyValueStore();
    await saveSelection(store, selectionFromLookup(lookup('student')));
    // Sign-out does not touch the selection; a cold start reads it back.
    const reloaded = await loadSelection(store);
    assert.equal(lockedLoginRole(reloaded, codeTenant), 'student');
  });

  it('"use a different code" clears the school and the role together', async () => {
    const store = createMemoryKeyValueStore();
    await saveSelection(store, selectionFromLookup(lookup('admin')));
    await clearSelection(store);
    const after = await loadSelection(store);
    assert.equal(after, null);
    assert.equal(lockedLoginRole(after, { source: 'unresolved', host: null }), null);
  });

  it('a new code for the same school replaces the role (or unlocks it)', async () => {
    const store = createMemoryKeyValueStore();
    await saveSelection(store, selectionFromLookup(lookup('teacher')));
    await saveSelection(store, selectionFromLookup(lookup(null)));
    assert.equal(lockedLoginRole(await loadSelection(store), codeTenant), null);
    await saveSelection(store, selectionFromLookup(lookup('student')));
    assert.equal(lockedLoginRole(await loadSelection(store), codeTenant), 'student');
  });

  it('a tampered stored role does not lock (falls back to all roles)', () => {
    const raw = JSON.stringify({ ...selectionFromLookup(lookup('teacher')), roleHint: 'root' });
    assert.equal(lockedLoginRole(parseSelection(raw), codeTenant), null);
  });
});
