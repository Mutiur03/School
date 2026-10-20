/**
 * Small floating status over a role's screens during launch:
 * - offline / slow start (session still unconfirmed): "Offline" with Retry;
 * - otherwise, while data restored from the device cache refetches: a subtle "Updating…".
 * Never blocks the screen underneath.
 */
import { useIsFetching } from '@tanstack/react-query';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useApi, useSession } from '@/session/ApiProvider';
import { useRestoredFromCache } from '@/session/query-persistence';
import { TENANT_ROOT } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

export function SessionStatusBanner() {
  const insets = useSafeAreaInsets();
  const { session: manager } = useApi();
  const session = useSession();
  const { resolution } = useTenant();
  const restored = useRestoredFromCache();
  const fetching = useIsFetching({ queryKey: [TENANT_ROOT, resolution.tenantKey, 'private'] });

  const offline = session.status === 'unknown' && session.startupError;
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
            onPress={() => void manager.bootstrap()}
          />
        ) : null}
      </View>
    </View>
  );
}
