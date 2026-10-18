/** Step 3: sign in at the chosen school, for the role the code hinted (switchable). */
import { useMutation } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AuthLayout, FieldLabel, SchoolMark } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { LogIn } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { ErrorMessage, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  buildLoginBody,
  LOGIN_FIELDS,
  loginErrorMessage,
  ROLE_LABEL,
  type LoginBody,
} from '@/features/auth/login-form';
import { cn } from '@/lib/utils';
import { homeForRole, type AppRole } from '@/navigation/role-routes';
import { useSchool } from '@/school/SchoolProvider';
import { useSwitchSchool } from '@/school/useSwitchSchool';
import { useApi, useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';

const ROLES: AppRole[] = ['admin', 'teacher', 'student'];

export default function LoginScreen() {
  const { auth, session: manager } = useApi();
  const session = useSession();
  const { resolution, branding } = useTenant();
  const { selection } = useSchool();
  const switchSchool = useSwitchSchool();
  const [role, setRole] = useState<AppRole>(selection?.roleHint ?? 'admin');
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
      await manager.signIn(payload);
    },
  });

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (session.status === 'authenticated') {
    const home = homeForRole(session.user?.role);
    if (home) return <Redirect href={home} />;
  }
  if (session.status === 'unknown') return <LoadingState label="Checking session…" />;

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
            label="Not your school? Switch school"
            onPress={() => void switchSchool()}
          />
        ) : null
      }
    >
      <View
        accessibilityRole="tablist"
        className="bg-muted flex-row rounded-lg p-1"
        testID="login-role-tabs"
      >
        {ROLES.map((r) => (
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
          returnKeyType="next"
          className="h-10"
        />
      </View>
      <View className="gap-2">
        <FieldLabel nativeID="login-password-label">Password</FieldLabel>
        <Input
          testID="login-password"
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={submit}
          className="h-10"
        />
      </View>
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
