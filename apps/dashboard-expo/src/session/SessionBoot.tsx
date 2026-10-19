/**
 * What a guarded screen shows while the session is `unknown`: the full-screen BootScreen with the
 * school's branding, and Retry / Switch school once startup failed or is slow.
 */
import { BootScreen } from '@/components/layout/BootScreen';
import { appConfig } from '@/config/env';
import { useSchool } from '@/school/SchoolProvider';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useApi, useSession } from '@/session/ApiProvider';
import { DEFAULT_DISPLAY_NAME, resolveFileUrl } from '@/tenant/branding';
import { useTenant } from '@/tenant/TenantProvider';

export function SessionBoot({ label = 'Checking your session…' }: { label?: string }) {
  const { session: manager } = useApi();
  const session = useSession();
  const { branding, resolution } = useTenant();
  const { selection } = useSchool();
  const switchSchool = useSwitchSchool();
  // Branding may still be loading: fall back to what the school-code lookup saved.
  const name =
    branding.displayName !== DEFAULT_DISPLAY_NAME
      ? branding.displayName
      : (selection?.name ?? DEFAULT_DISPLAY_NAME);
  const logoUrl = branding.logoUrl ?? resolveFileUrl(selection?.logo, appConfig.cdnUrl);
  return (
    <BootScreen
      testID="session-boot"
      name={name}
      logoUrl={logoUrl}
      label={label}
      error={session.startupError}
      onRetry={() => void manager.bootstrap()}
      onSwitchSchool={
        resolution.source === 'school-code' || resolution.source === 'platform'
          ? () => void switchSchool()
          : undefined
      }
      switchLabel={resolution.source === 'platform' ? 'Use a school code' : undefined}
    />
  );
}
