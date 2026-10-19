/**
 * Which menu the shell shows. The admin dashboard is the default; the student home provides
 * its own (dashboard/src/components/Sidebar.tsx `studentRoutes` plus Attendance and Notices).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { ADMIN_NAV, MOBILE_TABS, type MobileTab, type NavEntry, type NavHref } from './nav-items';

export interface NavConfig {
  /** Navbar role title, as on the web ("Admin", "Student"). */
  title: string;
  homeHref: NavHref;
  entries: readonly NavEntry[];
  tabs: readonly MobileTab[];
  /** Show the "More" tab (full menu sheet). Off when every destination is a tab. */
  more: boolean;
}

export const ADMIN_NAV_CONFIG: NavConfig = {
  title: 'Admin',
  homeHref: '/',
  entries: ADMIN_NAV,
  tabs: MOBILE_TABS,
  more: true,
};

const NavContext = createContext<NavConfig>(ADMIN_NAV_CONFIG);

export function NavProvider({ value, children }: { value: NavConfig; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);
