/**
 * Ports of dashboard/src/components/ui/badge.tsx (shadcn) and
 * dashboard/src/components/StatusBadge.tsx (status chips with lucide icons).
 */
import { View } from 'react-native';
import { AlertCircle, CheckCircle2, Clock, XCircle } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { tw } from '@/theme/tokens';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const BADGE: Record<BadgeVariant, { box: string; text: string }> = {
  default: { box: 'border-transparent bg-primary', text: 'text-primary-foreground' },
  secondary: { box: 'border-transparent bg-secondary', text: 'text-secondary-foreground' },
  destructive: { box: 'border-transparent bg-destructive', text: 'text-white' },
  outline: { box: 'border-border', text: 'text-foreground' },
};

export function Badge({ label, variant = 'default' }: { label: string; variant?: BadgeVariant }) {
  const v = BADGE[variant];
  return (
    <View className={cn('self-start rounded-full border px-2 py-0.5', v.box)}>
      <Text size="xs" weight="medium" className={v.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type StatusKind = 'approved' | 'rejected' | 'pending' | 'active' | 'inactive';

// Icon colours are props on lucide components, so they stay as values (tokens.ts `tw`).
const STATUS: Record<
  StatusKind,
  { icon: LucideIcon; box: string; text: string; iconColor: string; label: string }
> = {
  approved: {
    icon: CheckCircle2,
    box: 'bg-emerald-100',
    text: 'text-emerald-800',
    iconColor: tw.emerald800,
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    box: 'bg-red-100',
    text: 'text-red-800',
    iconColor: tw.red800,
    label: 'Rejected',
  },
  pending: {
    icon: AlertCircle,
    box: 'bg-amber-100',
    text: 'text-amber-800',
    iconColor: tw.amber800,
    label: 'Pending',
  },
  active: {
    icon: CheckCircle2,
    box: 'bg-emerald-100',
    text: 'text-emerald-800',
    iconColor: tw.emerald800,
    label: 'Active',
  },
  inactive: {
    icon: Clock,
    box: 'bg-muted',
    text: 'text-gray-800',
    iconColor: tw.gray800,
    label: 'Inactive',
  },
};

export function StatusBadge({ status, label }: { status: StatusKind; label?: string }) {
  const c = STATUS[status];
  return (
    <View
      className={cn('flex-row items-center gap-1 self-start rounded-full px-2.5 py-0.5', c.box)}
    >
      <Icon icon={c.icon} size={12} rawColor={c.iconColor} />
      <Text size="xs" weight="medium" className={c.text} numberOfLines={1}>
        {label ?? c.label}
      </Text>
    </View>
  );
}

export type ChipTone = 'emerald' | 'blue' | 'muted';

const CHIP: Record<ChipTone, { box: string; text: string }> = {
  emerald: { box: 'bg-emerald-500/10', text: 'text-emerald-700' },
  blue: { box: 'bg-blue-500/10', text: 'text-blue-700' },
  muted: { box: 'bg-muted', text: 'text-foreground/70' },
};

/** Small square-ish chip used for exam status on the admin dashboard (`rounded px-1.5 text-[11px]`). */
export function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  const t = CHIP[tone];
  return (
    <View className={cn('shrink-0 rounded px-1.5 py-0.5', t.box)}>
      <Text weight="semibold" className={cn('text-[11px] leading-4', t.text)}>
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
  return (
    <View
      testID="mock-data-badge"
      className="flex-row items-center gap-1 self-start rounded-full bg-amber-100 px-2.5 py-0.5"
    >
      <Icon icon={AlertCircle} size={12} rawColor={tw.amber800} />
      <Text size="xs" weight="semibold" className="text-amber-800">
        MOCK DATA
      </Text>
    </View>
  );
}
