/**
 * Login role lock. A school code created for one role (its lookup returns `roleHint`) locks the
 * login form to that role. A school-wide code (no hint) keeps every role selectable. The lock
 * is UI only: the server decides the role at login and the app follows `session.user.role`.
 * It lives in the persisted school selection, so it survives restarts and sign-out, and
 * "Use a different code" (switch school) clears both.
 */
import type { RoleHint } from '@/lib/api/school-codes';
import type { AppRole } from '@/navigation/role-routes';

export const LOGIN_ROLES: readonly AppRole[] = ['admin', 'teacher', 'student'];

const isRole = (v: unknown): v is RoleHint => v === 'admin' || v === 'teacher' || v === 'student';

/**
 * The locked role. Web page host: a role subdomain (`teacher.lbphs.gov.bd`) or `?role=`; the
 * backend maps every subdomain to the same school. Otherwise only a school picked with a code.
 */
export function lockedLoginRole(
  selection: { roleHint?: RoleHint | null; host?: string } | null | undefined,
  resolution: { source: string; host?: string | null },
  urlRole?: unknown,
): RoleHint | null {
  if (resolution.source === 'page-host') {
    const label = resolution.host?.split('.')[0];
    return isRole(label) ? label : isRole(urlRole) ? urlRole : null;
  }
  if (resolution.source !== 'school-code' || !selection) return null;
  if (selection.host && resolution.host && selection.host !== resolution.host) return null;
  return isRole(selection.roleHint) ? selection.roleHint : null;
}

/** Roles the form may offer: just the locked one, or all. */
export const loginRoles = (locked: RoleHint | null): readonly AppRole[] =>
  locked ? [locked] : LOGIN_ROLES;

/** The role the form submits: a lock always wins over a stale tab choice. */
export const effectiveLoginRole = (locked: RoleHint | null, chosen: AppRole): AppRole =>
  locked ?? chosen;
