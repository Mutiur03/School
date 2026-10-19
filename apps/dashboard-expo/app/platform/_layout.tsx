import { Redirect, Slot } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { PLATFORM_NAV } from '@/features/platform/nav';
import { NavProvider } from '@/navigation/nav-context';
import { RoleGate } from '@/navigation/RoleGate';
import { useTenant } from '@/tenant/TenantProvider';

/**
 * Platform (super-admin) app: its own shell and menu (sidebar on wide screens, bottom tabs on
 * phones). Only rendered in platform mode with a super_admin session; a school session that
 * opens /platform by URL is sent back to its own home (no platform client exists for it). The
 * server enforces super_admin + super-admin host on every call regardless.
 */
export default function PlatformLayout() {
  const { resolution } = useTenant();
  if (resolution.source !== 'platform') return <Redirect href="/" />;
  return (
    <RoleGate role="super_admin">
      <NavProvider value={PLATFORM_NAV}>
        <AppShell>
          <Slot />
        </AppShell>
      </NavProvider>
    </RoleGate>
  );
}
