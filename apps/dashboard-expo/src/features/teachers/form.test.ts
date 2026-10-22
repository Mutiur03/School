import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TeacherRow } from '@/lib/api';
import { designationChoices, teacherListView, teacherStats } from './form';

const t = (id: number, o: Partial<TeacherRow>) =>
  ({
    id,
    name: `T${id}`,
    email: `t${id}@x.bd`,
    phone: '',
    designation: null,
    address: '',
    image: null,
    signature: null,
    ...o,
  }) as TeacherRow;
const rows = [
  t(1, { designation: 'Headmaster', image: 'a.png', signature: 's.png' }),
  t(2, { designation: 'Assistant Teacher', image: 'b.png' }),
  t(3, { designation: 'Librarian' }),
];

describe('teacher list helpers', () => {
  it('filters by designation and keeps search working', () => {
    assert.deepEqual(
      teacherListView(rows, '', null, ['Headmaster']).map((r) => r.id),
      [1],
    );
    assert.deepEqual(
      teacherListView(rows, 't2', null, ['Assistant Teacher']).map((r) => r.id),
      [2],
    );
    assert.equal(teacherListView(rows, '', null).length, 3);
  });
  it('counts photos and signatures', () => {
    assert.deepEqual(teacherStats(rows), { total: 3, withPhoto: 2, withSignature: 1 });
  });
  it('offers the fixed designations plus saved ones', () => {
    const c = designationChoices(rows);
    assert.ok(c.includes('Senior Teacher') && c.includes('Librarian'));
    assert.equal(new Set(c).size, c.length);
  });
});
