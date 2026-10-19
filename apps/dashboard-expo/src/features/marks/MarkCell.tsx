/**
 * One mark input (AddMarks.tsx MarkInput): digits only, `/max` placeholder, select-all on focus,
 * Enter / ↓ next student and ↑ previous student in the same column (Enter = "next" on phone
 * keyboards; an iOS Next bar above the number pad). On phones focus also jumps to the next student
 * once the mark can't take another digit. Tab follows the row (CQ → MCQ → Prac → next student). Red border + message when
 * the value is above the limit.
 */
import type { NativeSyntheticEvent, TextInput, TextInputKeyPressEventData } from 'react-native';
import { View } from 'react-native';
import { markEntryComplete, useControlTouch } from '@/components/ui/control';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { sanitizeMarkInput } from './entry';

export function MarkCell({
  value,
  max,
  disabled,
  error,
  label,
  inputRef,
  onChange,
  onMove,
  testID,
}: {
  value: string;
  max: number;
  disabled?: boolean;
  error?: string;
  label: string;
  inputRef?: (el: TextInput | null) => void;
  onChange: (text: string) => void;
  /** Move focus down (1) or up (-1) the column. */
  onMove: (step: 1 | -1) => void;
  testID?: string;
}) {
  // Wide tables get the compact cell (40px on touch devices), phones the 48px touch cell.
  const compact = useBreakpoint() !== 'mobile';
  const touch = useControlTouch();
  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key;
    const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    onMove(step);
  };
  return (
    <View className="items-center">
      <Input
        ref={inputRef}
        size={compact ? 'sm' : 'md'}
        stateIcon={false}
        invalid={!!error}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        editable={!disabled}
        placeholder={disabled ? '—' : `/${max}`}
        inputMode="numeric"
        keyboardType="number-pad"
        returnKeyType="next"
        submitBehavior="submit"
        autoComplete="off"
        autoCorrect={false}
        selectTextOnFocus
        maxLength={4}
        onChangeText={(t) => {
          const next = sanitizeMarkInput(t);
          onChange(next);
          // Phones: jump to the next student once the mark can't take another digit.
          if (touch && next.length > value.length && markEntryComplete(next, max)) onMove(1);
        }}
        onSubmitEditing={() => onMove(1)}
        onKeyPress={onKeyPress}
        className={touch ? 'w-[68px] text-center' : 'w-16 text-center'}
        style={{ fontVariant: ['tabular-nums'] }}
      />
      {error ? (
        <Text size="xs" color="destructive" className="mt-0.5" numberOfLines={1}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
