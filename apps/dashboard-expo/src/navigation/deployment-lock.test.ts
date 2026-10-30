/** Web per-role lock: which routes each locked build serves, login and session role checks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildAppConfig } from '../config/build-config';
import { lockedLoginRole } from '../features/auth/role-lock';
import { loginErrorMessage } from '../features/auth/login-form';
import { resolveTenant } from '../tenant/resolve';
import {
  lockedRoleMessage,
  parseLockedRole,
  requireDeploymentRole,
  roleAllowed,
  rootRedirect,
  routeAllowed,
  WrongDeploymentRoleError,
} from './deployment-lock';

/** Every real route in app/, as a URL path (groups dropped, [param] filled in). */
function appRoutes(): string[] {
  const root = path.resolve(__dirname, '../../app');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_') && !e.name.startsWith('+')) {
        const rel = path
          .relative(root, full)
          .replace(/\\/g, '/')
          .replace(/\.tsx$/, '');
        const url = `/${rel}`
          .replace(/\/\([^)]+\)/g, '')
          .replace(/\[[^\]]+\]/g, 'x')
          .replace(/\/index$/, '');
        out.push(url === '' ? '/' : url);
      }
    }
  };
  walk(root);
  return out.sort();
}

const ROUTES = appRoutes();
const SCHOOL_AUTH = ['/login', '/join', '/scan', '/confirm', '/forgot-password'];
const area = (p: string) =>
  ['/teacher', '/student', '/platform'].find((a) => p === a || p.startsWith(`${a}/`)) ?? null;

describe('parseLockedRole', () => {
  it('reads each role on web, any case, super-admin with a dash', () => {
    assert.equal(parseLockedRole('admin', 'web'), 'admin');
    assert.equal(parseLockedRole('Teacher', 'web'), 'teacher');
    assert.equal(parseLockedRole(' student ', 'web'), 'student');
    assert.equal(parseLockedRole('super-admin', 'web'), 'super_admin');
    assert.equal(parseLockedRole('super_admin', 'web'), 'super_admin');
  });
  it('is unlocked when unset, unknown, or on native', () => {
    assert.equal(parseLockedRole(undefined, 'web'), null);
    assert.equal(parseLockedRole('', 'web'), null);
    assert.equal(parseLockedRole('owner', 'web'), null);
    assert.equal(parseLockedRole('teacher', 'android'), null);
    assert.equal(parseLockedRole('super_admin', 'ios'), null);
  });
  it('is exposed by buildAppConfig', () => {
    assert.equal(buildAppConfig({ appRole: 'teacher' }, 'web').config.lockedRole, 'teacher');
    assert.equal(buildAppConfig({ appRole: 'teacher' }, 'android').config.lockedRole, null);
    assert.equal(buildAppConfig({}, 'web').config.lockedRole, null);
  });
});

describe('routeAllowed over every app route', () => {
  it('finds the app routes', () => {
    for (const r of ['/', '/login', '/platform-login', '/teacher/marks', '/student', '/platform'])
      assert.ok(ROUTES.includes(r), `missing ${r}`);
  });

  it('unlocked serves everything', () => {
    for (const r of ROUTES) assert.equal(routeAllowed(r, null), true, r);
  });

  it('teacher: only /teacher/** and the school sign-in screens', () => {
    for (const r of ROUTES) {
      const want = r === '/' || area(r) === '/teacher' || SCHOOL_AUTH.includes(r);
      assert.equal(routeAllowed(r, 'teacher'), want, r);
    }
  });

  it('student: only /student/** and the school sign-in screens', () => {
    for (const r of ROUTES) {
      const want = r === '/' || area(r) === '/student' || SCHOOL_AUTH.includes(r);
      assert.equal(routeAllowed(r, 'student'), want, r);
    }
  });

  it('admin: everything except other roles and platform sign-in', () => {
    for (const r of ROUTES) {
      const want = area(r) === null && r !== '/platform-login';
      assert.equal(routeAllowed(r, 'admin'), want, r);
    }
  });

  it('super_admin: only /platform/** and platform sign-in, no school screens or /join', () => {
    for (const r of ROUTES) {
      const want = r === '/' || area(r) === '/platform' || r === '/platform-login';
      assert.equal(routeAllowed(r, 'super_admin'), want, r);
    }
    assert.equal(routeAllowed('/join', 'super_admin'), false);
    assert.equal(routeAllowed('/login', 'super_admin'), false);
  });

  it('ignores query, hash and trailing slashes; no prefix tricks', () => {
    assert.equal(routeAllowed('/teacher/?x=1', 'teacher'), true);
    assert.equal(routeAllowed('/login#a', 'teacher'), true);
    assert.equal(routeAllowed('/teachers', 'teacher'), false);
    assert.equal(routeAllowed('/teachers', 'admin'), true);
    assert.equal(routeAllowed('/platformx', 'super_admin'), false);
    assert.equal(routeAllowed('/unknown-page', 'teacher'), false);
  });

  it('sends / to the role home', () => {
    assert.equal(rootRedirect('teacher'), '/teacher');
    assert.equal(rootRedirect('student'), '/student');
    assert.equal(rootRedirect('super_admin'), '/platform');
    assert.equal(rootRedirect('admin'), null);
    assert.equal(rootRedirect(null), null);
  });
});

