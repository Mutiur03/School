import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateSchoolCodeDto } from './dto/create-school-code.dto.js';
import { generateSchoolCode, normalizeSchoolCode } from './school-code.util.js';

export const MAX_ACTIVE_CODES = 50;
const GENERATE_ATTEMPTS = 5;

const SELECT = {
  id: true,
  code: true,
  role_hint: true,
  created_by: true,
  created_at: true,
  expires_at: true,
  revoked_at: true,
} as const;

type CodeRow = Prisma.school_access_codesGetPayload<{ select: typeof SELECT }>;

export const codeStatus = (row: Pick<CodeRow, 'revoked_at' | 'expires_at'>, now = new Date()) =>
  row.revoked_at ? 'revoked' : row.expires_at && row.expires_at <= now ? 'expired' : 'active';

const withStatus = (row: CodeRow) => ({ ...row, status: codeStatus(row) });

/** Admin side: list / create / revoke the current school's codes (tenant-scoped by RLS + where). */
@Injectable()
export class SchoolCodesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async findAll(schoolId: number) {
    const rows = await this.prisma.school_access_codes.findMany({
      where: { school_id: schoolId },
      orderBy: { created_at: 'desc' },
      select: SELECT,
    });
    return rows.map(withStatus);
  }

  async create(schoolId: number, adminId: number | null, dto: CreateSchoolCodeDto) {
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Expiry must be in the future');
    }
    const active = await this.prisma.school_access_codes.count({
      where: {
        school_id: schoolId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    });
    if (active >= MAX_ACTIVE_CODES) {
      throw new BadRequestException(`At most ${MAX_ACTIVE_CODES} active codes; revoke one first`);
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const row = await this.prisma.school_access_codes.create({
          data: {
            school_id: schoolId,
            code: generateSchoolCode(),
            role_hint: dto.role_hint ?? null,
            created_by: adminId,
            expires_at: expiresAt,
          },
          select: SELECT,
        });
        return withStatus(row);
      } catch (error) {
        const collision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!collision || attempt >= GENERATE_ATTEMPTS) throw error;
      }
    }
  }

  /** Revoke (soft delete, kept for audit). Idempotent: revoking twice keeps the first time. */
  async remove(schoolId: number, id: number) {
    const row = await this.prisma.school_access_codes.findFirst({
      where: { id, school_id: schoolId },
      select: SELECT,
    });
    if (!row) throw new NotFoundException('School code not found');
    if (row.revoked_at) return withStatus(row);
    const updated = await this.prisma.school_access_codes.update({
      where: { id, school_id: schoolId },
      data: { revoked_at: new Date() },
      select: SELECT,
    });
    return withStatus(updated);
  }
}

export interface LookupRow {
  name: string;
  short_name: string | null;
  logo: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  role_hint: string | null;
}

export interface SchoolCodeLookupResult {
  school: { name: string; shortName: string | null; logo: string | null };
  tenant: { host: string; apiBaseUrl: string };
  roleHint: 'admin' | 'teacher' | 'student' | null;
}

/** Same body for malformed, unknown, revoked and expired codes: no enumeration hints. */
export const LOOKUP_NOT_FOUND = 'School code not found';

/**
 * Pre-auth side. The only query is app.lookup_school_access_code(), the narrow SECURITY DEFINER
 * function from the migration; no table is read across tenants with school_app's own rights.
 */
@Injectable()
export class SchoolCodeLookupService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(input: string, hostFor: (row: LookupRow) => string | null) {
    const code = normalizeSchoolCode(input);
    if (!code) throw new NotFoundException(LOOKUP_NOT_FOUND);
    const rows = await this.prisma.$queryRaw<LookupRow[]>`
      SELECT * FROM app.lookup_school_access_code(${code})`;
    const row = rows[0];
    const host = row ? hostFor(row) : null;
    if (!row || !host) throw new NotFoundException(LOOKUP_NOT_FOUND);
    return {
      school: { name: row.name, shortName: row.short_name, logo: row.logo },
      tenant: { host, apiBaseUrl: tenantApiBaseUrl(host) },
      roleHint: (row.role_hint as SchoolCodeLookupResult['roleHint']) ?? null,
    } satisfies SchoolCodeLookupResult;
  }
}

/**
 * Public host the tenant middleware resolves back to this school: its custom domain, else
 * `<subdomain><TENANT_HOST_SUFFIX>` (default `-dashboard.mutiurrahman.com` in production, served
 * by the tenant-router worker; `.localhost` elsewhere).
 */
export function tenantHostFor(row: Pick<LookupRow, 'subdomain' | 'custom_domain'>): string | null {
  if (row.custom_domain) return row.custom_domain.toLowerCase();
  if (!row.subdomain) return null;
  const suffix =
    process.env.TENANT_HOST_SUFFIX ||
    (process.env.NODE_ENV === 'production' ? '-dashboard.mutiurrahman.com' : '.localhost');
  return `${row.subdomain.toLowerCase()}${suffix}`;
}

export function tenantApiBaseUrl(host: string): string {
  if (process.env.NODE_ENV === 'production') return `https://${host}`;
  return `http://${host}:${process.env.PORT || '5000'}`;
}
