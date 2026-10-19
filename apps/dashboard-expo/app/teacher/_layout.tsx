import { Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { TEACHER_NAV } from '@/features/teacher/nav';
import { NavProvider } from '@/navigation/nav-context';
import { RoleGate } from '@/navigation/RoleGate';

/**
 * Teacher app: the dashboard shell (sidebar / bottom tabs, account menu with Switch school and
 * Sign out) with the web's teacher menu. Every screen relies on the server's own teacher checks.
 */
export default function TeacherLayout() {
  return (
    <RoleGate role="teacher">
      <NavProvider value={TEACHER_NAV}>
        <AppShell>
          <Slot />
        </AppShell>
      </NavProvider>
    </RoleGate>
  );
}