describe('session and login role checks', () => {
  it('roleAllowed', () => {
    assert.equal(roleAllowed('teacher', 'teacher'), true);
    assert.equal(roleAllowed('admin', 'teacher'), false);
    assert.equal(roleAllowed('super_admin', 'admin'), false);
    assert.equal(roleAllowed(undefined, 'student'), false);
    assert.equal(roleAllowed('student', null), true);
  });

  it('requireDeploymentRole rejects other roles with a clear message', () => {
    const p = (role: string) => ({ user: { role } });
    assert.deepEqual(requireDeploymentRole(p('teacher'), 'teacher'), p('teacher'));
    assert.deepEqual(requireDeploymentRole(p('admin'), null), p('admin'));
    assert.throws(() => requireDeploymentRole(p('admin'), 'teacher'), WrongDeploymentRoleError);
    try {
      requireDeploymentRole(p('student'), 'teacher');
    } catch (e) {
      assert.equal(loginErrorMessage(e), 'This app is for teachers only.');
    }
    assert.equal(lockedRoleMessage('student'), 'This app is for students only.');
    assert.equal(lockedRoleMessage('admin'), 'This app is for school admins only.');
    assert.equal(lockedRoleMessage('super_admin'), 'This app is for platform admins only.');
  });

  it('login form: the deployment role beats subdomain, ?role= and the school code', () => {
    const host = { source: 'page-host', host: 'student.lbphs.gov.bd' };
    assert.equal(lockedLoginRole(null, host, 'admin', 'teacher'), 'teacher');
    assert.equal(lockedLoginRole(null, host, undefined, null), 'student');
    assert.equal(
      lockedLoginRole({ roleHint: 'admin' }, { source: 'school-code' }, undefined, 'student'),
      'student',
    );
    assert.equal(lockedLoginRole(null, { source: 'school-code' }, undefined, 'super_admin'), null);
  });
});

describe('resolveTenant with a locked role', () => {
  const base = {
    platform: 'web' as const,
    apiBaseUrl: '',
    devTenantHost: null,
    superAdminUrl: 'https://superadmin.example.com',
  };

  it('super_admin build is always platform mode, never a school', () => {
    const r = resolveTenant({
      ...base,
      pageHost: 'school-dashboard-expo-superadmin.pages.dev',
      lockedRole: 'super_admin',
      selectedHost: 'a-dashboard.example.com',
    });
    assert.equal(r.source, 'platform');
    assert.equal(r.sameOrigin, true);
    assert.equal(r.host, 'school-dashboard-expo-superadmin.pages.dev');
    const local = resolveTenant({ ...base, pageHost: 'localhost:8081', lockedRole: 'super_admin' });
    assert.equal(local.source, 'platform');
    assert.equal(local.host, 'superadmin.example.com');
    assert.equal(local.sameOrigin, undefined);
  });

  it('school-role builds never enter platform mode', () => {
    for (const role of ['admin', 'teacher', 'student']) {
      const onSuperHost = resolveTenant({
        ...base,
        pageHost: 'superadmin.example.com',
        lockedRole: role,
      });
      assert.equal(onSuperHost.source, 'page-host', role);
      const stored = resolveTenant({
        ...base,
        pageHost: 'localhost',
        lockedRole: role,
        platformHost: 'superadmin.example.com',
      });
      assert.equal(stored.source, 'unresolved', role);
    }
  });

  it("unlocked keeps today's behaviour, and native ignores the lock", () => {
    assert.equal(resolveTenant({ ...base, pageHost: 'superadmin.example.com' }).source, 'platform');
    const native = resolveTenant({
      ...base,
      platform: 'android',
      pageHost: null,
      lockedRole: 'super_admin',
      selectedHost: 'a-dashboard.example.com',
    });
    assert.equal(native.source, 'school-code');
  });
});
