/**
 * lucide icons used by the app, exported under the names the web dashboard imports from
 * lucide-react (dashboard/src/components/Sidebar.tsx etc.; some are lucide aliases, e.g.
 * Home = house, BarChart3 = chart-column).
 *
 * Each icon is a deep import: Metro does not tree-shake, so importing from the
 * 'lucide-react-native' barrel would bundle all ~1,900 icons (+2.3 MB on web). ESLint blocks
 * value imports from the barrel in this app (see eslint.config.js).
 */
export { default as Activity } from 'lucide-react-native/icons/activity';
export { default as AlertCircle } from 'lucide-react-native/icons/circle-alert';
export { default as AlertTriangle } from 'lucide-react-native/icons/triangle-alert';
export { default as ArrowLeft } from 'lucide-react-native/icons/arrow-left';
export { default as BarChart3 } from 'lucide-react-native/icons/chart-column';
export { default as Bell } from 'lucide-react-native/icons/bell';
export { default as BookOpen } from 'lucide-react-native/icons/book-open';
export { default as Briefcase } from 'lucide-react-native/icons/briefcase';
export { default as CalendarCheck } from 'lucide-react-native/icons/calendar-check';
export { default as CalendarClock } from 'lucide-react-native/icons/calendar-clock';
export { default as CalendarPlus } from 'lucide-react-native/icons/calendar-plus';
export { default as CheckCircle2 } from 'lucide-react-native/icons/circle-check';
export { default as ChevronDown } from 'lucide-react-native/icons/chevron-down';
export { default as ChevronLeft } from 'lucide-react-native/icons/chevron-left';
export { default as ChevronRight } from 'lucide-react-native/icons/chevron-right';
export { default as ClipboardList } from 'lucide-react-native/icons/clipboard-list';
export { default as ClipboardPen } from 'lucide-react-native/icons/clipboard-pen';
export { default as Clock } from 'lucide-react-native/icons/clock';
export { default as Compass } from 'lucide-react-native/icons/compass';
export { default as Construction } from 'lucide-react-native/icons/construction';
export { default as Ellipsis } from 'lucide-react-native/icons/ellipsis';
export { default as Eye } from 'lucide-react-native/icons/eye';
export { default as FileCheck } from 'lucide-react-native/icons/file-check';
export { default as Footprints } from 'lucide-react-native/icons/footprints';
export { default as GraduationCap } from 'lucide-react-native/icons/graduation-cap';
export { default as Home } from 'lucide-react-native/icons/house';
export { default as Image } from 'lucide-react-native/icons/image';
export { default as Landmark } from 'lucide-react-native/icons/landmark';
export { default as Loader2 } from 'lucide-react-native/icons/loader-circle';
export { default as LogIn } from 'lucide-react-native/icons/log-in';
export { default as LogOut } from 'lucide-react-native/icons/log-out';
export { default as MapPin } from 'lucide-react-native/icons/map-pin';
export { default as MessageSquare } from 'lucide-react-native/icons/message-square';
export { default as PartyPopper } from 'lucide-react-native/icons/party-popper';
export { default as Pencil } from 'lucide-react-native/icons/pencil';
export { default as Plus } from 'lucide-react-native/icons/plus';
export { default as Power } from 'lucide-react-native/icons/power';
export { default as QrCode } from 'lucide-react-native/icons/qr-code';
export { default as RefreshCw } from 'lucide-react-native/icons/refresh-cw';
export { default as ScanLine } from 'lucide-react-native/icons/scan-line';
export { default as School } from 'lucide-react-native/icons/school';
export { default as ScrollText } from 'lucide-react-native/icons/scroll-text';
export { default as Search } from 'lucide-react-native/icons/search';
export { default as Settings } from 'lucide-react-native/icons/settings';
export { default as TreePalm } from 'lucide-react-native/icons/tree-palm';
export { default as User } from 'lucide-react-native/icons/user';
export { default as UserCheck } from 'lucide-react-native/icons/user-check';
export { default as UserPlus } from 'lucide-react-native/icons/user-plus';
export { default as Wallet } from 'lucide-react-native/icons/wallet';
export { default as XCircle } from 'lucide-react-native/icons/circle-x';
export type { LucideIcon } from 'lucide-react-native';
