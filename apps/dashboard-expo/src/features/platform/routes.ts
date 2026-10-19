/**
 * Platform (super-admin) menu, mirrored from `superAdminRoutes` in
 * dashboard/src/components/Sidebar.tsx: Overview, Schools, Exam types, SMS. No icons here so
 * tests can import it; nav.ts adds them.
 */
import type { NavLink } from '@/navigation/nav-items';

export const PLATFORM_LINKS = {
  overview: {
    id: 'platform-overview',
    label: 'Overview',
    webPath: '/super_admin/dashboard',
    href: '/platform',
  },
  schools: {
    id: 'platform-schools',
    label: 'Schools',
    webPath: '/super_admin/settings/school',
    href: '/platform/schools',
  },
  examTypes: {
    id: 'platform-exam-types',
    label: 'Exam types',
    webPath: '/super_admin/settings/exams',
    href: '/platform/exam-types',
  },
  sms: {
    id: 'platform-sms',
    label: 'SMS',
    webPath: '/super_admin/settings/sms',
    href: '/platform/sms',
  },
} as const satisfies Record<string, NavLink>;
