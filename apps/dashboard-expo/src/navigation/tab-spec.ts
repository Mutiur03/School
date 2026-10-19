/**
 * Phone bottom-tab lists as plain data (ids, labels, routes, icon keys) so they are testable
 * without loading icons / react-native. nav-items.ts and features/student/nav.ts attach icons.
 * Notices sits where Results used to be (owner's choice). Results stays in each role's menu
 * ("More" sheet): admin under Results → View Result, student under Result.
 */
export type TabIconKey = 'home' | 'students' | 'attendance' | 'notices' | 'calendar';

export interface TabSpec {
  id: string;
  label: string;
  href: string;
  icon: TabIconKey;
}

/** Admin: four tabs plus More (the full admin menu). */
export const ADMIN_TAB_SPEC = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: 'home' },
  { id: 'student-list', label: 'Students', href: '/students', icon: 'students' },
  { id: 'attendance', label: 'Attendance', href: '/attendance', icon: 'attendance' },
  { id: 'notice', label: 'Notices', href: '/notices', icon: 'notices' },
] as const satisfies readonly TabSpec[];

/** Student: three tabs plus More (the student menu: Result, Profile, ...). */
export const STUDENT_TAB_SPEC = [
  { id: 'dashboard', label: 'Home', href: '/student', icon: 'home' },
  { id: 'notices', label: 'Notices', href: '/student/notices', icon: 'notices' },
  { id: 'attendance', label: 'Attendance', href: '/student/attendance', icon: 'calendar' },
] as const satisfies readonly TabSpec[];
export const STUDENT_HAS_MORE = true;
