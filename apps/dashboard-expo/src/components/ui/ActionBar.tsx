/**
 * Bar pinned under the page (PageLayout `footer`): the web's floating "N selected" bulk-actions
 * region and "Unsaved changes" bar: a centred, content-width card
 * (`bg-card border rounded-xl px-3 py-2 shadow-lg`, label left, actions right).
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CloseButton } from './Dialog';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function ActionBar({
  label,
  detail,
  onClear,
  clearLabel = 'Clear selection',
  children,
  testID,
}: {
  label: string;
  detail?: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { shadows } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center px-4 pb-4 pt-2"
    >
      <View
        testID={testID}
        accessibilityRole="toolbar"
        accessibilityLabel={label}
        className="border-border bg-card max-w-full flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2"
        style={{ boxShadow: shadows.popover }}
      >
        <View className="flex-row items-center gap-2">
          {onClear ? <CloseButton onPress={onClear} label={clearLabel} /> : null}
          <View>
            <Text size="sm" weight="medium" tabular>
              {label}
            </Text>
            {detail}
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">{children}</View>
      </View>
    </View>
  );
}
