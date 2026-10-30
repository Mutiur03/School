/**
 * Port of dashboard/src/components/SubscriptionGate.tsx. Polls GET /api/school/subscription-access
 * every 60 s: locked → admin is sent to Billing (the only screen the server still serves), other
 * roles get a full-screen lock with Sign out; grace → a floating "N days left" card.
 * A failed check does not block (the server enforces the lock with 402 on every other call).
 */
import { useQuery } from '@tanstack/react-query';
import { Redirect, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { CreditCard, Lock, LogOut } from '@/components/ui/icons';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import type { AppRole } from './role-routes';

const BILLING = '/billing';

export function SubscriptionGate({ role, children }: { role: AppRole; children: ReactNode }) {
  const { billing, signOut } = useApi();
  const { resolution } = useTenant();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: access } = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'subscription-access'),
    queryFn: ({ signal }) => billing.access(signal),
    refetchInterval: 60_000,
    retry: 1,
  });

  if (access?.is_locked) {
    if (role === 'admin') {
      if (pathname !== BILLING) return <Redirect href={BILLING} />;
    } else {
      return (
        <View
          className="bg-background flex-1 items-center justify-center gap-3 p-6"
          testID="subscription-locked"
        >
          <Icon icon={Lock} size={40} color="destructive" />
          <Text size="xl" weight="bold" className="text-center">
            Subscription access locked
          </Text>
          <Text size="sm" color="mutedForeground" className="max-w-sm text-center">
            The annual subscription and its 10-day grace period have ended. Contact your school
            administrator to renew access.
          </Text>
          <Button variant="outline" icon={LogOut} label="Sign out" onPress={() => void signOut()} />
        </View>
      );
    }
  }

  const grace = access?.access_state === 'grace';
  return (
    <View style={{ flex: 1 }}>
      {children}
      {grace ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 72 }}
        >
          <View
            testID="subscription-grace"
            accessibilityRole="alert"
            className="max-w-sm gap-1 self-end rounded-xl border border-amber-300 bg-amber-50 p-4"
          >
            <Text size="sm" weight="semibold" className="text-amber-950">
              {access.status === 'past_due' ? 'Payment overdue' : 'Subscription grace period'}
            </Text>
            <Text size="sm" className="text-amber-950">
              {access.grace_days_remaining} day{access.grace_days_remaining === 1 ? '' : 's'} left
              before access locks.
            </Text>
            {role === 'admin' ? (
              <Button
                size="sm"
                variant="outline"
                icon={CreditCard}
                label="View billing"
                className="mt-1 self-start"
                onPress={() => router.push(BILLING)}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
