import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGate } from '@/navigation/RoleGate';
import { SubscriptionGate } from '@/navigation/SubscriptionGate';

/** The dashboard is the admin app; other roles are redirected to their own home. */
export default function DashboardLayout() {
  return (
    <RoleGate role="admin">
      <SubscriptionGate role="admin">
        <SubscriptionGate role="admin">
          <AppShell>
            <Slot />
          </AppShell>
        </SubscriptionGate>
      </SubscriptionGate>
    </RoleGate>
  );
}
