import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarCells, formatDate } from './format';

describe('student format', () => {
  it('builds October 2026 with a Thursday offset', () => {
    const cells = calendarCells(2026, 9);
    assert.equal(cells.filter((c) => c === null).length, 4);
    assert.equal(cells.at(-1)!.date, '2026-10-31');
  });
  it('formats dates', () => {
    assert.equal(formatDate('2026-10-18T05:00:00.000Z'), '18 Oct 2026');
    assert.equal(formatDate('nope'), '');
  });
});
