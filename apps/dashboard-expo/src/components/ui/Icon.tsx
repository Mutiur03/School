import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export type { LucideIcon };

/** lucide icon in a theme colour. lucide's default stroke width (2) matches lucide-react. */
export function Icon({
  icon: IconComponent,
  size = 16,
  color = 'foreground',
  rawColor,
}: {
  icon: LucideIcon;
  size?: number;
  color?: keyof ThemeColors;
  rawColor?: string;
}) {
  const { colors } = useTheme();
  return <IconComponent size={size} color={rawColor ?? colors[color]} />;
}
