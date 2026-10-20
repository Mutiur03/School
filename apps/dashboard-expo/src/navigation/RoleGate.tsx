/**
 * Route guard: no school → /join, no session → that tenant's login, wrong role → that role's
 * home (the login screens send you back to the page you wanted via `next`). A role that does not belong in this tenant (a school role in platform mode, a
 * super_admin at a school) is signed out instead of shown anything.
 * `unknown` (startup refresh still running, or offline): with a saved native session the saved
 * role's screens render at once (provisional routing only: data needs the refreshed token, and a
 * 401/403 ends the session and lands on login), with an offline banner if the start failed.
 * Without one (web, first launch) the full-screen SessionBoot shows instead of bouncing.
 */
import { Redirect, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SplashReady } from '@/boot/splash';
import { useSession } from '@/session/ApiProvider';
import { SessionBoot } from '@/session/SessionBoot';
import { SessionStatusBanner } from '@/session/SessionStatusBanner';
import { useTenant } from '@/tenant/TenantProvider';
import { homeForRole, loginHrefFor, type GateRole } from './role-routes';

export function RoleGate({ role, children }: { role: GateRole; children: ReactNode }) {
  const { resolution } = useTenant();
  const pathname = usePathname();
  const session = useSession();
  const userRole = session.user?.role;
  const home =
    session.status === 'authenticated' ? homeForRole(userRole, resolution.source) : undefined;

  useEffect(() => {
    if (session.status === 'authenticated' && home === null) void session.signOut();
  }, [home, session]);

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (session.status === 'unknown') {
    const provisional = session.provisional;
    const provisionalHome = provisional ? homeForRole(provisional.role, resolution.source) : null;
    if (!provisional || !provisionalHome) return <SessionBoot />;
    if (provisional.role !== role) return <Redirect href={provisionalHome} />;
    return <WithBanner>{children}</WithBanner>;
  }
  if (session.status === 'anonymous') {
    return <Redirect href={loginHrefFor(resolution.source, pathname)} />;
  }
  if (home === null) return <SessionBoot label="Signing out…" />;
  if (userRole !== role && home) return <Redirect href={home} />;
  return <WithBanner>{children}</WithBanner>;
}

function WithBanner({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <SplashReady />
      {children}
      <SessionStatusBanner />
    </View>
  );
}
