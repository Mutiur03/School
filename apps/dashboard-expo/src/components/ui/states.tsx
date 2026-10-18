/**
 * Loading / empty / error primitives, ported from the web dashboard:
 *   LoadingState  <- components/Loading.tsx (lucide Loader2, text-primary, 32px, spinning)
 *   Skeleton      <- components/ui/skeleton.tsx (bg-sidebar-accent animate-pulse rounded-sm)
 *   EmptyState    <- `Empty` in pages/Admin/Dashboard.tsx (text-muted-foreground py-8 text-sm)
 *   ErrorState    <- error card in pages/Admin/Dashboard.tsx (AlertTriangle + "Try again")
 *   ErrorMessage  <- components/ErrorMessage.tsx, variant="block"
 */
import { AlertCircle, AlertTriangle, Loader2 } from '@/components/ui/icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';
import { Button } from './Button';
import { Icon, type LucideIcon } from './Icon';
import { SectionCard } from './SectionCard';
import { Text } from './Text';

const useNativeDriver = Platform.OS !== 'web';

function useLoop(duration: number, easing: (t: number) => number, reverse = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const step = Animated.timing(value, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver,
    });
    const loop = Animated.loop(
      reverse
        ? Animated.sequence([
            step,
            Animated.timing(value, { toValue: 0, duration, easing, useNativeDriver }),
          ])
        : step,
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, easing, reverse]);
  return value;
}

export function Spinner({ size = 32 }: { size?: number }) {
  const t = useLoop(1000, Easing.linear);
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon icon={Loader2} size={size} color="primary" />
    </Animated.View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID="loading-state"
    >
      <Spinner />
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
}) {
  const { colors, radii } = useTheme();
  // animate-pulse: opacity 1 -> 0.5 -> 1 over 2s, cubic-bezier(0.4, 0, 0.6, 1)
  const t = useLoop(1000, Easing.bezier(0.4, 0, 0.6, 1), true);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        opacity,
        borderRadius: radius ?? radii.sm,
        backgroundColor: colors.sidebarAccent,
      }}
    />
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  /** Optional heading; the dashboard's inline empty state is just one muted line. */
  title?: string;
  message: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty} testID="empty-state">
      {icon ? <Icon icon={icon} size={32} color="mutedForeground" /> : null}
      {title ? (
        <Text size="lg" weight="semibold" style={styles.mt}>
          {title}
        </Text>
      ) : null}
      <Text size="sm" color="mutedForeground" style={styles.centerText}>
        {message}
      </Text>
      {action ? <View style={styles.mt}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  title = "Couldn't load this page",
  message = 'An error occurred',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorWrap} accessibilityRole="alert" testID="error-state">
      <SectionCard style={styles.errorCard}>
        <View style={styles.errorBody}>
          <Icon icon={AlertTriangle} size={32} color="destructive" />
          <Text size="lg" weight="semibold" style={styles.errorTitle}>
            {title}
          </Text>
          <Text size="sm" color="mutedForeground" style={styles.errorMessage}>
            {message}
          </Text>
          {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
        </View>
      </SectionCard>
    </View>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.alert,
        {
          borderColor: withAlpha(colors.destructive, 0.4),
          backgroundColor: withAlpha(colors.destructive, 0.1),
          borderRadius: radii.sm,
        },
      ]}
    >
      <View style={styles.alertIcon}>
        <Icon icon={AlertCircle} size={16} color="destructive" />
      </View>
      <Text size="sm" color="destructive" style={styles.flex}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 4 },
  centerText: { textAlign: 'center' },
  mt: { marginTop: 12 },
  errorWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  errorCard: { width: '100%', maxWidth: 448 },
  errorBody: { alignItems: 'center' },
  errorTitle: { marginTop: 12, marginBottom: 4, textAlign: 'center' },
  errorMessage: { marginBottom: 20, textAlign: 'center' },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertIcon: { marginTop: 2 },
  flex: { flex: 1 },
});
