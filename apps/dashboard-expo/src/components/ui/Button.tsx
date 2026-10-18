/**
 * Port of dashboard/src/components/ui/button.tsx (shadcn new-york, cva variants).
 * The variant/size class strings are the web ones, adapted where RN differs (no `has-[>svg]`,
 * text colour lives on the label). `active:` reuses the hover colour on touch.
 */
import { useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';
import type { ThemeColors } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
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
  className?: string;
}

const VARIANT: Record<ButtonVariant, { box: string; fg: keyof ThemeColors }> = {
  default: { box: 'bg-primary hover:bg-primary/90 active:bg-primary/90', fg: 'primaryForeground' },
  destructive: {
    box: 'bg-destructive hover:bg-destructive/90 active:bg-destructive/90',
    fg: 'primaryForeground',
  },
  outline: {
    box: 'border border-border bg-background hover:bg-accent active:bg-accent',
    fg: 'foreground',
  },
  secondary: {
    box: 'bg-secondary hover:bg-secondary/80 active:bg-secondary/80',
    fg: 'secondaryForeground',
  },
  ghost: { box: 'hover:bg-accent active:bg-accent', fg: 'foreground' },
  link: { box: '', fg: 'primary' },
};

// [base, with icon + label] (`has-[>svg]:px-*` on web).
const SIZE: Record<ButtonSize, [string, string]> = {
  default: ['h-9 px-4 gap-2', 'h-9 px-3 gap-2'],
  sm: ['h-8 px-3 gap-1.5', 'h-8 px-2.5 gap-1.5'],
  lg: ['h-10 px-6 gap-2', 'h-10 px-4 gap-2'],
  icon: ['h-9 w-9', 'h-9 w-9'],
  'icon-sm': ['h-8 w-8', 'h-8 w-8'],
};

export function Button({
  label,
  icon,
  iconPosition = 'start',
  variant = 'default',
  size = 'default',
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const { shadows } = useTheme();
  // Only the link variant needs JS hover state (underline is on the child label).
  const [hovered, setHovered] = useState(false);
  const tone = VARIANT[variant];
  const iconEl = icon ? <Icon icon={icon} size={16} color={tone.fg} /> : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      {...rest}
      className={cn(
        'shrink-0 flex-row items-center justify-center rounded-sm',
        SIZE[size][icon && label ? 1 : 0],
        tone.box,
        disabled && 'opacity-50',
        className,
      )}
      // shadow-xs: kept as an RN boxShadow string (see README, "Styling approach").
      style={variant === 'outline' ? { boxShadow: shadows.xs } : undefined}
    >
      {iconPosition === 'start' ? iconEl : null}
      {label ? (
        <Text
          size="sm"
          weight="medium"
          color={tone.fg}
          numberOfLines={1}
          className={variant === 'link' && hovered ? 'underline' : undefined}
        >
          {label}
        </Text>
      ) : null}
      {iconPosition === 'end' ? iconEl : null}
    </Pressable>
  );
}
