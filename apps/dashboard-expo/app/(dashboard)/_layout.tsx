import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGate } from '@/navigation/RoleGate';

/** The dashboard is the admin app; other roles are redirected to their own home. */
export default function DashboardLayout() {
  return (
    <RoleGate role="admin">
      <AppShell>
        <Slot />
      </AppShell>
    </RoleGate>
  );
}
