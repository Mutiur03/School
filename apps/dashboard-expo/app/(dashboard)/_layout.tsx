import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout() {
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
