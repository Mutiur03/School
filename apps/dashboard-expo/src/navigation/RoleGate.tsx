/**
 * Route guard: no school → /join, no session → /login, wrong role → that role's home.
 * `unknown` (startup refresh still running, or offline) shows a loader instead of bouncing.
 */
import { Redirect } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui/states';
import { useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';
import { homeForRole, type AppRole } from './role-routes';

export function RoleGate({ role, children }: { role: AppRole; children: ReactNode }) {
  const { resolution } = useTenant();
  const session = useSession();
  const userRole = session.user?.role;
  const home = session.status === 'authenticated' ? homeForRole(userRole) : undefined;

  // A role this app does not serve (super_admin): end the session instead of showing anything.
  useEffect(() => {
    if (session.status === 'authenticated' && home === null) void session.signOut();
  }, [home, session]);

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (session.status === 'unknown') return <LoadingState label="Checking session…" />;
  if (session.status === 'anonymous') return <Redirect href="/login" />;
  if (home === null) return <LoadingState label="Signing out…" />;
  if (userRole !== role && home) return <Redirect href={home} />;
  return <>{children}</>;
}
