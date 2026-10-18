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
import { Animated, Easing, Platform, View, type DimensionValue } from 'react-native';
import { cn } from '@/lib/utils';
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
      className="items-center justify-center py-12"
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
  className,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Extra classes, e.g. `rounded-full` (default `rounded-sm`). */
  className?: string;
}) {
  // animate-pulse: opacity 1 -> 0.5 -> 1 over 2s, cubic-bezier(0.4, 0, 0.6, 1). Driven by RN
  // Animated (NativeWind's `animate-*` support is experimental); size is a runtime value.
  const t = useLoop(1000, Easing.bezier(0.4, 0, 0.6, 1), true);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, opacity }}
    >
      <View className={cn('bg-sidebar-accent flex-1 rounded-sm', className)} />
    </Animated.View>
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
    <View className="items-center justify-center gap-1 py-8" testID="empty-state">
      {icon ? <Icon icon={icon} size={32} color="mutedForeground" /> : null}
      {title ? (
        <Text size="lg" weight="semibold" className="mt-3">
          {title}
        </Text>
      ) : null}
      <Text size="sm" color="mutedForeground" className="text-center">
        {message}
      </Text>
      {action ? <View className="mt-3">{action}</View> : null}
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
    <View
      className="items-center justify-center py-12"
      accessibilityRole="alert"
      testID="error-state"
    >
      <SectionCard className="w-full max-w-md">
        <View className="items-center">
          <Icon icon={AlertTriangle} size={32} color="destructive" />
          <Text size="lg" weight="semibold" className="mb-1 mt-3 text-center">
            {title}
          </Text>
          <Text size="sm" color="mutedForeground" className="mb-5 text-center">
            {message}
          </Text>
          {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
        </View>
      </SectionCard>
    </View>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="border-destructive/40 bg-destructive/10 flex-row items-start gap-3 rounded-sm border px-4 py-3"
    >
      <View className="mt-0.5">
        <Icon icon={AlertCircle} size={16} color="destructive" />
      </View>
      <Text size="sm" color="destructive" className="flex-1">
        {message}
      </Text>
    </View>
  );
}
