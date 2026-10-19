import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextSort, parseSortValue, sortRows, sortValue } from './table-sort';

describe('column-header sort', () => {
  it('cycles unsorted → asc → desc → unsorted, and restarts on another column', () => {
    const a = nextSort(null, 'name');
    assert.deepEqual(a, { key: 'name', order: 'asc' });
    const b = nextSort(a, 'name');
    assert.deepEqual(b, { key: 'name', order: 'desc' });
    assert.equal(nextSort(b, 'name'), null);
    assert.deepEqual(nextSort(b, 'roll'), { key: 'roll', order: 'asc' });
  });

  it('round-trips the Sort select values', () => {
    assert.deepEqual(parseSortValue('date:desc', ['date', 'name']), { key: 'date', order: 'desc' });
    assert.deepEqual(parseSortValue('name', ['date', 'name']), { key: 'name', order: 'asc' });
    assert.equal(parseSortValue('evil:asc', ['date', 'name']), null);
    assert.equal(parseSortValue('', ['date']), null);
    assert.equal(sortValue({ key: 'roll', order: 'asc' }), 'roll:asc');
    assert.equal(sortValue(null), '');
  });

  it('sorts numbers numerically, text naturally, empties last, stable on ties', () => {
    const rows = [
      { n: 'Class 10', r: 2, d: null },
      { n: 'class 9', r: 10, d: 'Dhaka' },
      { n: 'Class 9', r: 1, d: '' },
      { n: 'Ayesha', r: 1, d: 'Barishal' },
    ];
    const by = {
      n: (x: (typeof rows)[0]) => x.n,
      r: (x: (typeof rows)[0]) => x.r,
      d: (x: (typeof rows)[0]) => x.d,
    };
    assert.deepEqual(
      sortRows(rows, { key: 'n', order: 'asc' }, by).map((x) => x.n),
      ['Ayesha', 'class 9', 'Class 9', 'Class 10'],
    );
    assert.deepEqual(
      sortRows(rows, { key: 'r', order: 'desc' }, by).map((x) => x.r),
      [10, 2, 1, 1],
    );
    assert.deepEqual(
      sortRows(rows, { key: 'd', order: 'desc' }, by).map((x) => x.d),
      ['Dhaka', 'Barishal', null, ''],
    );
    assert.deepEqual(sortRows(rows, null, by), rows);
    assert.notEqual(sortRows(rows, null, by), rows);
  });
});

describe('sort select options', () => {
  it('adds the header-picked sort when the select lacks it', async () => {
    const { withSortOption } = await import('./table-sort');
    const opts = [{ value: 'name:asc', label: 'Name (A–Z)' }];
    assert.deepEqual(withSortOption(opts, 'name:asc', { name: 'Name' }), opts);
    assert.deepEqual(withSortOption(opts, 'name:desc', { name: 'Name' }).at(-1), {
      value: 'name:desc',
      label: 'Name, descending',
    });
    assert.deepEqual(withSortOption(opts, 'evil:asc', { name: 'Name' }), opts);
    assert.deepEqual(withSortOption(opts, '', { name: 'Name' }), opts);
  });
});

describe('header sort on lists with a default order', () => {
  it('falls back to the default, never sticking on it', async () => {
    const { headerSortValue } = await import('./table-sort');
    assert.equal(
      headerSortValue({ key: 'name', order: 'asc' }, 'date:desc', 'date:desc'),
      'name:asc',
    );
    assert.equal(headerSortValue(null, 'name:desc', 'date:desc'), 'date:desc');
    assert.equal(headerSortValue(null, 'date:desc', 'date:desc'), 'date:asc');
    assert.equal(headerSortValue(null, 'roll:desc', ''), '');
  });
});
