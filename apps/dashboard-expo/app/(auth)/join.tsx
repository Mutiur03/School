/**
 * Step 1: enter (or scan) the school code your school gave you. The platform access code (shown
 * to super admins on the web overview and in the app's user menu) goes through the same box and
 * scanner and opens super-admin sign-in. It does not sign anyone in. There is no platform link on
 * this screen.
 */
import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { AuthLayout, FieldLabel } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { ScanLine } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { lookupErrorMessage, resolveCodeLookup, submittableCode } from '@/features/join/join-form';
import { formatCodeInput } from '@/lib/api';
import { PLATFORM_LOGIN } from '@/navigation/role-routes';
import { useSchool } from '@/school/SchoolProvider';
import { useEnterPlatform } from '@/school/useEnterPlatform';
import { useTenant } from '@/tenant/TenantProvider';

export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; auto?: string }>();
  const { codes, setPending, selection, platformAvailable } = useSchool();
  const { resolution } = useTenant();
  const enterPlatform = useEnterPlatform();
  const [value, setValue] = useState(() => formatCodeInput(params.code ?? ''));
  const autoSubmitted = useRef(false);

  const lookup = useMutation({
    mutationFn: async (code: string) =>
      resolveCodeLookup(await codes.lookup(code), platformAvailable),
    // Awaited by react-query, so the button stays "Checking…" until platform sign-in opens.
    onSuccess: async (outcome) => {
      if (outcome.kind === 'platform') return enterPlatform();
      setPending(outcome.lookup);
      router.push('/confirm');
    },
  });

  const code = submittableCode(value);
  const submit = () => {
    if (code && !lookup.isPending) lookup.mutate(code);
  };

  // Coming back from the scanner (or a deep link) with ?code=...&auto=1.
  useEffect(() => {
    if (params.auto === '1' && code && !autoSubmitted.current) {
      autoSubmitted.current = true;
      lookup.mutate(code);
    }
  }, [params.auto, code, lookup]);

  if (resolution.source === 'platform') return <Redirect href={PLATFORM_LOGIN} />;
  // Host fixed by the build or the page (or a dev override): codes do not apply.
  if (resolution.source !== 'unresolved' && resolution.source !== 'school-code') {
    return <Redirect href="/login" />;
  }

  return (
    <AuthLayout
      testID="join-screen"
      title="Find your school"
      description="Enter the school code from your school office, or scan its QR code."
      footer={
        <View className="items-center gap-1">
          {selection ? (
            <Button
              variant="link"
              label={`Back to ${selection.name}`}
              onPress={() => router.replace('/login')}
            />
          ) : null}
        </View>
      }
    >
      <View className="gap-2">
        <FieldLabel nativeID="school-code-label">School code</FieldLabel>
        <Input
          testID="school-code-input"
          accessibilityLabelledBy="school-code-label"
          accessibilityLabel="School code"
          value={value}
          onChangeText={(text) => {
            setValue(formatCodeInput(text));
            if (lookup.isError) lookup.reset();
          }}
          placeholder="ABC-7K4Q"
          maxLength={8}
          invalid={lookup.isError}
          returnKeyType="go"
          onSubmitEditing={submit}
          variant="code"
        />
        <Text size="xs" color="mutedForeground">
          7 letters and numbers, like ABC-7K4Q.
        </Text>
      </View>
      {lookup.isError ? <ErrorMessage message={lookupErrorMessage(lookup.error)} /> : null}
      <Button
        testID="school-code-submit"
        size="lg"
        label={lookup.isPending ? 'Checking…' : 'Continue'}
        disabled={!code || lookup.isPending}
        onPress={submit}
      />
      {Platform.OS !== 'web' ? (
        <Button
          testID="school-code-scan"
          size="lg"
          variant="outline"
          icon={ScanLine}
          label="Scan QR code"
          onPress={() => router.push('/scan')}
        />
      ) : null}
    </AuthLayout>
  );
}
