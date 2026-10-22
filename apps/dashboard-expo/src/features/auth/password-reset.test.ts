import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '@/lib/api';
import {
  buildResetBody,
  checkIdentifier,
  cleanCode,
  isCodeComplete,
  isCodeRejected,
  maskIdentifier,
  passwordProblem,
  passwordScore,
  resendLabel,
  resetErrorMessage,
  secondsLeft,
  stepNumber,
} from './password-reset';

const f = { identifier: ' 123456 ', code: '654321', newPassword: 'abcdefgh', confirm: 'abcdefgh' };
const http = (status: number, message = 'x') => new ApiError({ kind: 'http', status, message });

describe('password reset', () => {
  it('validates the identifier per role', () => {
    assert.deepEqual(checkIdentifier('student', ' 123456 '), { ok: true, value: '123456' });
    assert.equal(checkIdentifier('student', '12345').ok, false);
    assert.deepEqual(checkIdentifier('teacher', ' A@B.com '), { ok: true, value: 'a@b.com' });
    assert.equal(checkIdentifier('teacher', 'nope').ok, false);
    assert.equal(checkIdentifier('teacher', ' ').ok, false);
  });

  it('builds each step body', () => {
    assert.deepEqual(buildResetBody('student', 'request', f), {
      ok: true,
      body: { login_id: '123456' },
    });
    assert.deepEqual(buildResetBody('teacher', 'check-code', { ...f, identifier: 'a@b.co' }), {
      ok: true,
      body: { email: 'a@b.co', code: '654321' },
    });
    assert.deepEqual(buildResetBody('student', 'verify', f), {
      ok: true,
      body: { login_id: '123456', code: '654321', newPassword: 'abcdefgh' },
    });
  });

  it('rejects short codes, mismatches and short passwords', () => {
    assert.equal(buildResetBody('student', 'check-code', { ...f, code: '12' }).ok, false);
    assert.equal(buildResetBody('student', 'verify', { ...f, confirm: 'x' }).ok, false);
    assert.equal(
      buildResetBody('student', 'verify', { ...f, newPassword: 'abc', confirm: 'abc' }).ok,
      false,
    );
    assert.equal(passwordProblem('abcdefgh', 'abcdefgh'), null);
  });

  it('cleans pasted codes', () => {
    assert.equal(cleanCode('12 34-56 78'), '123456');
    assert.equal(cleanCode('ab'), '');
    assert.equal(isCodeComplete('123456'), true);
    assert.equal(isCodeComplete('12345'), false);
  });

  it('masks where the code went', () => {
    assert.equal(maskIdentifier('teacher', 'rahim@school.edu.bd'), 'ra•••@school.edu.bd');
    assert.equal(maskIdentifier('teacher', 'a@x.bd'), 'a•••@x.bd');
    assert.equal(maskIdentifier('student', '240119'), 'Login ID 240119');
  });

  it('counts the resend cooldown down and never below zero', () => {
    assert.equal(secondsLeft(10_000, 4_500), 6);
    assert.equal(secondsLeft(10_000, 20_000), 0);
    assert.equal(resendLabel(42), 'Resend code in 42s');
    assert.equal(resendLabel(0), 'Resend code');
  });

  it('maps errors', () => {
    assert.match(resetErrorMessage(new ApiError({ kind: 'network', message: 'n' })), /Can't reach/);
    assert.match(resetErrorMessage(http(429)), /Too many/);
    assert.equal(
      resetErrorMessage(http(400, 'Invalid or expired code')),
      'Invalid or expired code',
    );
    assert.equal(isCodeRejected(http(400)), true);
    assert.equal(isCodeRejected(http(500)), false);
  });

  it('scores passwords and numbers the steps', () => {
    assert.equal(passwordScore(''), 0);
    assert.equal(passwordScore('abc'), 0);
    assert.ok(passwordScore('abcdefgh') >= 1);
    assert.equal(passwordScore('Abcdefgh1234!'), 4);
    assert.deepEqual(
      (['request', 'code', 'password', 'done'] as const).map((s) => stepNumber(s)),
      [1, 2, 3, 3],
    );
  });
});
