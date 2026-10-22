/**
 * The small stats card on Holidays / Events (`rounded-xl border bg-card px-5 py-4 shadow-sm`
 * grid of `Stat`: muted label with an optional coloured dot, `text-xl font-semibold` value).
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number | string;
  dot?: string;
}) {
  return (
    <View className="min-w-[40%] flex-1 gap-0.5 sm:min-w-0">
      <View className="flex-row items-center gap-1.5">
        {dot ? <View className={cn('h-1.5 w-1.5 rounded-full', dot)} /> : null}
        <Text size="xs" color="mutedForeground">
          {label}
        </Text>
      </View>
      <Text size="xl" weight="semibold" tabular>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
    </View>
  );
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  const { shadows } = useTheme();
  return (
    <View
      className={cn(
        'border-border bg-card flex-row flex-wrap gap-x-6 gap-y-4 rounded-xl border px-5 py-4',
        className,
      )}
      style={{ boxShadow: shadows.sm }}
    >
      {children}
    </View>
  );
}
