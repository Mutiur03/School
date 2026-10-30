import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPreTenantRequest } from './pre-tenant-routes.js';

describe('isPreTenantRequest', () => {
  it('lets the school-code lookup through (POST only)', () => {
    assert.equal(isPreTenantRequest('POST', '/api/school-code-lookups'), true);
    assert.equal(isPreTenantRequest('GET', '/api/school-code-lookups'), false);
  });

  it('treats every platform (super-admin) path as pre-tenant', () => {
    for (const p of [
      '/api/platform/schools',
      '/api/platform/schools/3/billing',
      '/api/platform/sms-overview',
      '/API/Platform/schools/',
    ]) {
      assert.equal(isPreTenantRequest('GET', p), true, p);
    }
  });

  it('keeps tenant school routes (and the removed /api/schools paths) behind the tenant middlewares', () => {
    for (const p of [
      '/api/schools',
      '/api/schools/3',
      '/api/schools/sms-overview',
      '/api/schools/public',
      '/api/schools/billing',
      '/api/schools/subscription-access/',
      '/API/Schools/Billing',
      '/api/school',
      '/api/school/billing',
      '/api/school/subscription-access',
      '/api/schoolsx',
      '/api/platformx',
      '/api/levels',
    ]) {
      assert.equal(isPreTenantRequest('GET', p), false, p);
    }
  });
});
