/**
 * Web role lock (EXPO_PUBLIC_APP_ROLE, see deployment-lock.ts). Wraps every screen: a route this
 * deployment does not serve renders the 404 page, `/` goes to the role's home, and a signed-in
 * session of another role (e.g. a refresh cookie from another site) is signed out. Unlocked
 * builds (every native build, the all-roles site, local dev) render children unchanged.
 */
import { Redirect, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { appConfig } from '@/config/env';
import { useSession } from '@/session/ApiProvider';
import { SessionBoot } from '@/session/SessionBoot';
import NotFound from '../../app/+not-found';
import { rootRedirect, roleAllowed, routeAllowed } from './deployment-lock';

export function DeploymentGuard({ children }: { children: ReactNode }) {
  const locked = appConfig.lockedRole;
  const pathname = usePathname();
  const session = useSession();
  const wrongRole =
    locked !== null &&
    session.status === 'authenticated' &&
    !roleAllowed(session.user?.role, locked);

  useEffect(() => {
    if (wrongRole) void session.signOut();
  }, [wrongRole, session]);

  if (!locked) return children;
  if (!routeAllowed(pathname, locked)) return <NotFound />;
  if (wrongRole) return <SessionBoot label="Signing out…" />;
  const home = pathname === '/' ? rootRedirect(locked) : null;
  if (home) return <Redirect href={home} />;
  return children;
}
