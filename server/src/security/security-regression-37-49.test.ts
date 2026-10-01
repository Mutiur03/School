/**
 * Security regression suite for issues #37–#49 (intended secure outcomes).
 *
 * Run on this branch:
 *   pnpm --filter server run test:security
 * Run entire server unit tests (includes these):
 *   pnpm --filter server run test
 *
 * Expect many failures on `main` until security fixes land (e.g. PR #50 on `fix/security-37-49`).
 */
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import type express from 'express';
import { ApiError } from '@/utils/ApiError.js';
import { resolveTenantHostname } from '@/utils/tenantHost.util.js';
import {
  importOrFail,
  PUBLIC_PERSONNEL_ADMIN_ONLY_KEYS,
  PUBLIC_PERSONNEL_ANON_CONTACT_KEYS,
  readServerSource,
  sampleTeacherRow,
  withSchoolRls,
} from './securityRegression.helpers.js';

describe('security regression #37–#49 (intended secure outcomes)', () => {
  describe('1. Cross-tenant form access → 404; foreign R2 keys → 403', () => {
    it('admission forms resolve within current tenant (findFormInTenant + school_id)', () => {
      const src = readServerSource('modules/admission/form/admission-form.service.ts');
      assert.match(src, /findFormInTenant/);
      assert.match(src, /school_id:\s*requireSchoolId\(\)/);
    });

    it('assertTenantR2Key rejects keys outside the active school prefix', async () => {
      const assertTenantR2Key = (await importOrFail(
        '@/utils/r2Key.util.js',
        'assertTenantR2Key',
      )) as (key: string) => void;

      withSchoolRls(1, () => {
        assert.doesNotThrow(() => assertTenantR2Key('1/notices/file.pdf'));
        assert.throws(
          () => assertTenantR2Key('4/notices/file.pdf'),
          (err: unknown) => {
            assert.ok(err instanceof ApiError);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /Invalid storage key for this school/i);
            return true;
          },
        );
      });
    });

    it('admission-result multipart paths validate tenant R2 keys before signing', () => {
      const src = readServerSource('modules/admission/result/admission-result.service.ts');
      assert.match(src, /assertTenantR2Key/);
      assert.match(src, /signMultipartUploadPart[\s\S]*assertTenantR2Key\(data\.key\)/);
      assert.match(src, /completeMultipartUploadHandler[\s\S]*assertTenantR2Key\(data\.key\)/);
    });

    it('holiday update/delete scope rows by tenant school_id', () => {
      const src = readServerSource('modules/holiday/holiday.service.ts');
      assert.match(src, /deleteHoliday[\s\S]*findFirst[\s\S]*school_id:\s*schoolId/);
      assert.match(src, /updateHoliday[\s\S]*findFirst[\s\S]*school_id:\s*schoolId/);
    });
  });

  describe('2. Public teachers/staff: anon gets phone + email; sensitive fields admin-only', () => {
    it('toPublicTeacherProfile exposes contact + directory fields, not admin-only data', async () => {
      const toPublicTeacherProfile = (await importOrFail(
        '@/utils/publicPersonnelDto.util.js',
        'toPublicTeacherProfile',
      )) as (row: Record<string, unknown>) => Record<string, unknown>;

      const row = sampleTeacherRow();
      const pub = toPublicTeacherProfile(row);
      assert.equal(pub.name, row.name);
      assert.equal(pub.designation, row.designation);
      assert.equal(pub.image, row.image);
      for (const key of PUBLIC_PERSONNEL_ANON_CONTACT_KEYS) {
        assert.equal(pub[key], row[key], `expected public ${key}`);
      }
      for (const key of PUBLIC_PERSONNEL_ADMIN_ONLY_KEYS) {
        assert.equal(Object.prototype.hasOwnProperty.call(pub, key), false, `leaked ${key}`);
      }
    });

    it('toPublicStaffProfile exposes contact + directory fields, not admin-only data', async () => {
      const toPublicStaffProfile = (await importOrFail(
        '@/utils/publicPersonnelDto.util.js',
        'toPublicStaffProfile',
      )) as (row: Record<string, unknown>) => Record<string, unknown>;

      const row = {
        id: 3,
        name: 'Office Staff',
        designation: 'Clerk',
        image: '1/staff/photo.jpg',
        email: 'staff@school.example',
        phone: '01900000000',
        address: '456 Hidden Road',
        school_id: 1,
      };
      const pub = toPublicStaffProfile(row);
      for (const key of PUBLIC_PERSONNEL_ANON_CONTACT_KEYS) {
        assert.equal(pub[key], row[key], `expected public ${key}`);
      }
      for (const key of PUBLIC_PERSONNEL_ADMIN_ONLY_KEYS) {
        assert.equal(Object.prototype.hasOwnProperty.call(pub, key), false, `leaked ${key}`);
      }
    });

    it('teacher list handler maps anon responses; admin JWT keeps full DTO', () => {
      const src = readServerSource('modules/teacher/teacher.controller.ts');
      assert.match(src, /toPublicTeacherProfile/);
      assert.match(src, /isAdminRequest\(req\)/);
      assert.match(src, /isAdminRequest\(req\)\s*\?\s*result/);
      assert.match(src, /isAdminRequest\(req\)\s*\?\s*teachers/);
    });

    it('staff list handler maps anon responses; admin JWT keeps full DTO', () => {
      const src = readServerSource('modules/staff/staff.controller.ts');
      assert.match(src, /toPublicStaffProfile/);
      assert.match(src, /isAdminRequest\(req\)/);
      assert.match(src, /isAdminRequest\(req\)\s*\?\s*result/);
      assert.match(src, /isAdminRequest\(req\)\s*\?\s*data/);
    });
  });

  describe('3. Admission-result unauth mutation boundaries (401/403)', () => {
    it('mutating admission-result routes require admin authentication', () => {
      const src = readServerSource('modules/admission/result/admission-result.route.ts');
      const adminGuard = /AuthMiddleware\.authenticate\(\['admin'\]\)|adminOnly/;
      assert.match(src, adminGuard);

      for (const route of [
        "router.post(\n  '/upload'",
        "router.post(\n  '/multipart/sign-part'",
        "router.post(\n  '/multipart/complete'",
        "router.post(\n  '/',\n",
        "router.put(\n  '/:id'",
        "router.delete('/:id'",
      ]) {
        const start = src.indexOf(route.split('\n')[0]!);
        assert.ok(start >= 0, `missing route ${route}`);
        const slice = src.slice(start, start + 400);
        assert.match(slice, adminGuard);
      }
    });
  });

  describe('4. Same-tenant unauth pending form → approve → 200', () => {
    it('approve route allows anonymous optional auth', () => {
      const src = readServerSource('modules/admission/form/admission-form.route.ts');
      const approveIdx = src.indexOf("'/:id/approve'");
      assert.ok(approveIdx >= 0);
      const slice = src.slice(approveIdx, approveIdx + 200);
      assert.match(slice, /authenticateOptional/);
    });

    it('public pending → approved self-confirm is permitted', async () => {
      const assertFormStatusChangeAllowed = (await importOrFail(
        '@/utils/publicFormAccess.util.js',
        'assertFormStatusChangeAllowed',
      )) as (req: express.Request, current: string | null | undefined, next: string) => void;

      const anonReq = { user: undefined } as express.Request;
      assert.doesNotThrow(() => assertFormStatusChangeAllowed(anonReq, 'pending', 'approved'));
      assert.throws(
        () => assertFormStatusChangeAllowed(anonReq, 'approved', 'pending'),
        (err: unknown) => err instanceof ApiError && err.statusCode === 403,
      );
    });

    it('approve handler enforces pending-only public confirmation', () => {
      const src = readServerSource('modules/admission/form/admission-form.controller.ts');
      assert.match(src, /approveForm[\s\S]*assertFormStatusChangeAllowed/);
    });
  });

  describe('5. Role-based full DTO: teachers/staff only; admission/registration GET-by-id is full row', () => {
    it('isAdminRequest recognizes admin role', async () => {
      const isAdminRequest = (await importOrFail(
        '@/utils/publicFormAccess.util.js',
        'isAdminRequest',
      )) as (req: express.Request) => boolean;

      const adminReq = { user: { role: 'admin' } } as express.Request;
      const anonReq = { user: undefined } as express.Request;
      assert.equal(isAdminRequest(adminReq), true);
      assert.equal(isAdminRequest(anonReq), false);
    });

    it('admission form GET-by-id returns full record without role-based redaction', () => {
      const controller = readServerSource('modules/admission/form/admission-form.controller.ts');
      const start = controller.indexOf('getFormById');
      assert.ok(start >= 0);
      const block = controller.slice(start, start + 320);
      assert.match(block, /const data = await AdmissionFormService\.getFormById/);
      assert.match(block, /\{\s*success:\s*true,\s*data\s*\}/);
      assert.doesNotMatch(block, /redactPublicAdmissionForm/);
      assert.doesNotMatch(block, /isAdminRequest\(req\)/);
    });

    it('registration form GET-by-id returns full record without role-based redaction', () => {
      const controller = readServerSource('modules/registration/registrationForm.controller.ts');
      const anchor = 'getRegistrationById: asyncHandler';
      const start = controller.indexOf(anchor);
      assert.ok(start >= 0, 'getRegistrationById handler not found');
      const block = controller.slice(start, start + 380);
      assert.match(block, /service\.getRegistrationById\(req\.params\.id/);
      assert.match(block, /ApiResponse\(200,\s*registration/);
      assert.doesNotMatch(block, /redactPublicRegistration/);
      assert.doesNotMatch(block, /isAdminRequest\(req\)/);
    });
  });

  describe('related: production tenant host + optional auth resilience', () => {
    const prevEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = prevEnv;
    });

    it('#46 production ignores client x-tenant-host override', () => {
      process.env.NODE_ENV = 'production';
      const host = resolveTenantHostname({
        headers: {
          'x-tenant-host': 'evil.example.com',
          'x-forwarded-host': 'school.example.com',
        },
        hostname: 'api.example.com',
      } as express.Request);
      assert.equal(host, 'school.example.com');
    });

    it('authenticateOptional continues anonymously when JWT is invalid (form self-approve)', async () => {
      const { default: AuthMiddleware } = await import('@/middlewares/auth.middleware.js');
      const middleware = AuthMiddleware.authenticateOptional();
      const req = {
        headers: { authorization: 'Bearer not.a.valid.jwt' },
        schoolId: 1,
      } as express.Request;

      let passed: unknown;
      let errored: unknown;
      await middleware(req, {} as express.Response, (err?: unknown) => {
        if (err) errored = err;
        else passed = true;
      });

      assert.equal(passed, true);
      assert.equal(errored, undefined);
      assert.equal((req as express.Request & { user?: unknown }).user, undefined);
    });
  });
});
