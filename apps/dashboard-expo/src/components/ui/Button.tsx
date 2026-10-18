/**
 * Port of dashboard/src/components/ui/button.tsx (shadcn new-york, cva variants).
 * Hover colours follow the web classes; `pressed` reuses them on touch.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha, type ThemeColors } from '@/theme/tokens';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label?: string;
  icon?: LucideIcon;
  /** Icon after the label, e.g. `More <ChevronDown />` on Student List. */
  iconPosition?: 'start' | 'end';
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

const SIZES: Record<ButtonSize, { height: number; px: number; pxIcon: number; gap: number }> = {
  default: { height: 36, px: 16, pxIcon: 12, gap: 8 }, // h-9 px-4 has-[>svg]:px-3
  sm: { height: 32, px: 12, pxIcon: 10, gap: 6 }, // h-8 px-3 gap-1.5 has-[>svg]:px-2.5
  lg: { height: 40, px: 24, pxIcon: 16, gap: 8 }, // h-10 px-6 has-[>svg]:px-4
  icon: { height: 36, px: 0, pxIcon: 0, gap: 0 }, // size-9
  'icon-sm': { height: 32, px: 0, pxIcon: 0, gap: 0 }, // size-8
};

export function Button({
  label,
  icon,
  iconPosition = 'start',
  variant = 'default',
  size = 'default',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors, radii, shadows } = useTheme();
  const [hovered, setHovered] = useState(false);
  const s = SIZES[size];
  const isIcon = size === 'icon' || size === 'icon-sm';

  const v: Record<
    ButtonVariant,
    { bg: string; bgHover: string; fg: keyof ThemeColors; border?: string; shadow?: string }
  > = {
    default: {
      bg: colors.primary,
      bgHover: withAlpha(colors.primary, 0.9),
      fg: 'primaryForeground',
    },
    destructive: {
      bg: colors.destructive,
      bgHover: withAlpha(colors.destructive, 0.9),
      fg: 'primaryForeground',
    },
    outline: {
      bg: colors.background,
      bgHover: colors.accent,
      fg: 'foreground',
      border: colors.border,
      shadow: shadows.xs,
    },
    secondary: {
      bg: colors.secondary,
      bgHover: withAlpha(colors.secondary, 0.8),
      fg: 'secondaryForeground',
    },
    ghost: { bg: 'transparent', bgHover: colors.accent, fg: 'foreground' },
    link: { bg: 'transparent', bgHover: 'transparent', fg: 'primary' },
  };
  const tone = v[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          width: isIcon ? s.height : undefined,
          paddingHorizontal: icon && label ? s.pxIcon : s.px,
          gap: s.gap,
          borderRadius: radii.sm,
          backgroundColor: hovered || pressed ? tone.bgHover : tone.bg,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
          boxShadow: tone.shadow,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon && iconPosition === 'start' ? (
        <View>
          <Icon icon={icon} size={16} color={tone.fg} />
        </View>
      ) : null}
      {label ? (
        <Text
          size="sm"
          weight="medium"
          color={tone.fg}
          numberOfLines={1}
          style={variant === 'link' && hovered ? styles.underline : undefined}
        >
          {label}
        </Text>
      ) : null}
      {icon && iconPosition === 'end' ? (
        <View>
          <Icon icon={icon} size={16} color={tone.fg} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  underline: { textDecorationLine: 'underline' },
});
