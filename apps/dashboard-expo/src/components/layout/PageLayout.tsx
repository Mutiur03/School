/**
 * Page frame, mirroring the dashboard pages: `mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6`
 * with a header of `text-2xl font-bold` title, `text-sm text-muted-foreground` subtitle and
 * right-aligned actions (pages/Admin/Dashboard.tsx, components/PageHeader.tsx).
 */
import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { FormChain } from '@/components/ui/form-chain';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { Text } from '@/components/ui/Text';

export function PageLayout({
  title,
  titleAccessory,
  description,
  actions,
  badge,
  children,
  onRefresh,
  refreshing = false,
  footer,
}: {
  title: string;
  /** Rendered inline after the title (e.g. the Session selector on Student List). */
  titleAccessory?: ReactNode;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  /** Pull-to-refresh (native; react-native-web renders no pull gesture). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pinned under the scroll area (e.g. the "N unsaved" bar on Marks entry). */
  footer?: ReactNode;
}) {
  const page = (
    <KeyboardAwareScrollView
      contentContainerClassName="grow p-4 sm:p-6 lg:p-8"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <View className="w-full max-w-7xl gap-6 self-center">
        <View className="mb-2 flex-row flex-wrap items-start justify-between gap-4">
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
        <FormChain>{children}</FormChain>
      </View>
    </KeyboardAwareScrollView>
  );
  // `footer={null}` keeps the wrapper mounted, so showing the bar later does not remount the
  // scroll view (and drop focus from the input being typed in).
  if (footer === undefined) return page;
  return (
    <View className="flex-1">
      {page}
      {footer}
    </View>
  );
}
