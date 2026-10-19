import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { STUDENT_NAV } from '@/features/student/nav';
import { NavProvider } from '@/navigation/nav-context';
import { RoleGate } from '@/navigation/RoleGate';

/** Student home: same shell as the dashboard (sidebar / bottom tabs) with the student menu. */
export default function StudentLayout() {
  return (
    <RoleGate role="student">
      <NavProvider value={STUDENT_NAV}>
        <AppShell>
          <Slot />
        </AppShell>
      </NavProvider>
    </RoleGate>
  );
}
