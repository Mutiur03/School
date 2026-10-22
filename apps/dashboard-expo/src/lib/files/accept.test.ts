import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchesAccept } from '@/lib/files/accept';

describe('drop zone accept filter', () => {
  it('matches extensions, exact types and wildcards', () => {
    assert.equal(matchesAccept({ name: 'a.PDF', type: '' }, 'application/pdf,.pdf'), true);
    assert.equal(
      matchesAccept({ name: 'a.bin', type: 'application/pdf' }, 'application/pdf'),
      true,
    );
    assert.equal(matchesAccept({ name: 'a.png', type: 'image/png' }, 'image/*'), true);
    assert.equal(matchesAccept({ name: 'a.txt', type: 'text/plain' }, 'image/*,.pdf'), false);
    assert.equal(matchesAccept({ name: 'a.txt', type: 'text/plain' }, ''), true);
  });
});
