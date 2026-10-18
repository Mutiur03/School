/**
 * Ports of dashboard/src/components/ui/badge.tsx (shadcn) and
 * dashboard/src/components/StatusBadge.tsx (status chips with lucide icons).
 */
import { AlertCircle, CheckCircle2, Clock, XCircle } from '@/components/ui/icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { tw, withAlpha } from '@/theme/tokens';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function Badge({ label, variant = 'default' }: { label: string; variant?: BadgeVariant }) {
  const { colors, radii } = useTheme();
  const v = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: 'transparent' },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: 'transparent' },
    destructive: { bg: colors.destructive, fg: tw.white, border: 'transparent' },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
  }[variant];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg, borderColor: v.border, borderRadius: radii.full },
      ]}
    >
      <Text size="xs" weight="medium" style={{ color: v.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type StatusKind = 'approved' | 'rejected' | 'pending' | 'active' | 'inactive';

const STATUS: Record<StatusKind, { icon: LucideIcon; bg: string; fg: string; label: string }> = {
  approved: { icon: CheckCircle2, bg: tw.emerald100, fg: tw.emerald800, label: 'Approved' },
  rejected: { icon: XCircle, bg: tw.red100, fg: tw.red800, label: 'Rejected' },
  pending: { icon: AlertCircle, bg: tw.amber100, fg: tw.amber800, label: 'Pending' },
  active: { icon: CheckCircle2, bg: tw.emerald100, fg: tw.emerald800, label: 'Active' },
  inactive: { icon: Clock, bg: '', fg: tw.gray800, label: 'Inactive' },
};

export function StatusBadge({ status, label }: { status: StatusKind; label?: string }) {
  const { colors, radii } = useTheme();
  const c = STATUS[status];
  return (
    <View
      style={[styles.status, { backgroundColor: c.bg || colors.muted, borderRadius: radii.full }]}
    >
      <Icon icon={c.icon} size={12} rawColor={c.fg} />
      <Text size="xs" weight="medium" style={{ color: c.fg }} numberOfLines={1}>
        {label ?? c.label}
      </Text>
    </View>
  );
}

export type ChipTone = 'emerald' | 'blue' | 'muted';

/** Small square-ish chip used for exam status on the admin dashboard (`rounded px-1.5 text-[11px]`). */
export function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const { colors, radii } = useTheme();
  const t = {
    emerald: { bg: withAlpha(tw.emerald500, 0.1), fg: tw.emerald700 },
    blue: { bg: withAlpha(tw.blue500, 0.1), fg: tw.blue700 },
    muted: { bg: colors.muted, fg: withAlpha(colors.foreground, 0.7) },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderRadius: radii.base }]}>
      <Text weight="semibold" style={[styles.chipText, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Expo-only: marks placeholder content so it is never mistaken for real school data. Uses the
 * dashboard's own "pending" (amber) status colours.
 */
export function MockDataBadge() {
  const { radii } = useTheme();
  return (
    <View
      testID="mock-data-badge"
      style={[styles.status, { backgroundColor: tw.amber100, borderRadius: radii.full }]}
    >
      <Icon icon={AlertCircle} size={12} rawColor={tw.amber800} />
      <Text size="xs" weight="semibold" style={{ color: tw.amber800 }}>
        MOCK DATA
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  chip: { paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  chipText: { fontSize: 11, lineHeight: 16 },
});
