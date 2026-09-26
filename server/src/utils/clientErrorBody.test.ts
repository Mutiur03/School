import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from './ApiError.js';
import { buildClientErrorBody } from './clientErrorBody.js';

describe('buildClientErrorBody', () => {
  it('ApiError(400) body has message/errors but never stack or path frames', () => {
    const err = new ApiError(400, 'title, start_date, and end_date are required');
    // Simulate a real Node stack with workspace + .ts frames (what used to leak).
    err.stack = [
      'Error: title, start_date, and end_date are required',
      '    at <anonymous> (/workspace/school/server/src/modules/holiday/holiday.controller.ts:12:13)',
      '    at <anonymous> (/workspace/school/server/src/utils/asyncHandler.ts:6:21)',
      '    at Layer.handle [as handle_request] (/workspace/school/server/node_modules/express/lib/router/layer.js:95:5)',
    ].join('\n');

    const body = buildClientErrorBody(err.message, err.errors || []);
    const serialized = JSON.stringify(body);

    assert.equal(body.success, false);
    assert.equal(body.message, 'title, start_date, and end_date are required');
    assert.deepEqual(body.errors, []);
    // Safe mirror for dashboard clients that read response.data.error
    assert.equal(body.error, body.message);

    assert.equal(serialized.includes('stack'), false);
    assert.equal(serialized.includes('/workspace'), false);
    assert.equal(serialized.includes('.ts:'), false);
    assert.equal(serialized.includes('node_modules'), false);
    assert.equal(serialized.includes(err.stack!), false);
    assert.equal('stack' in body, false);
  });

  it('never copies Error.stack even when NODE_ENV is development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const err = new ApiError(400, 'validation failed');
      err.stack = 'Error: validation failed\n    at boom (/workspace/app/file.ts:1:1)';
      const body = buildClientErrorBody(err.message, []);
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes('/workspace'), false);
      assert.equal(serialized.includes('.ts:'), false);
      assert.equal(body.error, 'validation failed');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('preserves ApiError.errors array without leaking internals', () => {
    const err = new ApiError(400, 'Invalid input', [{ path: 'title', message: 'Required' }]);
    const body = buildClientErrorBody(err.message, err.errors);
    assert.deepEqual(body.errors, [{ path: 'title', message: 'Required' }]);
    assert.equal(JSON.stringify(body).includes('/workspace'), false);
  });
});
