/**
 * Bar pinned under the page (PageLayout `footer`): the web's floating "N selected" bulk-actions
 * region and "Unsaved changes" bar (`border-t bg-card`, label left, actions right).
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CloseButton } from './Dialog';
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
  return (
    <View
      testID={testID}
      accessibilityRole="toolbar"
      accessibilityLabel={label}
      className="border-border bg-card flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t px-4 py-3"
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
  );
}
