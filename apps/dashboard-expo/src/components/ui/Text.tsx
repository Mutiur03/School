import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { trackingWider, type FontSize, type FontWeight, type ThemeColors } from '@/theme/tokens';

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

/**
 * Text in the dashboard's typeface (Outfit) and Tailwind type scale. Each weight is a separate
 * font family on React Native, so `fontWeight` is not set (it would break Android).
 */
export function Text({
  size = 'sm',
  weight = 'regular',
  color = 'foreground',
  caps,
  tabular,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const metrics = theme.fontSizes[size];
  return (
    <RNText
      {...rest}
      style={[
        metrics,
        { fontFamily: theme.fontFamilies[weight], color: theme.colors[color] },
        caps && { textTransform: 'uppercase', letterSpacing: trackingWider(metrics.fontSize) },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
