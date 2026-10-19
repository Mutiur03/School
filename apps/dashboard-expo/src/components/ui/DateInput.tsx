/**
 * Date field (`<Input type="date">` on the web dashboard). Native: a field that opens the system
 * calendar (@react-native-community/datetimepicker): the Android system date dialog, or on iOS a
 * bottom sheet with the inline calendar plus Cancel / Done (the date is only committed on Done).
 * Touch sizing comes from the shared control spec. Values stay
 * `YYYY-MM-DD` in local time. Web: DateInput.web.tsx renders the browser's date input.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateFieldLabel, parseIsoDate, toIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import {
  controlBorderInset,
  controlClassName,
  controlFrameStyle,
  controlPadX,
  useControlTouch,
} from './control';
import { Icon } from './Icon';
import { AlertCircle, CalendarDays, XIcon } from './icons';
import { Text } from './Text';

export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  testID?: string;
}

export function DateInput({ value, onChange, label, invalid, testID }: DateInputProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const touch = useControlTouch();
  const control = { touch, focused: iosOpen, invalid };
  const current = parseIsoDate(value) ?? new Date();
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toIsoDate(date));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  };
  const closeIos = (commit: boolean) => {
    if (commit && draft) onChange(toIsoDate(draft));
    setIosOpen(false);
  };
  return (
    <View>
      <View
        className={cn('flex-row items-center', controlClassName(control))}
        style={controlFrameStyle(colors, control)}
      >
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}: ${dateFieldLabel(value)}` : label}
          accessibilityState={{ expanded: iosOpen }}
          testID={testID}
          className="h-full flex-1 flex-row items-center gap-2"
          style={{
            paddingLeft: controlPadX(control) - controlBorderInset(control),
            paddingRight: controlPadX(control),
          }}
        >
          <Icon icon={CalendarDays} size={touch ? 18 : 16} color="mutedForeground" />
          <Text
            size={touch ? 'base' : 'sm'}
            color={value ? 'foreground' : 'mutedForeground'}
            numberOfLines={1}
            className="shrink"
          >
            {value ? dateFieldLabel(value) : 'Pick a date'}
          </Text>
        </Pressable>
        {invalid ? (
          <View className="pr-1">
            <Icon icon={AlertCircle} size={16} color="destructive" />
          </View>
        ) : null}
        {value ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={8}
            className="h-full justify-center px-3"
          >
            <Icon icon={XIcon} size={touch ? 16 : 14} color="mutedForeground" />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' ? (
        <Modal
          transparent
          visible={iosOpen}
          animationType="slide"
          onRequestClose={() => closeIos(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <Pressable
              accessibilityLabel="Close calendar"
              className="absolute inset-0"
              onPress={() => closeIos(false)}
            />
            <View
              className="bg-popover rounded-t-2xl"
              style={{ boxShadow: shadows.popover, paddingBottom: insets.bottom + 8 }}
            >
              <View className="border-border flex-row items-center justify-between border-b px-2 py-1">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => closeIos(false)}
                  className="min-h-11 justify-center px-3 active:opacity-60"
                >
                  <Text size="base" color="mutedForeground">
                    Cancel
                  </Text>
                </Pressable>
                <Text
                  size="base"
                  weight="semibold"
                  accessibilityRole="header"
                  numberOfLines={1}
                  className="shrink"
                >
                  {label}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID={testID ? `${testID}-done` : undefined}
                  onPress={() => closeIos(true)}
                  className="min-h-11 justify-center px-3 active:opacity-60"
                >
                  <Text size="base" weight="semibold" color="primary">
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft ?? current}
                mode="date"
                display="inline"
                accentColor={colors.ring}
                onChange={(_event, date) => {
                  if (date) setDraft(date);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
