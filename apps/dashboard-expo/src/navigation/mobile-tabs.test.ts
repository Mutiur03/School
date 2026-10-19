import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TEACHER_LINKS } from '@/features/teacher/routes';
import { ADMIN_TAB_SPEC, STUDENT_HAS_MORE, STUDENT_TAB_SPEC } from './tab-spec';

describe('phone bottom tabs', () => {
  it('admin: Notices in the old Results slot (4th), no Results tab', () => {
    assert.deepEqual(
      ADMIN_TAB_SPEC.map((t) => t.href),
      ['/', '/students', '/attendance', '/notices'],
    );
    assert.equal(ADMIN_TAB_SPEC[3].label, 'Notices');
    assert.equal(ADMIN_TAB_SPEC[3].icon, 'notices');
  });

  it('student: Notices in the old Results slot (2nd), More for Result / Profile', () => {
    assert.deepEqual(
      STUDENT_TAB_SPEC.map((t) => t.href),
      ['/student', '/student/notices', '/student/attendance'],
    );
    assert.equal(STUDENT_HAS_MORE, true);
    assert.ok(!STUDENT_TAB_SPEC.some((t) => t.href.startsWith('/student/results')));
  });

  it('teacher has no notices route (its tabs are not changed)', () => {
    const hrefs = Object.values(TEACHER_LINKS).map((l) => String(l.href));
    assert.ok(!hrefs.some((h) => /notice/i.test(h)));
    assert.ok(hrefs.includes('/teacher/results'));
  });
});
