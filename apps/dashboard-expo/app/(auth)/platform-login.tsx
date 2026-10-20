/**
 * Platform (super-admin) sign-in, opened by the platform access code (typed or scanned)
 * on the school-code screen. Same card as the web login with the role locked to Super Admin: email + password
 * (dashboard/src/pages/Common/Login.tsx). No school code; it talks to the build's super-admin
 * origin only.
 */
import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthLayout, FieldLabel } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LogIn, ShieldCheck } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { FormChain } from '@/components/ui/form-chain';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  buildSuperAdminLoginBody,
  platformLoginErrorMessage,
  requirePlatformSession,
} from '@/features/platform/auth';
import { platformSchemas } from '@/features/platform/schemas';
import { homeForRole, safeNext } from '@/navigation/role-routes';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useApi, useSession } from '@/session/ApiProvider';
import { SessionBoot } from '@/session/SessionBoot';
import { useTenant } from '@/tenant/TenantProvider';

export default function PlatformLoginScreen() {
  const { auth, session: manager } = useApi();
  const session = useSession();
  const { resolution } = useTenant();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const switchSchool = useSwitchSchool();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      // Checked before signIn, which is what persists the refresh token.
      await manager.signIn(requirePlatformSession(await auth.loginSuperAdmin(body)));
    },
  });

  if (resolution.source !== 'platform') {
    return <Redirect href={resolution.source === 'unresolved' ? '/join' : '/login'} />;
  }
  if (session.status === 'authenticated') {
    const home = homeForRole(session.user?.role, resolution.source);
    if (home) {
      return <Redirect href={safeNext(next, session.user?.role, resolution.source) ?? home} />;
    }
  }
  if (session.status === 'unknown') return <SessionBoot />;

  const submit = () => {
    if (login.isPending) return;
    const built = buildSuperAdminLoginBody(email, password, platformSchemas);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    login.mutate(built.value);
  };
  const error = formError ?? (login.isError ? platformLoginErrorMessage(login.error) : null);

  return (
    <AuthLayout
      testID="platform-login-screen"
      title="Sign in"
      description="Platform administration"
      header={
        <View className="bg-primary/10 h-12 w-12 items-center justify-center rounded-xl">
          <Icon icon={ShieldCheck} size={24} color="primary" />
        </View>
      }
      footer={
        <Button
          testID="platform-login-use-code"
          variant="link"
          label="Use a school code instead"
          disabled={login.isPending}
          onPress={() => void switchSchool()}
        />
      }
    >
      <View
        testID="platform-login-role"
        accessibilityLabel="Signing in as super admin"
        className="border-border bg-muted flex-row items-center justify-center rounded-lg border p-1"
      >
        <View className="bg-primary rounded-md px-6 py-2">
          <Text size="sm" weight="semibold" color="primaryForeground">
            Super Admin
          </Text>
        </View>
      </View>
      <FormChain onSubmit={submit}>
        <View className="gap-2">
          <FieldLabel nativeID="platform-email-label">Email</FieldLabel>
          <Input
            testID="platform-login-email"
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="e.g., superadmin@example.com…"
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
          />
        </View>
        <View className="gap-2">
          <FieldLabel nativeID="platform-password-label">Password</FieldLabel>
          <PasswordInput
            testID="platform-login-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>
      </FormChain>
      {error ? <ErrorMessage message={error} /> : null}
      <Button
        testID="platform-login-submit"
        size="lg"
        icon={LogIn}
        label={login.isPending ? 'Signing in…' : 'Sign in as super admin'}
        disabled={login.isPending}
        onPress={submit}
      />
    </AuthLayout>
  );
}
