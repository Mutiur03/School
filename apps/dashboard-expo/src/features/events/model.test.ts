import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SchoolEvent } from '@/lib/api';
import { eventsFiltered, filterEvents, pageOf } from './model';

const ev = (id: number, date: string, title: string, location = '', details = ''): SchoolEvent =>
  ({ id, date, title, location, details, image: null, file: null }) as SchoolEvent;
const list = [
  ev(1, '2026-10-01', 'Sports Day', 'Main field', 'annual'),
  ev(2, '2026-12-01', 'Science Fair', 'Hall'),
  ev(3, '2026-11-01', 'Picnic', 'Park', 'sports fun'),
];

describe('events filters', () => {
  it('searches title and details, location, and upcoming/past', () => {
    const none = { q: '', location: '', when: [] } as const;
    assert.equal(filterEvents(list, none, '2026-10-22').length, 3);
    assert.deepEqual(
      filterEvents(list, { ...none, q: 'SPORTS' }, '2026-10-22').map((e) => e.id),
      [1, 3],
    );
    assert.deepEqual(
      filterEvents(list, { ...none, location: 'hall' }, '2026-10-22').map((e) => e.id),
      [2],
    );
    assert.deepEqual(
      filterEvents(list, { ...none, when: ['past'] }, '2026-10-22').map((e) => e.id),
      [1],
    );
    assert.equal(eventsFiltered(none), false);
    assert.equal(eventsFiltered({ ...none, q: ' x ' }), true);
  });
  it('pages client-side and clamps the page', () => {
    const r = pageOf([1, 2, 3, 4, 5], 9, 2);
    assert.deepEqual([r.rows, r.page, r.totalPages], [[5], 3, 3]);
    assert.equal(pageOf([], 1, 25).totalPages, 1);
  });
});
