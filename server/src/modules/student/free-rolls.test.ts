import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { freeRolls } from './free-rolls.js';

const slot = (roll: number, section = 'A', cls = 6, year = 2027) => ({
  year,
  class: cls,
  section,
  roll,
});

describe('freeRolls (addStudents)', () => {
  it('keeps free file rolls, moves a taken one after the section max', () => {
    // Failed class-6 students already hold A41, A42; admission file has A1, A41, A2.
    const taken = [slot(41), slot(42)];
    assert.deepEqual(freeRolls([slot(1), slot(41), slot(2)], taken), [1, 43, 2]);
  });

  it('a repeated file roll and a later file roll never clash', () => {
    assert.deepEqual(freeRolls([slot(5), slot(5), slot(6)], []), [5, 7, 6]);
  });

  it('sections, classes and years are separate', () => {
    const taken = [slot(1, 'A')];
    assert.deepEqual(
      freeRolls([slot(1, 'B'), slot(1, 'A', 7), slot(1, 'A', 6, 2026)], taken),
      [1, 1, 1],
    );
  });
});
