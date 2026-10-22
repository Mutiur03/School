import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Subject } from '@/lib/api';
import { filterSubjects, markParts, subjectsFiltered } from './model';

const sub = (o: Partial<Subject>) =>
  ({
    id: 1,
    name: 'Bangla',
    group: null,
    subject_type: 'main',
    cq_mark: 70,
    mcq_mark: 30,
    practical_mark: 0,
    cq_pass_mark: 23,
    mcq_pass_mark: 10,
    practical_pass_mark: 0,
    ...o,
  }) as Subject;

describe('subject filters', () => {
  const list = [
    sub({ id: 1, name: 'Bangla' }),
    sub({ id: 2, name: 'Physics', group: 'Science', subject_type: 'single' }),
    sub({ id: 3, name: 'Bangla 1st', subject_type: 'paper' }),
  ];
  it('filters by name, group (General = none) and type', () => {
    const none = { q: '', groups: [], types: [] } as const;
    assert.equal(filterSubjects(list, none).length, 3);
    assert.deepEqual(
      filterSubjects(list, { ...none, q: 'bangla' }).map((s) => s.id),
      [1, 3],
    );
    assert.deepEqual(
      filterSubjects(list, { ...none, groups: ['Science'] }).map((s) => s.id),
      [2],
    );
    assert.deepEqual(
      filterSubjects(list, { ...none, groups: ['General'] }).map((s) => s.id),
      [1, 3],
    );
    assert.deepEqual(
      filterSubjects(list, { ...none, types: ['paper'] }).map((s) => s.id),
      [3],
    );
    assert.equal(subjectsFiltered(none), false);
    assert.equal(subjectsFiltered({ ...none, q: 'x' }), true);
  });
  it('lists CQ, MCQ and Practical parts', () => {
    assert.deepEqual(
      markParts(sub({})).map((p) => [p.label, p.mark, p.pass]),
      [
        ['CQ', 70, 23],
        ['MCQ', 30, 10],
        ['Practical', 0, 0],
      ],
    );
  });
});
