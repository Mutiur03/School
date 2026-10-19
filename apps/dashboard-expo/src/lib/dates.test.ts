/** Date helpers behind the native date picker (local-time, no UTC day shift). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateFieldLabel, parseIsoDate, toIsoDate } from './dates';

describe('native date field helpers', () => {
  it('parses only real YYYY-MM-DD dates, in local time', () => {
    const d = parseIsoDate('2026-04-15')!;
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 3, 15]);
    assert.equal(parseIsoDate('2026-02-30'), null);
    assert.equal(parseIsoDate('15/04/2026'), null);
    assert.equal(parseIsoDate(''), null);
  });

  it('formats the picked day without shifting it across midnight', () => {
    assert.equal(toIsoDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(toIsoDate(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
    assert.equal(toIsoDate(parseIsoDate('2024-02-29')!), '2024-02-29');
  });

  it('labels the field for display', () => {
    assert.equal(dateFieldLabel('2026-04-15'), '15 Apr 2026');
    assert.equal(dateFieldLabel(''), '');
    assert.equal(dateFieldLabel('garbage'), 'garbage');
  });
});
