/**
 * Small floating status over a role's screens during launch:
 * - offline / slow start (session still unconfirmed): "Offline" with Retry;
 * - otherwise, while data restored from the device cache refetches: a subtle "Updating…".
 * Never blocks the screen underneath.
 */
import { useIsFetching, useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useApi, useSession } from '@/session/ApiProvider';
import { useRestoredFromCache } from '@/session/query-persistence';
import { TENANT_ROOT } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

/** A query that failed because the server could not be reached (not an HTTP error). */
const failedOffline = (q: Query) =>
  q.state.status === 'error' && isApiError(q.state.error) && q.state.error.isTransport;

/** True while some screen data of this school is failing for lack of a connection, until it loads again. */
function useMidSessionOffline(tenantKey: string) {
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const ours = (q: Query) => q.queryKey[0] === TENANT_ROOT && q.queryKey[1] === tenantKey;
    const compute = () =>
      setOffline(cache.findAll({ predicate: (q) => ours(q) && failedOffline(q) }).length > 0);
    let alive = true;
    // The cache notifies while other components render (useQuery builds a query), so never
    // set state inline: hand it to a microtask.
    const update = () =>
      queueMicrotask(() => {
        if (alive) compute();
      });
    compute();
    const unsubscribe = cache.subscribe(update);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [queryClient, tenantKey]);
  return {
    offline,
    retry: () =>
      void queryClient.refetchQueries({ predicate: (q) => failedOffline(q) }).catch(() => {}),
  };
}

export function SessionStatusBanner() {
  const insets = useSafeAreaInsets();
  const { session: manager } = useApi();
  const session = useSession();
  const { resolution } = useTenant();
  const restored = useRestoredFromCache();
  const fetching = useIsFetching({ queryKey: [TENANT_ROOT, resolution.tenantKey, 'private'] });

  const mid = useMidSessionOffline(resolution.tenantKey);
  const startupOffline = session.status === 'unknown' && session.startupError;
  const offline = startupOffline || (session.status === 'authenticated' && mid.offline);
  const updating = !offline && restored && fetching > 0;
  if (!offline && !updating) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center' }}
    >
      <View
        testID={offline ? 'session-offline-banner' : 'session-updating-banner'}
        accessibilityRole={offline ? 'alert' : undefined}
        className="border-border bg-background flex-row items-center gap-2 rounded-full border px-3 py-1 shadow-sm"
      >
        <Text size="xs" color={offline ? 'destructive' : 'mutedForeground'}>
          {offline ? "Offline — can't reach the server" : 'Updating…'}
        </Text>
        {offline ? (
          <Button
            size="sm"
            variant="ghost"
            label="Retry"
            onPress={() => (startupOffline ? void manager.bootstrap() : mid.retry())}
          />
        ) : null}
      </View>
    </View>
  );
}
