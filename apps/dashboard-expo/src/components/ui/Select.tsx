/**
 * Native stand-in for the web `<select className={filterSelectClassName}>`: a trigger with the
 * shared control spec (./control.ts: same height, border, radius and focus/invalid ring as
 * Input) plus a chevron, opening a list of options: a bottom sheet on phones (drag handle, 48px rows, search past 8
 * options), a popover card on wider screens (./select-parts.tsx).
 * Pure JS, no native picker module.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { Check } from './icons';
import { OptionSheet, SelectTrigger } from './select-parts';
import { Text } from './Text';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = 'Select',
  label,
  size = 'default',
  invalid,
  disabled,
  className,
  testID,
}: {
  value: T | null | undefined;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** Accessible name, and the heading of the option list. */
  label: string;
  size?: 'default' | 'sm';
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <SelectTrigger
        testID={testID}
        label={label}
        text={current?.label}
        placeholder={placeholder}
        size={size}
        open={open}
        invalid={invalid}
        disabled={disabled}
        className={className}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        options={options}
        renderOption={(o, row, textSize) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="menuitem"
              accessibilityState={{ selected }}
              onPress={() => {
                setOpen(false);
                onChange(o.value);
              }}
              className={cn(row, 'justify-between', selected && 'bg-accent')}
            >
              <Text size={textSize} weight={selected ? 'medium' : 'regular'} className="shrink">
                {o.label}
              </Text>
              {selected ? <Icon icon={Check} size={18} color="primary" /> : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}

/** Radio pair/segmented choice (`<input type="radio">` rows on the web). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row flex-wrap gap-2"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            className={cn(
              'h-9 flex-row items-center gap-2 rounded-md border px-3',
              selected ? 'border-primary bg-primary/5' : 'border-control bg-white',
            )}
          >
            <View
              className={cn(
                'h-4 w-4 items-center justify-center rounded-full border',
                selected ? 'border-primary' : 'border-control',
              )}
            >
              {selected ? <View className="bg-primary h-2 w-2 rounded-full" /> : null}
            </View>
            <Text size="sm">{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
