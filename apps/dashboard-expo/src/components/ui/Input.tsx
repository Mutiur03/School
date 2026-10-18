/**
 * Port of dashboard/src/components/ui/input.tsx: `rounded-lg border px-3 py-2 text-sm`,
 * white background, gray-400 placeholder, `focus:ring-2 ring-primary/20` + transparent border.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { tw, withAlpha } from '@/theme/tokens';

export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const { colors, radii, fontFamilies, fontSizes } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={tw.gray400}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        fontSizes.sm,
        {
          fontFamily: fontFamilies.regular,
          color: tw.gray900,
          backgroundColor: tw.white,
          borderRadius: radii.lg,
          borderColor: focused ? 'transparent' : colors.border,
          boxShadow: focused ? `0 0 0 2px ${withAlpha(colors.primary, 0.2)}` : undefined,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, outlineWidth: 0 },
});
