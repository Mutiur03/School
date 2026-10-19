/**
 * Background marksheet generation progress, replicating dashboard/src/components/
 * MarksheetGenProgress.tsx: the full panel (Results page, while not complete) and the compact
 * one (published exam rows). Polls GET /api/marksheets/exams/:id/status the way the web does:
 * every 8 s while running, every 60 s while class bundles are stale, otherwise not at all.
 */
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import {
  formatBundleScope,
  genPanelView,
  marksheetPollMs,
  type MarksheetGenStatus,
} from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/lib/utils';

export function useMarksheetStatus(examId: number | undefined) {
  const { marks } = useApi();
  const { resolution } = useTenant();
  return useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'marksheet-gen-status', examId ?? 0),
    queryFn: ({ signal }) => marks.marksheetStatus(examId!, signal),
    enabled: !!examId,
    refetchInterval: (q) => marksheetPollMs(q.state.data),
  });
}

function Bar({ percent, complete, thin }: { percent: number; complete: boolean; thin?: boolean }) {
  return (
    <View className={cn('bg-muted w-full overflow-hidden rounded-full', thin ? 'h-1.5' : 'h-2')}>
      <View
        className={cn('h-full rounded-full', complete ? 'bg-green-500' : 'bg-primary')}
        style={{ width: `${percent}%` }}
      />
    </View>
  );
}

export function MarksheetGenPanel({
  status,
  compact = false,
  testID = 'marksheet-gen',
}: {
  status: MarksheetGenStatus | null | undefined;
  compact?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  if (!status || status.total === 0) return null;
  const v = genPanelView(status);

  if (compact) {
    return (
      <View className="mt-2 w-44 gap-0.5" testID={`${testID}-compact`}>
        <View className="flex-row justify-between">
          <Text size="xs" weight="medium" color="mutedForeground" className="text-[10px]">
            {v.compactTitle}
          </Text>
          <Text size="xs" color="mutedForeground" tabular className="text-[10px]">
            {v.count}
          </Text>
        </View>
        <Bar percent={v.percent} complete={v.complete} thin />
        {status.failed > 0 ? (
          <Text size="xs" color="destructive" className="text-[10px]">
            {status.failed} failed
          </Text>
        ) : null}
        {v.bundleProgress ? (
          <Text size="xs" color="mutedForeground" tabular className="text-[10px]">
            Bundles {status.bundles.done}/{status.bundles.total}
          </Text>
        ) : null}
        {v.stale.map((b) => (
          <Text key={`${b.class}-${b.section}`} size="xs" className="text-[10px] text-amber-600">
            • {formatBundleScope(b)}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View
      className="border-border bg-muted/30 gap-3 rounded-lg border p-4"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {!v.complete && v.active ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
          <View className="min-w-0 flex-1">
            <Text weight="medium">{v.title}</Text>
            {!v.complete && v.active ? (
              <Text size="xs" color="mutedForeground">
                Downloads wait for a fresh PDF — this may take a minute.
              </Text>
            ) : null}
          </View>
        </View>
        <Text weight="semibold" tabular>
          {v.count}
        </Text>
      </View>
      <Bar percent={v.percent} complete={v.complete} />
      {v.showBundles ? (
        <View className="gap-1">
          <View className="flex-row justify-between">
            <Text size="xs" color="mutedForeground">
              {v.bundleLabel}
            </Text>
            {v.bundleCount ? (
              <Text size="xs" color="mutedForeground" tabular>
                {v.bundleCount}
              </Text>
            ) : null}
          </View>
          {v.stale.map((b) => (
            <Text key={`${b.class}-${b.section}`} size="xs" className="text-amber-600">
              • {formatBundleScope(b)} — refreshes on download
            </Text>
          ))}
          {status.bundles.failed > 0 ? (
            <View className="gap-0.5">
              <Text size="xs" color="destructive">
                {plural(status.bundles.failed, 'bundle')} failed to generate
              </Text>
              {status.bundles.failedItems.map((b) => (
                <Text key={`fail-${b.class}-${b.section}`} size="xs" color="destructive">
                  • {formatBundleScope(b)}
                  {b.error ? ` — ${b.error}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {status.failed > 0 ? (
        <Text size="xs" color="destructive">
          {plural(status.failed, 'marksheet')} failed to generate
        </Text>
      ) : null}
    </View>
  );
}
