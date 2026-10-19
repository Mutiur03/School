/**
 * Admin navigation, mirrored from `adminRoutes` in dashboard/src/components/Sidebar.tsx:
 * same labels, order, sections, dropdown groups and lucide icons. Only the screens that exist
 * in this app link to real routes; everything else opens a "not built yet" page that names the
 * web dashboard path it will replace. Teacher/student/super_admin menus come with login.
 */
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  ClipboardPen,
  FileCheck,
  Footprints,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Landmark,
  MessageSquare,
  PartyPopper,
  Activity,
  QrCode,
  ScrollText,
  Settings,
  TreePalm,
  UserPlus,
  Wallet,
  type LucideIcon,
} from '@/components/ui/icons';
import { ADMIN_TAB_SPEC } from './tab-spec';

/** Routes implemented in apps/dashboard-expo/app/(dashboard). */
export type BuiltHref =
  | '/'
  | '/students'
  | '/teachers'
  | '/subjects'
  | '/notices'
  | '/events'
  | '/holidays'
  | '/attendance'
  | '/attendance-double'
  | '/results'
  | '/exams'
  | '/assigned-teachers'
  | '/marks'
  | '/promotion'
  | '/settings'
  | '/alumni'
  | '/staff'
  | '/head-message'
  | '/sms'
  | '/billing'
  | '/school-codes'
  | '/fees/overview'
  | '/fees/collect'
  | '/fees/receipts'
  | '/fees/heads'
  | '/fees/structure'
  | '/fees/waivers'
  | '/fees/reports'
  | '/accounts/heads'
  | '/accounts/cost-centers'
  | '/accounts/vouchers'
  | '/accounts/years'
  | '/accounts/reports/ledger'
  | '/accounts/reports/trial-balance'
  | '/accounts/reports/income-expense'
  | '/accounts/reports/balance-sheet'
  | '/accounts/reports/cost-center'
  | '/citizen-charter'
  | '/class-routine'
  | '/syllabus'
  | '/certificates'
  | '/admission/form'
  | '/admission/settings'
  | '/admission/result'
  | '/gallery/upload'
  | '/gallery/pending'
  | '/gallery/rejected'
  | '/registration/class-6'
  | '/registration/class-8'
  | '/registration/class-9'
  | '/registration/junior-scholarship'
  | '/student'
  | '/student/results'
  | '/student/attendance'
  | '/student/notices'
  | '/student/profile'
  | '/teacher'
  | '/teacher/students'
  | '/teacher/attendance'
  | '/teacher/attendance-double'
  | '/teacher/marks'
  | '/teacher/results'
  | '/teacher/settings'
  | '/platform'
  | '/platform/schools'
  | '/platform/exam-types'
  | '/platform/sms';
export type NavHref = BuiltHref | `/soon/${string}`;

export interface NavLink {
  id: string;
  label: string;
  /** Path in the web dashboard (dashboard/src/components/Sidebar.tsx). Null for Expo-only items. */
  webPath: string | null;
  href: NavHref;
}

export interface NavEntry extends NavLink {
  icon: LucideIcon;
  section?: string;
  /** Dropdown children; when present the entry itself is a toggle, not a link. */
  items?: NavLink[];
  expoOnly?: boolean;
}

const soon = (id: string): NavHref => `/soon/${id}`;
const leaf = (id: string, label: string, webPath: string, href: NavHref = soon(id)): NavLink => ({
  id,
  label,
  webPath,
  href,
});
const group = (
  id: string,
  label: string,
  icon: LucideIcon,
  items: NavLink[],
  section?: string,
): NavEntry => ({ id, label, icon, items, section, webPath: null, href: items[0]!.href });
const link = (
  id: string,
  label: string,
  icon: LucideIcon,
  webPath: string,
  href: NavHref = soon(id),
  section?: string,
): NavEntry => ({ id, label, icon, webPath, href, section });

