/**
 * Page frame, mirroring the dashboard pages: `mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6`
 * with a header of `text-2xl font-bold` title, `text-sm text-muted-foreground` subtitle and
 * right-aligned actions (pages/Admin/Dashboard.tsx, components/PageHeader.tsx).
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useMinWidth } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';

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
  const { layout } = useTheme();
  const sm = useMinWidth('sm');
  const lg = useMinWidth('lg');
  const pad = lg ? 32 : sm ? 24 : 16;

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { padding: pad }]}>
      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth }]}>
        <View style={styles.head}>
          <View style={styles.titles}>
            <View style={styles.titleRow}>
              <Text size="2xl" weight="bold" color="heading" accessibilityRole="header">
                {title}
              </Text>
              {titleAccessory}
              {badge}
            </View>
            {description ? (
              <Text size="sm" color="mutedForeground" tabular style={styles.description}>
                {description}
              </Text>
            ) : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  inner: { width: '100%', alignSelf: 'center', gap: 24 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  titles: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  description: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
