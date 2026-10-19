/**
 * Teacher menu data (no icons, so tests can import it), from `teacherRoutes` in
 * dashboard/src/components/Sidebar.tsx. nav.ts adds the icons.
 */
import type { NavLink } from '@/navigation/nav-items';

export const TEACHER_LINKS = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    webPath: '/teacher/dashboard',
    href: '/teacher',
  },
  students: {
    id: 'students',
    label: "Students' Info",
    webPath: '/teacher/students',
    href: '/teacher/students',
  },
  attendance: {
    id: 'attendance',
    label: 'Attendance',
    webPath: '/teacher/attendance',
    href: '/teacher/attendance',
  },
  stayCheck: {
    id: 'stay-check',
    label: 'Running Away',
    webPath: '/teacher/attendance-double',
    href: '/teacher/attendance-double',
  },
  addMarks: {
    id: 'add-marks',
    label: 'Add Marks',
    webPath: '/teacher/mark-management',
    href: '/teacher/marks',
  },
  viewMarks: {
    id: 'view-marks',
    label: 'View Result',
    webPath: '/teacher/result/view-marks',
    href: '/teacher/results',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    webPath: '/teacher/settings',
    href: '/teacher/settings',
  },
} as const satisfies Record<string, NavLink>;
