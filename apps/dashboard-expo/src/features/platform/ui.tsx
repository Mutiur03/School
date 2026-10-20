/** Shared bits for the platform pages: confirm gate hook, school logo, SMS mode badge. */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, View, type ImageProps } from 'react-native';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { Cloud, School, ServerCog } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { appConfig } from '@/config/env';
import { cn } from '@/lib/utils';
import { usePlatformApi } from '@/session/ApiProvider';
import { resolveFileUrl } from '@/tenant/branding';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { createConfirmGate, type ConfirmGate } from './confirm-gate';
import { smsMode, type ConfirmCopy } from './model';
import type { SmsOverviewRow } from '@/lib/api';

/** Query key under this platform session's private namespace (`_platform.<host>`). */
export function usePlatformKey() {
  const { resolution } = useTenant();
  return (...parts: readonly unknown[]) =>
    privateQueryKey(resolution.tenantKey, 'platform', ...parts);
}

export function usePlatformSchools() {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  return useQuery({
    queryKey: key('schools'),
    queryFn: ({ signal }) => platform.listSchools(signal),
    staleTime: 30_000,
  });
}

export function useConfirmGate(): {
  gate: ConfirmGate;
  ask: (copy: ConfirmCopy, run: () => Promise<unknown>) => boolean;
  dialog: React.ReactElement;
} {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<ConfirmGate | null>(null);
  ref.current ??= createConfirmGate(rerender);
  const gate = ref.current;
  const copy = gate.pending?.copy;
  const dialog = (
    <ConfirmDialog
      open={!!gate.pending}
      title={copy?.title}
      message={copy?.message ?? ''}
      confirmLabel={copy?.confirmLabel ?? 'Confirm'}
      tone={copy?.tone ?? 'default'}
      busy={gate.busy}
      onConfirm={() => void gate.confirm()}
      onClose={() => gate.cancel()}
    />
  );
  return { gate, ask: (c, run) => gate.request(c, run), dialog };
}

/** Fades and slides its children in on mount (a panel or field appearing). */
export function FadeSlideIn({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Image that shows `fallback` when `uri` is missing or fails to load (broken URL, offline, 404). */
export function FallbackImage({
  uri,
  fallback,
  ...props
}: Omit<ImageProps, 'source'> & { uri?: string | null; fallback: ReactNode }) {
  // Remember which uri failed, so a new uri (e.g. after Replace) gets a fresh try.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) return <>{fallback}</>;
  return <Image {...props} source={{ uri }} onError={() => setFailedUri(uri)} />;
}

export function SchoolLogo({
  logo,
  uri,
  size = 40,
}: {
  logo?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const src = uri ?? resolveFileUrl(logo, appConfig.cdnUrl);
  return (
    <FallbackImage
      uri={src}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: 8 }}
      className="border-border border"
      fallback={
        <View
          className="bg-muted items-center justify-center rounded-lg"
          style={{ width: size, height: size }}
        >
          <Icon icon={School} size={size / 2} color="mutedForeground" />
        </View>
      }
    />
  );
}

export function ModeBadge({ row }: { row: Pick<SmsOverviewRow, 'configured' | 'self_hosted'> }) {
  const mode = smsMode(row);
  const box =
    mode === 'not-configured'
      ? 'border-border'
      : mode === 'self-hosted'
        ? 'border-emerald-200/60 bg-emerald-500/15'
        : 'border-primary/20 bg-primary/10';
  const fg = mode === 'self-hosted' ? 'text-emerald-700' : mode === 'shared' ? 'text-primary' : '';
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-full border px-2.5 py-0.5',
        box,
      )}
    >
      {mode === 'self-hosted' ? (
        <Icon icon={ServerCog} size={12} rawColor="#047857" />
      ) : mode === 'shared' ? (
        <Icon icon={Cloud} size={12} color="primary" />
      ) : null}
      <Text size="xs" weight="medium" color="mutedForeground" className={fg}>
        {mode === 'not-configured'
          ? 'Not configured'
          : mode === 'self-hosted'
            ? 'Self-hosted'
            : 'Shared account'}
      </Text>
    </View>
  );
}
