/**
 * Web: the browser's own date input (phones get their native date wheel/calendar from it), drawn
 * with the shared control spec (./control.ts): touch density on narrow screens.
 */
import { useState } from 'react';
import { useTheme } from '@/theme/ThemeProvider';
import { BANGLA_FONT } from '@/theme/fonts';
import { fontFamilies, radii } from '@/theme/tokens';
import {
  CONTROL_TEXT,
  controlBorderColor,
  controlBorderInset,
  controlBorderWidth,
  controlFontSize,
  controlHeight,
  controlPadX,
  controlRing,
  useControlTouch,
} from './control';
import type { DateInputProps } from './DateInput';

export type { DateInputProps } from './DateInput';

export function DateInput({ value, onChange, label, invalid, testID }: DateInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const touch = useControlTouch();
  const state = { touch, focused, invalid };
  return (
    <input
      type="date"
      value={value}
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-testid={testID}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: controlHeight(state),
        borderRadius: touch ? radii.xl : radii.lg,
        border: `${controlBorderWidth(state)}px solid ${controlBorderColor(colors, state)}`,
        boxShadow: controlRing(colors, state) ?? 'none',
        padding: `0 ${controlPadX(state) - controlBorderInset(state)}px`,
        fontSize: controlFontSize(state),
        fontFamily: `${fontFamilies.regular}, ${BANGLA_FONT}, system-ui, sans-serif`,
        color: value ? CONTROL_TEXT : '#99a1af',
        caretColor: colors.ring,
        background: '#fff',
        outline: 'none',
      }}
    />
  );
}
