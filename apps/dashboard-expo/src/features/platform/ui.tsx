/** Shared bits for the platform pages: confirm gate hook, school logo, SMS mode badge. */
import { useQuery } from '@tanstack/react-query';
import { useReducer, useRef } from 'react';
import { Image, View } from 'react-native';
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
  return src ? (
    <Image
      source={{ uri: src }}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: 8 }}
      className="border-border border"
    />
  ) : (
    <View
      className="bg-muted items-center justify-center rounded-lg"
      style={{ width: size, height: size }}
    >
      <Icon icon={School} size={size / 2} color="mutedForeground" />
    </View>
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
