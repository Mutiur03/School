import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { examTypeSchema } from '@school/shared-schemas';

describe('examTypeSchema', () => {
  it('rejects names longer than 100 characters', () => {
    const result = examTypeSchema.safeParse({
      name: 'a'.repeat(101),
    });
    assert.equal(result.success, false);
  });

  it('rejects negative sort_order', () => {
    const result = examTypeSchema.safeParse({
      name: 'Midterm',
      sort_order: -1,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error.issues[0]?.message ?? '', /0 or greater/i);
  });

  it('rejects sort_order above Postgres INT4 max', () => {
    const result = examTypeSchema.safeParse({
      name: 'Midterm',
      sort_order: 5_675_675_675,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error.issues[0]?.message ?? '', /too large/i);
  });

  it('accepts a valid name and non-negative sort_order', () => {
    const result = examTypeSchema.safeParse({
      name: 'Midterm',
      sort_order: 0,
    });
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.name, 'Midterm');
    assert.equal(result.data.sort_order, 0);
  });
});
