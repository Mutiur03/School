import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import {
  codeStatus,
  LOOKUP_NOT_FOUND,
  MAX_ACTIVE_CODES,
  SchoolCodeLookupService,
  SchoolCodesService,
  tenantApiBaseUrl,
  tenantHostFor,
} from './school-codes.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma: no DB (runs in CI).
const findMany = jest.fn<Fn>();
const findFirst = jest.fn<Fn>();
const count = jest.fn<Fn>();
const create = jest.fn<Fn>();
const update = jest.fn<Fn>();
const queryRaw = jest.fn<(...args: any[]) => Promise<any>>();
const prisma = {
  school_access_codes: { findMany, findFirst, count, create, update },
  $queryRaw: queryRaw,
} as unknown as PrismaClient;
const codes = new SchoolCodesService(prisma);
const lookups = new SchoolCodeLookupService(prisma);
const row = (over: object = {}) => ({
  id: 1,
  code: 'ABC-7K4Q',
  role_hint: null,
  created_by: 5,
  created_at: new Date(),
  expires_at: null,
  revoked_at: null,
  ...over,
});

afterEach(() => jest.resetAllMocks());

describe('SchoolCodesService', () => {
  it('findAll is scoped to the school and adds status', async () => {
    findMany.mockResolvedValue([row(), row({ id: 2, revoked_at: new Date() })]);
    const list = await codes.findAll(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { school_id: 3 } }));
    expect(list.map((c) => c.status)).toEqual(['active', 'revoked']);
  });

  it('create stores school, creator, role hint; code is generated server-side', async () => {
    count.mockResolvedValue(0);
    create.mockResolvedValue(row({ role_hint: 'teacher' }));
    await codes.create(3, 5, { role_hint: 'teacher' });
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ school_id: 3, created_by: 5, role_hint: 'teacher' });
    expect(data.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{4}$/);
  });

  it('create retries on a code collision', async () => {
    count.mockResolvedValue(0);
    create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't' }),
      )
      .mockResolvedValue(row());
    await codes.create(3, 5, {});
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('create refuses past expiry and too many active codes', async () => {
    await expect(codes.create(3, 5, { expires_at: '2000-01-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    count.mockResolvedValue(MAX_ACTIVE_CODES);
    await expect(codes.create(3, 5, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('remove revokes within the school; unknown/other school → 404', async () => {
    findFirst.mockResolvedValueOnce(row());
    update.mockResolvedValue(row({ revoked_at: new Date() }));
    expect((await codes.remove(3, 1)).status).toBe('revoked');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, school_id: 3 } }),
    );
    findFirst.mockResolvedValueOnce(null);
    await expect(codes.remove(4, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove is idempotent', async () => {
    findFirst.mockResolvedValue(row({ revoked_at: new Date('2026-01-01') }));
    await codes.remove(3, 1);
    expect(update).not.toHaveBeenCalled();
  });

  it('codeStatus', () => {
    const now = new Date('2026-10-18T00:00:00Z');
    expect(codeStatus({ revoked_at: null, expires_at: null }, now)).toBe('active');
    expect(codeStatus({ revoked_at: null, expires_at: new Date('2026-10-17') }, now)).toBe(
      'expired',
    );
    expect(codeStatus({ revoked_at: now, expires_at: null }, now)).toBe('revoked');
  });
});

describe('SchoolCodeLookupService', () => {
  const lookupRow = {
    name: 'Alpha High',
    short_name: 'AHS',
    logo: 'logos/a.png',
    subdomain: 'alpha',
    custom_domain: null,
    role_hint: 'teacher',
  };

  it('returns only public info + host + role hint', async () => {
    queryRaw.mockResolvedValue([lookupRow]);
    const res = await lookups.create('abc 7k4q', () => 'alpha.localhost');
    expect(res).toEqual({
      school: { name: 'Alpha High', shortName: 'AHS', logo: 'logos/a.png' },
      tenant: { host: 'alpha.localhost', apiBaseUrl: tenantApiBaseUrl('alpha.localhost') },
      roleHint: 'teacher',
    });
    // Normalised code is bound as a parameter, never interpolated.
    expect(queryRaw.mock.calls[0].slice(1)).toEqual(['ABC-7K4Q']);
  });

  it.each([
    ['malformed', 'AB0-7K4Q', []],
    ['unknown/revoked/expired (function returns no row)', 'ABC-7K4Q', []],
    ['school without a routable host', 'ABC-7K4Q', [{ ...lookupRow, subdomain: null }]],
  ])('%s → generic 404', async (_n, code, rows) => {
    queryRaw.mockResolvedValue(rows);
    await expect(lookups.create(code, tenantHostFor)).rejects.toMatchObject({
      status: 404,
      message: LOOKUP_NOT_FOUND,
    });
  });
});

describe('tenantHostFor', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('custom domain wins', () => {
    expect(tenantHostFor({ subdomain: 'a', custom_domain: 'Lbphs.gov.bd' })).toBe('lbphs.gov.bd');
  });
  it('production subdomain uses the dashboard worker host', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.TENANT_HOST_SUFFIX;
    expect(tenantHostFor({ subdomain: 'alpha', custom_domain: null })).toBe(
      'alpha-dashboard.mutiurrahman.com',
    );
    expect(tenantApiBaseUrl('alpha-dashboard.mutiurrahman.com')).toBe(
      'https://alpha-dashboard.mutiurrahman.com',
    );
  });
  it('suffix is configurable', () => {
    process.env.TENANT_HOST_SUFFIX = '.example.test';
    expect(tenantHostFor({ subdomain: 'alpha', custom_domain: null })).toBe('alpha.example.test');
  });
});
