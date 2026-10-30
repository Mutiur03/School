/**
 * Step 3: sign in at the chosen school. A role code locks the form to that role (no tabs); a
 * school-wide code offers every role. The server still decides the role at login.
 */
import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AuthLayout, FieldLabel, SchoolMark } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { LogIn } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { FormChain } from '@/components/ui/form-chain';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  buildLoginBody,
  LOGIN_FIELDS,
  loginErrorMessage,
  ROLE_LABEL,
  type LoginBody,
} from '@/features/auth/login-form';
import { effectiveLoginRole, lockedLoginRole, loginRoles } from '@/features/auth/role-lock';
import { cn } from '@/lib/utils';
import { appConfig } from '@/config/env';
import { requireDeploymentRole } from '@/navigation/deployment-lock';
import { homeForRole, PLATFORM_LOGIN, safeNext, type AppRole } from '@/navigation/role-routes';
import { useSchool } from '@/school/SchoolProvider';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useApi, useSession } from '@/session/ApiProvider';
import { SessionBoot } from '@/session/SessionBoot';
import { useTenant } from '@/tenant/TenantProvider';

export default function LoginScreen() {
  const { auth, session: manager } = useApi();
  const session = useSession();
  const { resolution, branding } = useTenant();
  const { selection } = useSchool();
  const switchSchool = useSwitchSchool();
  const router = useRouter();
  const { role: urlRole, next } = useLocalSearchParams<{ role?: string; next?: string }>();
  const locked = lockedLoginRole(selection, resolution, urlRole, appConfig.lockedRole);
  const [chosenRole, setRole] = useState<AppRole>(selection?.roleHint ?? 'admin');
  const role = effectiveLoginRole(locked, chosenRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async ({ role: r, body }: LoginBody) => {
      const payload =
        r === 'admin'
          ? await auth.loginAdmin(body)
          : r === 'teacher'
            ? await auth.loginTeacher(body)
            : await auth.loginStudent(body);
      // Checked before signIn, which is what persists the session.
      await manager.signIn(requireDeploymentRole(payload, appConfig.lockedRole));
    },
  });

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (resolution.source === 'platform') return <Redirect href={PLATFORM_LOGIN} />;
  if (session.status === 'authenticated') {
    const home = homeForRole(session.user?.role, resolution.source);
    if (home) {
      return <Redirect href={safeNext(next, session.user?.role, resolution.source) ?? home} />;
    }
  }
  if (session.status === 'unknown') {
    // Saved native session: go straight to the saved role's screens; the gate there confirms it.
    const home = session.provisional
      ? homeForRole(session.provisional.role, resolution.source)
      : null;
    if (home)
      return (
        <Redirect href={safeNext(next, session.provisional?.role, resolution.source) ?? home} />
      );
    return <SessionBoot />;
  }

  const field = LOGIN_FIELDS[role];
  const submit = () => {
    if (login.isPending) return;
    const built = buildLoginBody(role, identifier, password);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    login.mutate(built.value);
  };
  const error = formError ?? (login.isError ? loginErrorMessage(login.error) : null);

  return (
    <AuthLayout
      testID="login-screen"
      title="Sign in"
      description={branding.displayName}
      header={<SchoolMark logoUrl={branding.logoUrl} size={48} />}
      footer={
        resolution.source === 'school-code' ? (
          <Button
            testID="login-switch-school"
            variant="link"
            label={locked ? 'Not you? Use a different code' : 'Not your school? Switch school'}
            onPress={() => void switchSchool()}
          />
        ) : null
      }
    >
      {locked ? (
        // Same as the web login when the role is fixed: one filled pill, no tabs.
        <View
          testID="login-role-locked"
          accessibilityLabel={`Signing in as ${ROLE_LABEL[locked].toLowerCase()}`}
          className="border-border bg-muted flex-row items-center justify-center rounded-lg border p-1"
        >
          <View className="bg-primary rounded-md px-6 py-2">
            <Text
              size="sm"
              weight="semibold"
              color="primaryForeground"
              testID={`login-role-locked-${locked}`}
            >
              {ROLE_LABEL[locked]}
            </Text>
          </View>
        </View>
      ) : (
        <View
          accessibilityRole="tablist"
          className="bg-muted flex-row rounded-lg p-1"
          testID="login-role-tabs"
        >
          {loginRoles(null).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="tab"
              aria-selected={r === role}
              testID={`login-role-${r}`}
              onPress={() => {
                setRole(r);
                setIdentifier('');
                setFormError(null);
                login.reset();
              }}
              className={cn(
                'h-8 flex-1 items-center justify-center rounded-md',
                r === role && 'bg-background',
              )}
            >
              <Text size="sm" weight={r === role ? 'semibold' : 'medium'}>
                {ROLE_LABEL[r]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <FormChain onSubmit={submit}>
        <View className="gap-2">
          <FieldLabel nativeID="login-id-label">{field.label}</FieldLabel>
          <Input
            testID="login-identifier"
            accessibilityLabel={field.label}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={field.placeholder}
            keyboardType={field.keyboardType}
            autoComplete={field.autoComplete}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={role === 'student' ? 6 : 254}
          />
        </View>
        <View className="gap-2">
          <FieldLabel nativeID="login-password-label">Password</FieldLabel>
          <PasswordInput
            testID="login-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>
      </FormChain>
      {role !== 'admin' ? (
        <Button
          testID="login-forgot"
          variant="link"
          label="Forgot access details?"
          className="self-end"
          onPress={() =>
            router.push(
              `/forgot-password?role=${role}${identifier.trim() ? `&id=${encodeURIComponent(identifier.trim())}` : ''}` as Href,
            )
          }
        />
      ) : null}
      {error ? <ErrorMessage message={error} /> : null}
      <Button
        testID="login-submit"
        size="lg"
        icon={LogIn}
        label={login.isPending ? 'Signing in…' : `Sign in as ${ROLE_LABEL[role].toLowerCase()}`}
        disabled={login.isPending}
        onPress={submit}
      />
    </AuthLayout>
  );
}
