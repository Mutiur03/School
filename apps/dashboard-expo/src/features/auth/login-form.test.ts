import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lookupErrorMessage, submittableCode } from '@/features/join/join-form';
import { ApiError } from '@/lib/api/errors';
import { homeForRole } from '@/navigation/role-routes';
import { buildLoginBody, loginErrorMessage } from './login-form';

const http = (status: number) => new ApiError({ kind: 'http', status, message: 'server said' });

describe('code entry', () => {
  it('only complete, valid codes are submittable', () => {
    assert.equal(submittableCode('ABC-7K'), null);
    assert.equal(submittableCode('abc-7k4q'), 'ABC-7K4Q');
  });
  it('errors are generic per class (no hint whether a code ever existed)', () => {
    assert.match(lookupErrorMessage(http(404)), /couldn't find a school/);
    assert.match(lookupErrorMessage(http(429)), /Too many attempts/);
    assert.match(
      lookupErrorMessage(new ApiError({ kind: 'network', message: 'x' })),
      /reach the server/,
    );
    assert.match(lookupErrorMessage(new Error('x')), /Something went wrong/);
  });
});

describe('login form', () => {
  it('builds the role-specific body', () => {
    assert.deepEqual(buildLoginBody('admin', ' boss ', 'pw'), {
      ok: true,
      value: { role: 'admin', body: { username: 'boss', password: 'pw' } },
    });
    assert.deepEqual(buildLoginBody('teacher', 'T@X.io', 'pw'), {
      ok: true,
      value: { role: 'teacher', body: { email: 't@x.io', password: 'pw' } },
    });
    assert.deepEqual(buildLoginBody('student', '123456', 'pw'), {
      ok: true,
      value: { role: 'student', body: { login_id: '123456', password: 'pw' } },
    });
  });
  it('validates like the shared schemas', () => {
    assert.equal(buildLoginBody('student', '12345', 'pw').ok, false);
    assert.equal(buildLoginBody('teacher', 'nope', 'pw').ok, false);
    assert.equal(buildLoginBody('admin', '', 'pw').ok, false);
    assert.equal(buildLoginBody('admin', 'a', '').ok, false);
  });
  it('credential errors never say which field was wrong', () => {
    for (const s of [400, 401, 404]) assert.match(loginErrorMessage(http(s)), /didn't match/);
    assert.match(loginErrorMessage(http(402)), /subscription/);
  });
});

describe('role routing', () => {
  it('admin gets the dashboard, others their placeholder, super_admin nothing', () => {
    assert.equal(homeForRole('admin'), '/');
    assert.equal(homeForRole('teacher'), '/teacher');
    assert.equal(homeForRole('student'), '/student');
    assert.equal(homeForRole('super_admin'), null);
    assert.equal(homeForRole(undefined), null);
  });
});
