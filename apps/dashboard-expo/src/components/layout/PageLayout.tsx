/**
 * Page frame, mirroring the dashboard pages: `mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6`
 * with a header of `text-2xl font-bold` title, `text-sm text-muted-foreground` subtitle and
 * right-aligned actions (pages/Admin/Dashboard.tsx, components/PageHeader.tsx).
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScrollView } from '@/components/ui/ScrollView';
import { Text } from '@/components/ui/Text';

export function PageLayout({
  title,
  titleAccessory,
  description,
  actions,
  badge,
  children,
}: {
  title: string;
  /** Rendered inline after the title (e.g. the Session selector on Student List). */
  titleAccessory?: ReactNode;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ScrollView contentContainerClassName="grow p-4 sm:p-6 lg:p-8">
      <View className="w-full max-w-7xl gap-6 self-center">
        <View className="flex-row flex-wrap items-end justify-between gap-4">
          <View className="shrink">
            <View className="flex-row flex-wrap items-center gap-3">
              <Text size="2xl" weight="bold" color="heading" accessibilityRole="header">
                {title}
              </Text>
              {titleAccessory}
              {badge}
            </View>
            {description ? (
              <Text size="sm" color="mutedForeground" tabular className="mt-1">
                {description}
              </Text>
            ) : null}
          </View>
          {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}
