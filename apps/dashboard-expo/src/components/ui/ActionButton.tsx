/**
 * Port of dashboard/src/components/ActionButton.tsx (icon-only): quiet ghost button,
 * `text-muted-foreground rounded-md h-8 w-8`, coloured only on hover (`bg-*-500/10 text-*-700`).
 */
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { tw, withAlpha } from '@/theme/tokens';
import { Icon, type LucideIcon } from './Icon';

const TONES = {
  blue: { bg: withAlpha(tw.blue500, 0.1), fg: tw.blue700 },
  emerald: { bg: withAlpha(tw.emerald500, 0.1), fg: tw.emerald700 },
} as const;

export function ActionButton({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tone: keyof typeof TONES;
  onPress?: () => void;
}) {
  const { colors, radii } = useTheme();
  const [hovered, setHovered] = useState(false);
  const t = TONES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.btn,
        { borderRadius: radii.md, backgroundColor: hovered ? t.bg : 'transparent' },
      ]}
    >
      <Icon icon={icon} size={14} rawColor={hovered ? t.fg : colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
