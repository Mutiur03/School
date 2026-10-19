import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bulkFourthDone,
  bulkFourthMessage,
  fourthFilterOptions,
  fourthFilterParam,
  fourthSubjectChoices,
} from './fourth-subject';

const sub = (id: number, name: string, cls: number, group: string | null, extra = {}) => ({
  id,
  name,
  class: cls,
  year: 2026,
  group,
  subject_type: 'single' as const,
  ...extra,
});
const subjects = [
  sub(1, 'Higher Math', 9, 'Science'),
  sub(2, 'Agriculture', 9, null),
  sub(3, 'Economics', 9, 'Humanities'),
  sub(4, 'Physics', 9, 'Science', { subject_type: 'main' as const }),
  sub(5, 'Higher Math', 10, 'Science'),
  sub(6, 'Agriculture', 9, null, { year: 2025 }),
];

describe('4th subject', () => {
  it('offers this year’s non-main subjects of the class and group', () => {
    assert.deepEqual(
      fourthSubjectChoices(subjects, 9, 'Science', 2026).map((s) => s.id),
      [2, 1],
    );
    assert.deepEqual(
      fourthSubjectChoices(subjects, 9, 'Humanities', 2026).map((s) => s.id),
      [2, 3],
    );
    assert.deepEqual(
      fourthSubjectChoices(subjects, 9, null, 2026).map((s) => s.id),
      [2, 3, 1],
    );
    assert.deepEqual(fourthSubjectChoices(subjects, 8, 'Science', 2026), []);
    assert.deepEqual(
      fourthSubjectChoices(subjects, 9, 'Science', 2025).map((s) => s.id),
      [6],
    );
  });

  it('builds the filter from assigned subjects, merging same names', () => {
    const opts = fourthFilterOptions([
      { id: 1, name: 'Higher Math' },
      { id: 5, name: 'Higher Math' },
      { id: 2, name: 'Agriculture' },
    ]);
    assert.deepEqual(opts, [
      { value: 'none', label: 'None' },
      { value: '1,5', label: 'Higher Math' },
      { value: '2', label: 'Agriculture' },
    ]);
    assert.deepEqual(fourthFilterParam(['none', '1,5']), ['none', '1', '5']);
  });

  it('uses the web’s wording', () => {
    assert.equal(
      bulkFourthMessage(9, 'Science', 2026, 'Higher Math'),
      'Set 4th subject to "Higher Math" for all Class 9 Science students (2026)? This overwrites existing 4th subjects.',
    );
    assert.equal(
      bulkFourthMessage(10, 'Commerce', 2026, null),
      'Clear 4th subject for all Class 10 Commerce students (2026)?',
    );
    assert.equal(bulkFourthDone(3), '4th subject updated for 3 student(s)');
  });
});
