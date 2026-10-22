import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { STUDENT_NAV } from '@/features/student/nav';
import { NavProvider } from '@/navigation/nav-context';
import { RoleGate } from '@/navigation/RoleGate';
import { SubscriptionGate } from '@/navigation/SubscriptionGate';

/** Student home: same shell as the dashboard (sidebar / bottom tabs) with the student menu. */
export default function StudentLayout() {
  return (
    <RoleGate role="student">
      <NavProvider value={STUDENT_NAV}>
        <SubscriptionGate role="student">
          <AppShell>
            <Slot />
          </AppShell>
        </SubscriptionGate>
      </NavProvider>
    </RoleGate>
  );
}