export const ADMIN_NAV: readonly NavEntry[] = [
  link('dashboard', 'Dashboard', Home, '/admin/dashboard', '/'),
  group(
    'student',
    'Students',
    GraduationCap,
    [
      leaf('student-list', 'Student List', '/admin/students/student-list', '/students'),
      leaf('alumni-list', 'Alumni List', '/admin/students/alumni-list', '/alumni'),
    ],
    'People',
  ),
  group('administration', 'Staff', Briefcase, [
    leaf('teachers', 'Teacher List', '/admin/administration/teacher-list', '/teachers'),
    leaf('staff-list', 'Staff List', '/admin/administration/staff-list', '/staff'),
    leaf('head-message', 'Message From Head', '/admin/administration/head', '/head-message'),
  ]),
  link('attendance', 'Attendance', CalendarCheck, '/admin/attendance', '/attendance', 'Academics'),
  link('stay-check', 'Running Away', Footprints, '/admin/attendance-double', '/attendance-double'),
  link('class-routine', 'Class Routine', CalendarClock, '/admin/classRoutine', '/class-routine'),
  link('syllabus', 'Syllabus', BookOpen, '/admin/syllabus', '/syllabus'),
  group('reports', 'Results', ClipboardList, [
    leaf('add-exam', 'Exam Setup', '/admin/settings/add-exam', '/exams'),
    leaf('add-subject', 'Subjects', '/admin/result/add-subject', '/subjects'),
    leaf(
      'assignments',
      'Assigned Teachers',
      '/admin/result/assigned-teachers',
      '/assigned-teachers',
    ),
    leaf('add-marks', 'Add Marks', '/admin/result/add-marks', '/marks'),
    leaf('view-marks', 'View Result', '/admin/result/view-marks', '/results'),
    leaf('generate-result', 'Year-End Promotion', '/admin/result/generate-result', '/promotion'),
  ]),
  group(
    'admission',
    'Admission',
    UserPlus,
    [
      leaf('admission-form', 'Form', '/admin/admission/form', '/admission/form'),
      leaf('admission-settings', 'Settings', '/admin/admission/settings', '/admission/settings'),
      leaf('admission-result', 'Result', '/admin/admission/result', '/admission/result'),
    ],
    'Admissions',
  ),
  group('registration', 'Registration', ClipboardPen, [
    leaf(
      'class-6-registration',
      'Class Six Registration',
      '/admin/registration/class-6',
      '/registration/class-6',
    ),
    leaf(
      'class-8-registration',
      'Class Eight Registration',
      '/admin/registration/class-8',
      '/registration/class-8',
    ),
    leaf(
      'class-9-registration',
      'Class Nine Registration',
      '/admin/registration/class-9',
      '/registration/class-9',
    ),
    // Not in the web sidebar (the web route exists); listed so phones can reach it.
    leaf(
      'jse-registration',
      'Junior Scholarship',
      '/admin/registration/junior-scholarship',
      '/registration/junior-scholarship',
    ),
  ]),
  group(
    'fees',
    'Fees',
    Wallet,
    [
      leaf('fees-overview', 'Overview', '/admin/fees/overview', '/fees/overview'),
      leaf('fees-collect', 'Collect Fees', '/admin/fees/collect', '/fees/collect'),
      leaf('fees-receipts', 'Receipts', '/admin/fees/receipts', '/fees/receipts'),
      leaf('fees-heads', 'Fee Heads', '/admin/fees/heads', '/fees/heads'),
      leaf('fees-structure', 'Fee Structure', '/admin/fees/structure', '/fees/structure'),
      leaf('fees-waivers', 'Waivers', '/admin/fees/waivers', '/fees/waivers'),
      leaf('fees-reports', 'Reports', '/admin/fees/reports', '/fees/reports'),
    ],
    'Finance',
  ),
  group('accounts', 'Accounts', Landmark, [
    leaf('acc-heads', 'Account Heads', '/admin/accounts/heads', '/accounts/heads'),
    leaf(
      'acc-cost-centers',
      'Cost Centers',
      '/admin/accounts/cost-centers',
      '/accounts/cost-centers',
    ),
    leaf('acc-vouchers', 'Vouchers', '/admin/accounts/vouchers', '/accounts/vouchers'),
    leaf('acc-years', 'Fiscal Years', '/admin/accounts/years', '/accounts/years'),
  ]),
  group('account-reports', 'Account Reports', BarChart3, [
    leaf('acc-ledger', 'Ledger', '/admin/accounts/reports/ledger', '/accounts/reports/ledger'),
    leaf(
      'acc-trial-balance',
      'Trial Balance',
      '/admin/accounts/reports/trial-balance',
      '/accounts/reports/trial-balance',
    ),
    leaf(
      'acc-income-expense',
      'Income vs Expense',
      '/admin/accounts/reports/income-expense',
      '/accounts/reports/income-expense',
    ),
    leaf(
      'acc-balance-sheet',
      'Balance Sheet',
      '/admin/accounts/reports/balance-sheet',
      '/accounts/reports/balance-sheet',
    ),
    leaf(
      'acc-cost-center-report',
      'Cost Center Report',
      '/admin/accounts/reports/cost-center',
      '/accounts/reports/cost-center',
    ),
  ]),
  link('notice', 'Notice', Bell, '/admin/notice', '/notices', 'Communication'),
  link('sms-management', 'SMS Management', MessageSquare, '/admin/sms-management', '/sms'),
  link('events', 'Events', PartyPopper, '/admin/events', '/events'),
  link('holiday', 'Holiday', TreePalm, '/admin/holiday', '/holidays'),
  group('gallery', 'Gallery', ImageIcon, [
    leaf('upload-image', 'Upload Image', '/admin/gallery/upload', '/gallery/upload'),
    leaf('approve-image', 'Approve Image', '/admin/gallery/pending', '/gallery/pending'),
    leaf('rejected-image', 'Rejected Image', '/admin/gallery/rejected', '/gallery/rejected'),
  ]),
  link('certificates', 'Certificates', FileCheck, '/admin/certificates', '/certificates'),
  link(
    'citizen-charter',
    'Citizen Charter',
    ScrollText,
    '/admin/citizencharter',
    '/citizen-charter',
  ),
  link('billing', 'Billing', Settings, '/admin/settings/billing', '/billing', 'System'),
  link('school-codes', 'School Codes', QrCode, '/admin/settings/school-codes', '/school-codes'),
  // Expo-only diagnostics page (not in the web dashboard).
  {
    ...link('system-status', 'System status', Activity, '', '/settings'),
    webPath: null,
    expoOnly: true,
  },
];

export interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
  href: BuiltHref;
}

/** Phone bottom tabs (see tab-spec.ts): four admin destinations plus "More" (full menu sheet). */
export const MOBILE_TABS: readonly MobileTab[] = ADMIN_TAB_SPEC.map((t) => ({
  id: t.id,
  label: t.label,
  href: t.href,
  icon: { home: Home, students: GraduationCap, attendance: CalendarCheck, notices: Bell }[t.icon],
}));

/** Same rule as `isPathActive` in Sidebar.tsx, plus the Expo root route. */
export function isActive(pathname: string, href: NavHref, exact = false): boolean {
  if (href === '/') return pathname === '/' || pathname === '';
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Dropdown that contains the active route, so it starts open (Sidebar.tsx useEffect). */
export function activeGroupId(
  pathname: string,
  entries: readonly NavEntry[] = ADMIN_NAV,
): string | null {
  return (
    entries.find((entry) => entry.items?.some((item) => isActive(pathname, item.href)))?.id ?? null
  );
}

export function findNavLink(id: string): NavLink | undefined {
  for (const entry of ADMIN_NAV) {
    if (entry.id === id && !entry.items) return entry;
    const child = entry.items?.find((item) => item.id === id);
    if (child) return child;
  }
  return undefined;
}

export function titleForPath(pathname: string): string {
  for (const entry of ADMIN_NAV) {
    const child = entry.items?.find((item) => isActive(pathname, item.href));
    if (child) return child.label;
    if (!entry.items && isActive(pathname, entry.href)) return entry.label;
  }
  return 'Dashboard';
}
