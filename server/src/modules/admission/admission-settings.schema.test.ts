import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { admissionSettingsSchema } from '@school/shared-schemas';

const basePayload = {
  admission_open: false,
  instruction: 'test',
};

describe('admissionSettingsSchema admission_year', () => {
  it('rejects empty string (must not coerce to 0)', () => {
    const result = admissionSettingsSchema.safeParse({
      ...basePayload,
      admission_year: '',
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error.issues[0]?.message ?? '', /required|4-digit/i);
  });

  it('rejects non-numeric and out-of-range values', () => {
    for (const admission_year of ['abcd', '-5', '0', '999', '3000']) {
      const result = admissionSettingsSchema.safeParse({
        ...basePayload,
        admission_year,
      });
      assert.equal(result.success, false, `expected failure for ${admission_year}`);
    }
  });

  it('accepts a valid 4-digit year as number', () => {
    const result = admissionSettingsSchema.safeParse({
      ...basePayload,
      admission_year: '2026',
    });
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.admission_year, 2026);
  });
});
