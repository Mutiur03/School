import { Keyboard, Pressable } from 'react-native';
import { Icon } from './Icon';
import { Search, XIcon } from './icons';
import { Input } from './Input';

/**
 * Search box: Input with a leading Search icon, max 420px wide like the web lists, the search
 * keyboard, and a clear (×) button once there is text. Return dismisses the keyboard (results
 * already filter as you type).
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
  label,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  label: string;
  testID?: string;
}) {
  return (
    <Input
      kind="search"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel={label}
      testID={testID}
      returnKeyType="search"
      onSubmitEditing={() => Keyboard.dismiss()}
      containerClassName="max-w-[420px]"
      leading={<Icon icon={Search} size={16} color="mutedForeground" />}
      trailing={
        value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            testID={testID ? `${testID}-clear` : undefined}
            onPress={() => onChangeText('')}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
          >
            <Icon icon={XIcon} size={16} color="mutedForeground" />
          </Pressable>
        ) : undefined
      }
    />
  );
}
