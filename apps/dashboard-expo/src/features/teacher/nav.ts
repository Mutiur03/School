/**
 * Teacher menu, mirrored from `teacherRoutes` in dashboard/src/components/Sidebar.tsx: Dashboard,
 * Students' Info, Attendance, Running Away, Mark Management (Add Marks / View Result), Settings.
 */
import {
  CalendarCheck,
  ClipboardList,
  Footprints,
  GraduationCap,
  Home,
  Settings,
} from '@/components/ui/icons';
import type { NavConfig } from '@/navigation/nav-context';
import type { MobileTab, NavEntry } from '@/navigation/nav-items';
import { TEACHER_LINKS as L } from './routes';

const TABS: MobileTab[] = [
  { id: 'dashboard', label: 'Home', icon: Home, href: L.dashboard.href },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, href: L.attendance.href },
  { id: 'add-marks', label: 'Marks', icon: ClipboardList, href: L.addMarks.href },
  { id: 'students', label: 'Students', icon: GraduationCap, href: L.students.href },
];

const ENTRIES: NavEntry[] = [
  { ...L.dashboard, icon: Home },
  { ...L.students, icon: GraduationCap },
  { ...L.attendance, icon: CalendarCheck },
  { ...L.stayCheck, icon: Footprints },
  {
    id: 'mark-management',
    label: 'Mark Management',
    icon: ClipboardList,
    webPath: null,
    href: L.addMarks.href,
    items: [L.addMarks, L.viewMarks],
  },
  { ...L.settings, icon: Settings },
];

export const TEACHER_NAV: NavConfig = {
  title: 'Teacher',
  homeHref: L.dashboard.href,
  entries: ENTRIES,
  tabs: TABS,
  more: true,
};
