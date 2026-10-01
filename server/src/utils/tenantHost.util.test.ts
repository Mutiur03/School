import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import type express from 'express';
import { resolveTenantHostname } from './tenantHost.util.js';

const req = (headers: Record<string, string | undefined>, hostname = 'api.example.com') =>
  ({ headers, hostname }) as express.Request;

describe('resolveTenantHostname', () => {
  const prevEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it('ignores client x-tenant-host in production', () => {
    process.env.NODE_ENV = 'production';
    const host = resolveTenantHostname(
      req(
        {
          'x-tenant-host': 'evil.example.com',
          'x-forwarded-host': 'school.example.com',
        },
        'api.example.com',
      ),
    );
    assert.equal(host, 'school.example.com');
  });

  it('allows x-tenant-host override in non-production', () => {
    process.env.NODE_ENV = 'development';
    const host = resolveTenantHostname(
      req({
        'x-tenant-host': 'dev-school.localhost',
      }),
    );
    assert.equal(host, 'dev-school.localhost');
  });
});
