import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { niceStep } from './line-chart-scale';

describe('LineChart y scale', () => {
  it('uses whole-number steps whose top tick covers the data', () => {
    for (const max of [0, 1, 2, 3, 4, 7, 9, 13, 48, 312, 1248]) {
      const step = niceStep(max);
      assert.ok(Number.isInteger(step), `step ${step} for ${max}`);
      assert.ok(step * 4 >= max, `top ${step * 4} < ${max}`);
    }
    assert.equal(niceStep(3), 1);
    assert.equal(niceStep(1248), 500);
  });
});
