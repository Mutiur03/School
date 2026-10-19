/**
 * Shared pieces of Select / MultiSelect: the input-styled trigger and the option list.
 * The list is a native-feeling bottom sheet on phones (drag handle, 48px rows, 16px text, a search
 * field once there are more than 8 options, safe-area padding) and a centred popover card on wider
 * screens. Tapping the backdrop or the Android back button closes it.
 */
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import {
  controlBorderInset,
  controlClassName,
  controlFrameStyle,
  controlPadX,
  useControlTouch,
  WEB_NO_OUTLINE,
  type ControlState,
} from './control';
import { Icon } from './Icon';
import { AlertCircle, ChevronDown } from './icons';
import { ScrollView } from './ScrollView';
import { SearchInput } from './SearchInput';
import { Text } from './Text';

/** Lists longer than this get a search field in the sheet. */
export const SEARCH_THRESHOLD = 8;

export function SelectTrigger({
  text,
  placeholder,
  label,
  size,
  open,
  invalid,
  disabled,
  className,
  testID,
  onPress,
}: {
  text: string | undefined;
  placeholder: string;
  label: string;
  size: 'default' | 'sm';
  open: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  testID?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const touch = useControlTouch();
  const [focused, setFocused] = useState(false);
  const control: ControlState = {
    size: size === 'sm' ? 'sm' : 'md',
    touch,
    focused: focused || open,
    invalid,
    disabled,
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={text ?? placeholder}
      accessibilityState={{ disabled: !!disabled, expanded: open }}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        'flex-row items-center justify-between gap-2',
        controlClassName(control),
        className,
      )}
      style={[
        controlFrameStyle(colors, control),
        { paddingHorizontal: controlPadX(control) - controlBorderInset(control) },
        WEB_NO_OUTLINE,
      ]}
    >
      <Text
        size={touch && size !== 'sm' ? 'base' : 'sm'}
        weight={size === 'sm' ? 'medium' : 'regular'}
        color={text ? (disabled ? 'mutedForeground' : 'foreground') : 'mutedForeground'}
        numberOfLines={1}
        className="shrink"
      >
        {text ?? placeholder}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {invalid ? <Icon icon={AlertCircle} size={16} color="destructive" /> : null}
        <Icon icon={ChevronDown} size={touch ? 18 : 16} color="mutedForeground" />
      </View>
    </Pressable>
  );
}

export function OptionSheet<O extends { label: string }>({
  open,
  onClose,
  title,
  options,
  renderOption,
  empty,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: readonly O[];
  renderOption: (o: O, rowClassName: string, textSize: 'sm' | 'base') => ReactNode;
  empty?: string;
  footer?: ReactNode;
}) {
  const { shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useBreakpoint() === 'mobile';
  const touch = useControlTouch();
  const [query, setQuery] = useState('');
  const searchable = options.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const close = () => {
    setQuery('');
    onClose();
  };
  const row = cn(
    'hover:bg-accent active:bg-accent flex-row items-center rounded-md px-3',
    touch ? 'min-h-12 gap-3 py-3' : 'gap-2 py-2.5',
  );
  return (
    <Modal
      transparent
      visible={open}
      animationType={sheet ? 'slide' : 'fade'}
      onRequestClose={close}
    >
      <View
        className={cn(
          'flex-1 bg-black/40',
          sheet ? 'justify-end' : 'items-center justify-center p-6',
        )}
      >
        <Pressable accessibilityLabel="Close list" className="absolute inset-0" onPress={close} />
        <View
          className={cn(
            'border-border bg-popover w-full overflow-hidden border',
            sheet ? 'max-h-[80%] rounded-t-2xl' : 'max-h-[70%] max-w-xs rounded-xl',
          )}
          style={{ boxShadow: shadows.popover, paddingBottom: sheet ? insets.bottom : 0 }}
        >
          {sheet ? (
            <View
              className="items-center pt-2"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <View className="h-1 w-10 rounded-full bg-gray-300" />
            </View>
          ) : null}
          <View className={cn('border-border gap-3 border-b px-4', sheet ? 'pb-3 pt-2' : 'py-3')}>
            <Text size={sheet ? 'base' : 'sm'} weight="semibold" accessibilityRole="header">
              {title}
            </Text>
            {searchable ? (
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                label={`Search ${title}`}
              />
            ) : null}
          </View>
          <ScrollView contentContainerClassName="p-1" keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text size="sm" color="mutedForeground" className="px-3 py-3">
                {q ? 'No matches.' : (empty ?? 'Nothing to choose from yet.')}
              </Text>
            ) : null}
            {shown.map((o) => renderOption(o, row, touch ? 'base' : 'sm'))}
          </ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}
