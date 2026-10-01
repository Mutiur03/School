import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import {
  assertFormStatusChangeAllowed,
  assertPendingFormEditAllowed,
} from './publicFormAccess.util.js';

const anonReq = {} as Request;

describe('publicFormAccess', () => {
  it('allows anonymous pending → approved self-confirm', () => {
    assert.doesNotThrow(() => assertFormStatusChangeAllowed(anonReq, 'pending', 'approved'));
  });

  it('allows anonymous edit while pending', () => {
    assert.doesNotThrow(() => assertPendingFormEditAllowed(anonReq, 'pending'));
  });
});
