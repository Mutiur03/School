/**
 * Multi-select filter, standing in for the web's column-menu checkboxes (ColumnHeaderMenu
 * `options` / `selected`): an input-styled trigger ("All …", one label, or "N selected") opening
 * a checklist in a popover card (bottom sheet on phones) with Clear and Done. Pure JS.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { tw } from '@/theme/tokens';
import { useControlTouch } from './control';
import { Icon } from './Icon';
import { Check } from './icons';
import { multiLabel, toggleValue, type MultiOption } from './multi-select-model';
import { OptionSheet, SelectTrigger } from './select-parts';
import { Text } from './Text';

export function MultiSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
  allLabel = 'All',
  disabled,
  className,
  size = 'default',
  testID,
}: {
  value: readonly T[];
  options: readonly MultiOption<T>[];
  onChange: (value: T[]) => void;
  /** Accessible name, and the heading of the list. */
  label: string;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm';
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const touch = useControlTouch();
  const text = multiLabel(value, options, allLabel);
  return (
    <>
      <SelectTrigger
        testID={testID}
        label={label}
        text={value.length ? text : undefined}
        placeholder={text}
        size={size}
        open={open}
        disabled={disabled}
        className={className}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        options={options}
        empty="Nothing to filter by yet."
        renderOption={(o, row, textSize) => {
          const checked = value.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onChange(toggleValue(value, o.value, options))}
              className={row}
            >
              <View
                className={cn(
                  'items-center justify-center rounded border',
                  touch ? 'h-5 w-5' : 'h-4 w-4',
                  checked ? 'border-primary bg-primary' : 'border-control bg-white',
                )}
              >
                {checked ? <Icon icon={Check} size={touch ? 14 : 12} rawColor={tw.white} /> : null}
              </View>
              <Text size={textSize} className="shrink">
                {o.label}
              </Text>
            </Pressable>
          );
        }}
        footer={
          <View className="border-border flex-row justify-between border-t px-2 py-2">
            <Pressable
              accessibilityRole="button"
              disabled={value.length === 0}
              onPress={() => onChange([])}
              className={cn(
                'justify-center rounded-md px-3',
                touch ? 'min-h-11' : 'py-1.5',
                value.length === 0 && 'opacity-50',
              )}
            >
              <Text size={touch ? 'base' : 'sm'} weight="medium" color="mutedForeground">
                Clear
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              className={cn(
                'bg-primary justify-center rounded-md px-4',
                touch ? 'min-h-11' : 'py-1.5',
              )}
              testID={testID ? `${testID}-done` : undefined}
            >
              <Text
                size={touch ? 'base' : 'sm'}
                weight="medium"
                className="text-primary-foreground"
              >
                Done
              </Text>
            </Pressable>
          </View>
        }
      />
    </>
  );
}
