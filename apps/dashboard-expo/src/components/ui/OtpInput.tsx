/**
 * One-time code entry: six boxes drawn over a single invisible TextInput. One real input (not six)
 * means typing, backspace, paste and SMS / keychain autofill all behave like a normal field on
 * every platform, and a screen reader sees one "6-digit code" field. Digits only. `onComplete`
 * fires once when the last digit is entered.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { cleanCode } from '@/features/auth/password-reset';
import { cn } from '@/lib/utils';
import { Input } from './Input';
import { Text } from './Text';

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  label = '6-digit code',
  testID,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const completed = useRef<string | null>(null);
  const active = Math.min(value.length, length - 1);

  // Fire once per distinct full code (a retry after an error starts from an empty value).
  useEffect(() => {
    if (value.length < length) {
      completed.current = null;
      return;
    }
    if (completed.current !== value) {
      completed.current = value;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  return (
    <View className="relative" testID={testID}>
      <View className="flex-row justify-between gap-2" pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const isActive = focused && !disabled && i === active;
          return (
            <View
              key={i}
              className={cn(
                'bg-background h-12 flex-1 items-center justify-center rounded-lg border',
                invalid ? 'border-destructive' : isActive ? 'border-primary' : 'border-control',
                isActive && 'border-2',
                disabled && 'opacity-50',
              )}
            >
              <Text size="xl" weight="semibold" tabular>
                {char ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      {/* The real field (the shared Input, kind "otp"): invisible but focusable, covers the boxes. */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
        className="overflow-hidden"
      >
        <Input
          value={value}
          onChangeText={(t) => onChange(cleanCode(t).slice(0, length))}
          editable={!disabled}
          autoFocus={autoFocus}
          maxLength={length}
          kind="otp"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          caretHidden
          selectTextOnFocus
          chain={false}
          stateIcon={false}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          testID={testID ? `${testID}-input` : undefined}
        />
      </View>
    </View>
  );
}
