/**
 * Port of dashboard/src/components/SectionCard.tsx: `bg-card border rounded-xl shadow-sm`,
 * header `px-6 pt-6 pb-4` with `text-lg font-semibold` title, body `px-6 pb-6`. Below `sm` the
 * header action takes its own full-width line (`w-full sm:w-auto`), as on the web.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function SectionCard({
  title,
  description,
  icon,
  headerAction,
  noPadding,
  className,
  testID,
  children,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  noPadding?: boolean;
  className?: string;
  testID?: string;
  children: ReactNode;
}) {
  const { shadows } = useTheme();
  const hasHeader = !!(title || description || icon || headerAction);

  return (
    <View
      testID={testID}
      className={cn('border-border bg-card overflow-hidden rounded-xl border', className)}
      style={{ boxShadow: shadows.sm }}
    >
      {hasHeader ? (
        <View className="flex-row flex-wrap items-start justify-between gap-4 px-6 pb-4 pt-6">
          <View className="shrink flex-row items-center gap-2">
            {icon}
            <View className="shrink">
              {title ? (
                <Text size="lg" weight="semibold" color="heading" className="leading-tight">
                  {title}
                </Text>
              ) : null}
              {description ? (
                <Text size="sm" color="mutedForeground">
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
          {headerAction ? (
            <View className="w-full items-start sm:w-auto sm:shrink-0 sm:items-end">
              {headerAction}
            </View>
          ) : null}
        </View>
      ) : null}
      <View className={noPadding ? undefined : hasHeader ? 'px-6 pb-6' : 'p-6'}>{children}</View>
    </View>
  );
}
