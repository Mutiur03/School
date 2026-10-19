/**
 * Port of dashboard/src/components/ActionButton.tsx (icon-only): quiet ghost button,
 * `text-muted-foreground rounded-md h-8 w-8`, coloured only on hover (`bg-*-500/10 text-*-700`).
 */
import { useState } from 'react';
import { Pressable } from 'react-native';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { tw } from '@/theme/tokens';
import { Icon, type LucideIcon } from './Icon';

const TONES = {
  blue: { hover: 'hover:bg-blue-500/10', fg: tw.blue700 },
  emerald: { hover: 'hover:bg-emerald-500/10', fg: tw.emerald700 },
  red: { hover: 'hover:bg-red-500/10', fg: tw.red800 },
} as const;

export function ActionButton({
  icon,
  label,
  tone,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone: keyof typeof TONES;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  // The icon colour is a lucide prop, so hover is tracked in JS for it.
  const [hovered, setHovered] = useState(false);
  const t = TONES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        'h-8 w-8 items-center justify-center rounded-md',
        disabled ? 'opacity-40' : t.hover,
      )}
    >
      <Icon icon={icon} size={14} rawColor={hovered && !disabled ? t.fg : colors.mutedForeground} />
    </Pressable>
  );
}
