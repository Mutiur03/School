/**
 * Port of dashboard/src/components/ui/input.tsx: `rounded-lg border px-3 py-2 text-sm`,
 * white background, gray-400 placeholder, `focus:ring-2 ring-primary/20` + transparent border.
 */
import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { tw, withAlpha } from '@/theme/tokens';

export function Input({ className, onFocus, onBlur, ...rest }: TextInputProps) {
  const { colors } = useTheme();
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
      className={cn(
        'rounded-lg border bg-white px-3 py-2 text-sm font-normal text-gray-900',
        focused ? 'border-transparent' : 'border-border',
        className,
      )}
      // ring-2 ring-primary/20 is a box-shadow; outlineWidth removes the browser focus outline.
      style={{
        outlineWidth: 0,
        boxShadow: focused ? `0 0 0 2px ${withAlpha(colors.primary, 0.2)}` : undefined,
      }}
    />
  );
}
