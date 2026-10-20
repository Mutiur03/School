import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/utils';
import { BANGLA_FONT, scriptRuns } from '@/theme/fonts';
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
 * Text in the dashboard's typefaces (Outfit + SolaimanLipi) and Tailwind type scale. `font-*`
 * classes all map to Outfit Regular (tailwind.config.js), never `fontWeight`, which
 * breaks Android. Bangla runs use SolaimanLipi (web: CSS stack; native: nested faces).
 * `className` is merged last with cn(), so callers can override any default.
 */
export function Text({
  size = 'sm',
  weight = 'regular',
  color = 'foreground',
  caps,
  tabular,
  className,
  children,
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
    >
      {banglaChildren(children)}
    </RNText>
  );
}

function banglaChildren(children: TextProps['children']): TextProps['children'] {
  if (Platform.OS === 'web') return children;
  if (typeof children !== 'string' && typeof children !== 'number') return children;
  const runs = scriptRuns(String(children));
  if (!runs.some((r) => r.bangla)) return children;
  return runs.map((r, i) =>
    r.bangla ? (
      <RNText key={i} style={{ fontFamily: BANGLA_FONT }}>
        {r.text}
      </RNText>
    ) : (
      r.text
    ),
  );
}
