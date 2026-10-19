import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PILL, pillX } from './tab-indicator-geometry';

test('pillX centres the pill under each equal-width tab', () => {
  const width = 382; // 390px bar minus px-1
  const tab = width / 5;
  for (let i = 0; i < 5; i++) {
    const centre = pillX(i, 5, width) + PILL.width / 2;
    assert.ok(Math.abs(centre - (i + 0.5) * tab) < 1e-9);
  }
});
