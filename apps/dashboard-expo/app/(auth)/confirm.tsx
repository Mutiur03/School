/** Step 2: "You're joining X" — confirm before the app switches tenant. */
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthLayout, SchoolMark } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { appConfig } from '@/config/env';
import { ROLE_LABEL } from '@/features/auth/login-form';
import { useSchool } from '@/school/SchoolProvider';
import { resolveFileUrl } from '@/tenant/branding';
import { useTenant } from '@/tenant/TenantProvider';

export default function ConfirmSchoolScreen() {
  const router = useRouter();
  const { pending, setPending, confirmPending } = useSchool();
  const { resolution } = useTenant();
  const [confirmedHost, setConfirmedHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Navigate only once the providers have re-keyed to the confirmed school.
  if (confirmedHost && resolution.host === confirmedHost) return <Redirect href="/login" />;
  if (!pending) return <Redirect href="/join" />;
  const busy = confirmedHost !== null;
  const { school, tenant, roleHint } = pending;

  return (
    <AuthLayout
      testID="confirm-screen"
      title={`You're joining ${school.name}`}
      description={
        roleHint
          ? `This code is for ${ROLE_LABEL[roleHint].toLowerCase()} sign-in.`
          : 'Check this is your school before you sign in.'
      }
      header={<SchoolMark logoUrl={resolveFileUrl(school.logo, appConfig.cdnUrl)} />}
    >
      <View className="border-border bg-muted gap-1 rounded-lg border p-3">
        <Text size="sm" weight="medium" testID="confirm-school-name">
          {school.name}
        </Text>
        <Text size="xs" color="mutedForeground" testID="confirm-school-host">
          {tenant.host}
        </Text>
      </View>
      {error ? <ErrorMessage message={error} /> : null}
      <Button
        testID="confirm-school"
        size="lg"
        label={busy ? 'Saving…' : 'Continue'}
        disabled={busy}
        onPress={async () => {
          setError(null);
          setConfirmedHost(tenant.host);
          try {
            await confirmPending();
          } catch {
            setError("Couldn't save the school on this device. Try again.");
            setConfirmedHost(null);
          }
        }}
      />
      <Button
        variant="outline"
        size="lg"
        label="Not your school? Enter another code"
        onPress={() => {
          setPending(null);
          router.replace('/join');
        }}
      />
    </AuthLayout>
  );
}
