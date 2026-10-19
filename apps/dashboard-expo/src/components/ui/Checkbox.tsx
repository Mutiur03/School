/** `<input type="checkbox" className="h-4 w-4">` + label, as on the web forms. */
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { tw } from '@/theme/tokens';
import { Icon } from './Icon';
import { Check } from './icons';
import { Text } from './Text';

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  boxed,
  disabled,
  testID,
  accessibilityLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  /** `border rounded-lg p-3` card variant (Holidays "Optional"). */
  boxed?: boolean;
  disabled?: boolean;
  testID?: string;
  /** Screen-reader name for a box drawn without a visible label (table select columns). */
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={cn(
        'flex-row items-start gap-3 self-start',
        boxed && 'border-border self-stretch rounded-lg border p-3',
        disabled && 'opacity-50',
      )}
    >
      <View
        className={cn(
          'mt-0.5 h-4 w-4 items-center justify-center rounded border',
          checked ? 'border-primary bg-primary' : 'border-control bg-white',
        )}
      >
        {checked ? <Icon icon={Check} size={12} rawColor={tw.white} /> : null}
      </View>
      {label || description ? (
        <View className="shrink">
          {label ? (
            <Text size="sm" weight="medium">
              {label}
            </Text>
          ) : null}
          {description ? (
            <Text size="sm" color="mutedForeground">
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
