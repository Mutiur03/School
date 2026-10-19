import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { AuthUser } from '@/lib/api/auth';
import { TEACHER_LINKS } from './routes';
import { passwordFormError, passwordRules, passwordStrength } from './password';
import { initials, teacherProfile } from './profile';
import {
  classScope,
  narrowClasses,
  narrowSections,
  narrowYears,
  parseTeacherLevels,
} from './scope';

const teacher = (levels: unknown): AuthUser => ({ id: 7, role: 'teacher', name: 'Rina', levels });

describe('teacher class scope', () => {
  const levels = parseTeacherLevels(
    teacher([
      { id: 1, class_name: 9, section: 'B', year: 2026, teacher_id: 7, school_id: 3 },
      { id: 2, class_name: 8, section: 'A', year: 2026 },
      { id: 3, class_name: '9', section: 'A', year: '2026' },
      { class_name: 9, section: 'B', year: 2026 }, // duplicate
      { class_name: 6, section: '', year: 2026 }, // junk
      { class_name: 'x', section: 'A', year: 2026 }, // junk
      null,
    ]),
  );
  const scope = classScope(levels);

  it('parses, dedupes and sorts the session levels', () => {
    assert.deepEqual(levels, [
      { year: 2026, cls: 8, section: 'A' },
      { year: 2026, cls: 9, section: 'A' },
      { year: 2026, cls: 9, section: 'B' },
    ]);
    assert.deepEqual(parseTeacherLevels({ id: 1, role: 'teacher' }), []);
    assert.deepEqual(parseTeacherLevels(null), []);
  });

  it('lists years, classes and sections per year', () => {
    assert.deepEqual(scope.years, [2026]);
    assert.deepEqual(scope.classes(2026), [8, 9]);
    assert.deepEqual(scope.sections(2026, 9), ['A', 'B']);
    assert.deepEqual(scope.classes(2025), []);
    assert.equal(scope.label(2026), '8A, 9A, 9B');
    assert.equal(scope.only(2026), null);
    assert.deepEqual(classScope([{ year: 2026, cls: 7, section: 'B' }]).only(2026), {
      year: 2026,
      cls: 7,
      section: 'B',
    });
  });

  it('never widens what the pickers offer', () => {
    // Admin (no scope): unchanged.
    assert.deepEqual(narrowClasses([6, 7, 8, 9, 10], null, 2026), [6, 7, 8, 9, 10]);
    assert.deepEqual(narrowSections(['A', 'B', 'C'], null, 2026, 9), ['A', 'B', 'C']);
    assert.deepEqual(narrowYears([2026, 2025], null, 2026), [2026, 2025]);
    // Teacher: intersection only; an exam without their class offers nothing.
    assert.deepEqual(narrowClasses([6, 7, 8, 9, 10], scope, 2026), [8, 9]);
    assert.deepEqual(narrowClasses([6, 7], scope, 2026), []);
    assert.deepEqual(narrowClasses([8, 9], scope, 2025), []);
    assert.deepEqual(narrowSections(['A', 'B', 'C'], scope, 2026, 8), ['A']);
    assert.deepEqual(narrowSections(['A'], scope, 2026, 10), []);
    assert.deepEqual(narrowYears([2026, 2025, 2024], scope, 2026), [2026]);
    // No assignment at all: only the current year, and no classes.
    const none = classScope([]);
    assert.deepEqual(narrowYears([2026, 2025], none, 2026), [2026]);
    assert.deepEqual(narrowClasses([6, 7, 8], none, 2026), []);
  });
});

describe('teacher password rules (web Security tab)', () => {
  it('scores the four requirements', () => {
    assert.equal(passwordStrength('').score, 0);
    assert.equal(passwordStrength('').label, 'Weak');
    assert.equal(passwordStrength('abcdefgh').label, 'Weak');
    assert.equal(passwordStrength('Abcdefgh').label, 'Fair');
    assert.equal(passwordStrength('Abcdefg1').label, 'Good');
    assert.deepEqual(passwordStrength('Abcdef1!'), {
      score: 4,
      label: 'Strong',
      bar: 'bg-emerald-500',
    });
    assert.deepEqual(
      passwordRules('A1!').map((r) => r.met),
      [false, true, true, true],
    );
    // Non-ASCII letters count as "special", same regex as the web page.
    assert.equal(passwordRules('Passwordé1')[3]!.met, true);
  });
  it('checks the form in the web order', () => {
    const f = { currentPassword: 'old', newPassword: 'Abcdef1!', confirmPassword: 'Abcdef1!' };
    assert.equal(passwordFormError(f), null);
    assert.equal(passwordFormError({ ...f, currentPassword: '' }), 'Enter your current password');
    assert.equal(
      passwordFormError({ ...f, newPassword: 'abc', confirmPassword: 'abc' }),
      'Password does not meet all security requirements',
    );
    assert.equal(
      passwordFormError({ ...f, confirmPassword: 'Abcdef1?' }),
      'New passwords do not match',
    );
  });
});

describe('teacher profile', () => {
  it('reads the teacher payload fields and ignores other roles', () => {
    const p = teacherProfile({
      id: 7,
      role: 'teacher',
      name: ' Rina Das ',
      email: 'r@s.test',
      phone: '',
      designation: 'Assistant Teacher',
      address: null,
      image: 'school-3/teachers/7.png',
      signature: 42,
    });
    assert.deepEqual(p, {
      id: 7,
      name: 'Rina Das',
      email: 'r@s.test',
      phone: null,
      designation: 'Assistant Teacher',
      address: null,
      image: 'school-3/teachers/7.png',
      signature: null,
    });
    assert.equal(teacherProfile({ id: 1, role: 'admin' }), null);
    assert.equal(initials('Rina Das Gupta'), 'RD');
    assert.equal(initials(''), '?');
  });
});

describe('teacher menu', () => {
  const links = Object.values(TEACHER_LINKS);
  it('mirrors the web teacher sidebar', () => {
    assert.deepEqual(
      links.map((l) => l.label),
      [
        'Dashboard',
        "Students' Info",
        'Attendance',
        'Running Away',
        'Add Marks',
        'View Result',
        'Settings',
      ],
    );
    for (const l of links) assert.ok(l.webPath.startsWith('/teacher/'), l.webPath);
  });
  it('only links to teacher routes that exist', () => {
    const appDir = join(__dirname, '..', '..', '..', 'app');
    for (const { href } of links) {
      assert.ok(href.startsWith('/teacher'), href);
      const file = href === '/teacher' ? 'teacher/index.tsx' : `${href.slice(1)}.tsx`;
      assert.ok(existsSync(join(appDir, file)), `missing route file for ${href}`);
    }
  });
});
