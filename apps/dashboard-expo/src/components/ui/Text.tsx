import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/utils';
import type { FontSize, FontWeight, ThemeColors } from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  /** Tailwind text size (`text-xs` ... `text-2xl`). Defaults to `text-sm`. */
  size?: FontSize;
  weight?: FontWeight;
  color?: keyof ThemeColors;
  /** `uppercase tracking-wider`, as used by sidebar section labels and table headers. */
  caps?: boolean;
  /** `tabular-nums`. */
  tabular?: boolean;
}

// Full class strings (not built at runtime) so Tailwind's content scan finds them.
const SIZE: Record<FontSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const WEIGHT: Record<FontWeight, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const TEXT_COLOR: Record<keyof ThemeColors, string> = {
  background: 'text-background',
  foreground: 'text-foreground',
  card: 'text-card',
  cardForeground: 'text-card-foreground',
  popover: 'text-popover',
  popoverForeground: 'text-popover-foreground',
  primary: 'text-primary',
  primaryForeground: 'text-primary-foreground',
  secondary: 'text-secondary',
  secondaryForeground: 'text-secondary-foreground',
  muted: 'text-muted',
  mutedForeground: 'text-muted-foreground',
  accent: 'text-accent',
  accentForeground: 'text-accent-foreground',
  destructive: 'text-destructive',
  border: 'text-border',
  input: 'text-input',
  ring: 'text-ring',
  chart1: 'text-chart-1',
  chart2: 'text-chart-2',
  chart3: 'text-chart-3',
  chart4: 'text-chart-4',
  chart5: 'text-chart-5',
  sidebar: 'text-sidebar',
  sidebarForeground: 'text-sidebar-foreground',
  sidebarPrimary: 'text-sidebar-primary',
  sidebarPrimaryForeground: 'text-sidebar-primary-foreground',
  sidebarAccent: 'text-sidebar-accent',
  sidebarAccentForeground: 'text-sidebar-accent-foreground',
  sidebarBorder: 'text-sidebar-border',
  sidebarRing: 'text-sidebar-ring',
  heading: 'text-gray-900',
  seriesAbsent: 'text-series-absent',
  seriesRanAway: 'text-series-ran-away',
};

/**
 * Text in the dashboard's typeface (Outfit) and Tailwind type scale. `font-*` classes select an
 * Outfit family per weight (tailwind.config.js), never `fontWeight`, which breaks Android.
 * `className` is merged last with cn(), so callers can override any default.
 */
export function Text({
  size = 'sm',
  weight = 'regular',
  color = 'foreground',
  caps,
  tabular,
  className,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      className={cn(
        SIZE[size],
        WEIGHT[weight],
        TEXT_COLOR[color],
        caps && 'uppercase tracking-wider',
        tabular && 'tabular-nums',
        className,
      )}
    />
  );
}
