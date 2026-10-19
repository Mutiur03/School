/** Platform shell menu: sidebar on wide screens, the same four as bottom tabs on phones. */
import { Building2, ClipboardList, Home, MessageSquare } from '@/components/ui/icons';
import type { NavConfig } from '@/navigation/nav-context';
import type { MobileTab, NavEntry } from '@/navigation/nav-items';
import { PLATFORM_LINKS as L } from './routes';

const TABS: MobileTab[] = [
  { id: L.overview.id, label: 'Overview', icon: Home, href: L.overview.href },
  { id: L.schools.id, label: 'Schools', icon: Building2, href: L.schools.href },
  { id: L.examTypes.id, label: 'Exam types', icon: ClipboardList, href: L.examTypes.href },
  { id: L.sms.id, label: 'SMS', icon: MessageSquare, href: L.sms.href },
];

const ENTRIES: NavEntry[] = [
  { ...L.overview, icon: Home },
  { ...L.schools, icon: Building2 },
  { ...L.examTypes, icon: ClipboardList },
  { ...L.sms, icon: MessageSquare },
];

export const PLATFORM_NAV: NavConfig = {
  title: 'Super Admin',
  homeHref: L.overview.href,
  entries: ENTRIES,
  tabs: TABS,
  more: false,
};
