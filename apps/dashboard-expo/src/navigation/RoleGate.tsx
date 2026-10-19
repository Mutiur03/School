/**
 * Route guard: no school → /join, no session → that tenant's login, wrong role → that role's
 * home. A role that does not belong in this tenant (a school role in platform mode, a
 * super_admin at a school) is signed out instead of shown anything.
 * `unknown` (startup refresh still running, or offline) shows the full-screen SessionBoot (with
 * Retry once startup failed) instead of bouncing.
 */
import { Redirect } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/session/ApiProvider';
import { SessionBoot } from '@/session/SessionBoot';
import { useTenant } from '@/tenant/TenantProvider';
import { homeForRole, loginRouteFor, type GateRole } from './role-routes';

export function RoleGate({ role, children }: { role: GateRole; children: ReactNode }) {
  const { resolution } = useTenant();
  const session = useSession();
  const userRole = session.user?.role;
  const home =
    session.status === 'authenticated' ? homeForRole(userRole, resolution.source) : undefined;

  useEffect(() => {
    if (session.status === 'authenticated' && home === null) void session.signOut();
  }, [home, session]);

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (session.status === 'unknown') return <SessionBoot />;
  if (session.status === 'anonymous') return <Redirect href={loginRouteFor(resolution.source)} />;
  if (home === null) return <SessionBoot label="Signing out…" />;
  if (userRole !== role && home) return <Redirect href={home} />;
  return <>{children}</>;
}
