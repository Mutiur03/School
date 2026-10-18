/** Teacher / student home until their screens exist: who you are, where, and sign-out. */
import { View } from 'react-native';
import { AuthLayout, SchoolMark } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { LogOut, RefreshCw } from '@/components/ui/icons';
import { Text } from '@/components/ui/Text';
import { ROLE_LABEL } from '@/features/auth/login-form';
import type { AppRole } from '@/navigation/role-routes';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';

export function RolePlaceholder({ role }: { role: AppRole }) {
  const session = useSession();
  const { branding, resolution } = useTenant();
  const switchSchool = useSwitchSchool();
  const name = session.user?.name ?? session.user?.email ?? session.user?.login_id ?? 'there';
  return (
    <AuthLayout
      testID={`${role}-home`}
      title={`Hi, ${name}`}
      description={`${ROLE_LABEL[role]} · ${branding.displayName}`}
      header={<SchoolMark logoUrl={branding.logoUrl} size={48} />}
    >
      <View className="border-border bg-muted rounded-lg border p-3">
        <Text size="sm" color="mutedForeground">
          The {ROLE_LABEL[role].toLowerCase()} app is coming soon. You're signed in and your session
          is saved on this device.
        </Text>
      </View>
      {resolution.source === 'school-code' ? (
        <Button
          size="lg"
          variant="outline"
          icon={RefreshCw}
          label="Switch school"
          onPress={() => void switchSchool()}
        />
      ) : null}
      <Button
        size="lg"
        variant="destructive"
        icon={LogOut}
        label="Sign out"
        onPress={() => void session.signOut()}
      />
    </AuthLayout>
  );
}
