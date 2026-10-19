/**
 * Student menu: the web's studentRoutes (Dashboard, Result, Profile) plus Attendance (web: Profile → Attendance tab) and Notices (Expo addition, school notices
 * as published on the school site).
 */
import { Bell, CalendarDays, ClipboardList, Home, User } from '@/components/ui/icons';
import type { NavConfig } from '@/navigation/nav-context';
import type { MobileTab, NavEntry } from '@/navigation/nav-items';
import { STUDENT_HAS_MORE, STUDENT_TAB_SPEC } from '@/navigation/tab-spec';

// See navigation/tab-spec.ts: Notices in the old Results slot, then "More" (Result, Profile, ...).
const TAB_ICONS = { home: Home, notices: Bell, calendar: CalendarDays } as const;
const TABS: MobileTab[] = STUDENT_TAB_SPEC.map((t) => ({
  id: t.id,
  label: t.label,
  href: t.href,
  icon: TAB_ICONS[t.icon],
}));

const ENTRIES: NavEntry[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    webPath: '/student/dashboard',
    href: '/student',
  },
  {
    id: 'result',
    label: 'Result',
    icon: ClipboardList,
    webPath: '/student/result',
    href: '/student/results',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: CalendarDays,
    webPath: '/student/profile?tab=attendance',
    href: '/student/attendance',
  },
  { id: 'notices', label: 'Notices', icon: Bell, webPath: null, href: '/student/notices' },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    webPath: '/student/profile',
    href: '/student/profile',
  },
];

export const STUDENT_NAV: NavConfig = {
  title: 'Student',
  homeHref: '/student',
  entries: ENTRIES,
  tabs: TABS,
  more: STUDENT_HAS_MORE,
};
