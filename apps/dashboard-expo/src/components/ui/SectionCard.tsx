/**
 * Port of dashboard/src/components/SectionCard.tsx: `bg-card border rounded-xl shadow-sm`,
 * header `px-6 pt-6 pb-4` with `text-lg font-semibold` title, body `px-6 pb-6`. Below `sm` the
 * header action takes its own full-width line (`w-full sm:w-auto`), as on the web.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useMinWidth } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function SectionCard({
  title,
  description,
  icon,
  headerAction,
  noPadding,
  style,
  testID,
  children,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  noPadding?: boolean;
  style?: ViewStyle;
  testID?: string;
  children: ReactNode;
}) {
  const { colors, radii, shadows } = useTheme();
  const sm = useMinWidth('sm');
  const pad = 24;
  const hasHeader = !!(title || description || icon || headerAction);

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radii.xl,
          boxShadow: shadows.sm,
        },
        style,
      ]}
    >
      {hasHeader ? (
        <View style={[styles.header, { paddingHorizontal: pad, paddingTop: pad }]}>
          <View style={styles.titleRow}>
            {icon}
            <View style={styles.titles}>
              {title ? (
                <Text size="lg" weight="semibold" color="heading" style={styles.title}>
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
            <View style={sm ? styles.action : styles.actionFull}>{headerAction}</View>
          ) : null}
        </View>
      ) : null}
      <View
        style={
          noPadding
            ? undefined
            : hasHeader
              ? { paddingHorizontal: pad, paddingBottom: pad }
              : { padding: pad }
        }
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  titles: { flexShrink: 1 },
  title: { lineHeight: 22 }, // leading-tight on text-lg
  action: { flexShrink: 0, alignItems: 'flex-end' },
  actionFull: { width: '100%', alignItems: 'flex-start' },
});
