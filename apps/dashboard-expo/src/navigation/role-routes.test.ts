/** `next` return path after sign-in: same-app, own-role pages only. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loginHrefFor, safeNext } from './role-routes';

describe('safeNext', () => {
  it('returns each role to its own pages, with query strings', () => {
    assert.equal(
      safeNext('/platform/exam-types', 'super_admin', 'platform'),
      '/platform/exam-types',
    );
    assert.equal(safeNext('/teacher/marks?x=1', 'teacher', 'school-code'), '/teacher/marks?x=1');
    assert.equal(safeNext('/student/results', 'student', 'school-code'), '/student/results');
    assert.equal(safeNext('/students/12', 'admin', 'school-code'), '/students/12');
  });

  it("never returns into another role's area", () => {
    assert.equal(safeNext('/teacher/marks', 'admin', 'school-code'), null);
    assert.equal(safeNext('/student', 'teacher', 'school-code'), null);
    assert.equal(safeNext('/platform/schools', 'admin', 'school-code'), null);
    assert.equal(safeNext('/students', 'super_admin', 'platform'), null);
  });

  it('rejects other origins, auth screens and junk', () => {
    for (const bad of [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      '/login',
      '/join',
      '/platform-login',
      '',
      undefined,
      5,
    ]) {
      assert.equal(safeNext(bad, 'admin', 'school-code'), null, String(bad));
    }
  });
});

describe('loginHrefFor', () => {
  it('carries the wanted page, except for the unresolved /join', () => {
    assert.deepEqual(loginHrefFor('platform', '/platform/sms'), {
      pathname: '/platform-login',
      params: { next: '/platform/sms' },
    });
    assert.equal(loginHrefFor('unresolved', '/x'), '/join');
  });
});
