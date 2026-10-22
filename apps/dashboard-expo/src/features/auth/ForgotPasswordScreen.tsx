/**
 * Forgot access details, for teachers (email) and students (login ID):
 *   1 Account  → send a 6-digit code
 *   2 Code     → six boxes, checked automatically on the last digit, resend after a cooldown
 *   3 Password → new password with show/hide, strength meter and a live "matches" check
 * then a success screen with a Sign in button. Every step can go back, keeps what was typed,
 * guards double taps, and explains failures in place (wrong code, expired code, rate limit,
 * offline). The identifier can arrive prefilled from the sign-in screen (`?id=`).
 */
import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AuthLayout, FieldLabel, SchoolMark } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormChain } from '@/components/ui/form-chain';
import { Icon } from '@/components/ui/Icon';
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import type { ResetRole, ResetStep } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';
import {
  buildResetBody,
  checkIdentifier,
  cleanCode,
  FLOW_STEPS,
  isCodeRejected,
  maskIdentifier,
  MIN_NEW_PASSWORD,
  passwordProblem,
  passwordScore,
  RESEND_SECONDS,
  RESET_IDENTIFIER,
  resendLabel,
  resetErrorMessage,
  SCORE_LABEL,
  secondsLeft,
  stepNumber,
  type FlowStep,
} from './password-reset';

const TITLE: Record<FlowStep, string> = {
  request: 'Reset your password',
  code: 'Enter the code',
  password: 'Choose a new password',
  done: 'Password updated',
};

function Progress({ step }: { step: FlowStep }) {
  const n = stepNumber(step);
  return (
    <View className="gap-1.5" accessibilityLabel={`Step ${n} of ${FLOW_STEPS.length}`}>
      <View className="flex-row gap-1.5">
        {FLOW_STEPS.map((s, i) => (
          <View
            key={s}
            className={cn('h-1.5 flex-1 rounded-full', i < n ? 'bg-primary' : 'bg-muted')}
          />
        ))}
      </View>
      <Text size="xs" color="mutedForeground">
        {`Step ${n} of ${FLOW_STEPS.length}`}
      </Text>
    </View>
  );
}

const METER = ['bg-muted', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'] as const;

function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  if (!password) return null;
  return (
    <View className="gap-1" testID="strength-meter">
      <View className="flex-row gap-1">
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className={cn('h-1.5 flex-1 rounded-full', i <= score ? METER[score] : 'bg-muted')}
          />
        ))}
      </View>
      <Text size="xs" color="mutedForeground">
        {score === 0
          ? `Use at least ${MIN_NEW_PASSWORD} characters`
          : `Strength: ${SCORE_LABEL[score]}`}
      </Text>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const { auth } = useApi();
  const router = useRouter();
  const { resolution, branding } = useTenant();
  const { role: roleParam, id: idParam } = useLocalSearchParams<{ role?: string; id?: string }>();
  const role: ResetRole | null =
    roleParam === 'teacher' || roleParam === 'student' ? roleParam : null;

  const [step, setStep] = useState<FlowStep>('request');
  const [identifier, setIdentifier] = useState(typeof idParam === 'string' ? idParam : '');
  const [code, setCode] = useState('');
  const [codeKey, setCodeKey] = useState(0); // remounts the code boxes to refocus after an error
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [codeDead, setCodeDead] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false); // synchronous double-tap guard

  const call = useMutation({
    mutationFn: ({ at, body }: { at: ResetStep; body: Record<string, string> }) =>
      auth.passwordReset(role!, at, body),
  });

  // Tick once a second while the resend cooldown can still be running.
  useEffect(() => {
    if (step !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  if (resolution.source === 'unresolved') return <Redirect href="/join" />;
  if (!role) return <Redirect href="/login" />;
  const field = RESET_IDENTIFIER[role];
  const left = secondsLeft(resendAt, now);
  const working = call.isPending;

  const run = async (
    at: ResetStep,
    form: { identifier: string; code: string; newPassword: string; confirm: string },
  ) => {
    if (busy.current) return null;
    const built = buildResetBody(role, at, form);
    if (!built.ok) {
      setError(built.error);
      return null;
    }
    busy.current = true;
    setError(null);
    try {
      return { data: await call.mutateAsync({ at, body: built.body }) };
    } catch (e) {
      return { error: e };
    } finally {
      busy.current = false;
    }
  };
  const form = { identifier, code, newPassword: password, confirm };

  const sendCode = async (resend = false) => {
    const r = await run('request', form);
    if (!r) return;
    if ('error' in r) {
      setError(resetErrorMessage(r.error));
      // A rate limit also means "wait": start the cooldown so the button explains itself.
      if (step === 'code') setResendAt(Date.now() + RESEND_SECONDS * 1000);
      return;
    }
    const id = checkIdentifier(role, identifier);
    if (id.ok) setIdentifier(id.value);
    setCode('');
    setCodeKey((k) => k + 1);
    setCodeDead(false);
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
    setNotice(resend ? 'A new code is on its way.' : (r.data?.message ?? null));
    setStep('code');
  };

  const checkCode = async (value: string) => {
    const r = await run('check-code', { ...form, code: value });
    if (!r) return;
    if ('error' in r) {
      setError(
        isCodeRejected(r.error)
          ? `${resetErrorMessage(r.error)} Check the digits or request a new code.`
          : resetErrorMessage(r.error),
      );
      setCode('');
      setCodeKey((k) => k + 1);
      return;
    }
    setNotice(null);
    setStep('password');
  };

  const savePassword = async () => {
    const r = await run('verify', form);
    if (!r) return;
    if ('error' in r) {
      if (isCodeRejected(r.error)) setCodeDead(true);
      setError(resetErrorMessage(r.error));
      return;
    }
    setPassword('');
    setConfirm('');
    setStep('done');
  };

  const startOver = () => {
    setError(null);
    setNotice(null);
    setCode('');
    setPassword('');
    setConfirm('');
    setCodeDead(false);
    setStep('request');
  };

  const pwProblem = passwordProblem(password, confirm);
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <AuthLayout
      testID="forgot-password-screen"
      title={TITLE[step]}
      description={step === 'done' ? undefined : branding.displayName}
      header={
        <View className="gap-4">
          <SchoolMark logoUrl={branding.logoUrl} size={48} />
          {step !== 'done' ? <Progress step={step} /> : null}
        </View>
      }
      footer={
        <Button
          variant="link"
          label="Back to sign in"
          onPress={() => router.replace('/login')}
          testID="reset-back-to-login"
        />
      }
    >
      {step === 'request' ? (
        <FormChain onSubmit={() => void sendCode()}>
          <Text size="sm" color="mutedForeground">
            {`${field.hint} We will send a 6-digit code to reset your password.`}
          </Text>
          <View className="gap-2">
            <FieldLabel nativeID="reset-id-label">{field.label}</FieldLabel>
            <Input
              testID="reset-identifier"
              accessibilityLabel={field.label}
              value={identifier}
              onChangeText={(v) => {
                setIdentifier(role === 'student' ? v.replace(/\D/g, '').slice(0, 6) : v);
                setError(null);
              }}
              placeholder={field.placeholder}
              kind={role === 'student' ? 'number' : 'email'}
              autoFocus
              maxLength={role === 'student' ? 6 : 254}
            />
          </View>
          {error ? <ErrorMessage message={error} /> : null}
          <Button
            testID="reset-send"
            size="lg"
            icon={Mail}
            label={working ? 'Sending…' : 'Send code'}
            disabled={working}
            onPress={() => void sendCode()}
          />
        </FormChain>
      ) : null}

      {step === 'code' ? (
        <View className="gap-4">
          <Text size="sm" color="mutedForeground">
            {`We sent a 6-digit code for ${maskIdentifier(role, identifier)}. It is checked automatically when you enter the last digit.`}
          </Text>
          {notice ? (
            <Text size="sm" weight="medium" testID="reset-notice">
              {notice}
            </Text>
          ) : null}
          <OtpInput
            key={codeKey}
            testID="reset-code"
            value={code}
            onChange={(v) => {
              setCode(cleanCode(v));
              if (error) setError(null);
            }}
            onComplete={(v) => void checkCode(v)}
            disabled={working}
            invalid={!!error}
            autoFocus
          />
          {working ? (
            <Text size="sm" color="mutedForeground" testID="reset-checking">
              Checking the code…
            </Text>
          ) : null}
          {error ? <ErrorMessage message={error} /> : null}
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              label={resendLabel(left)}
              disabled={left > 0 || working}
              onPress={() => void sendCode(true)}
              testID="reset-resend"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              label={`Change ${field.label.toLowerCase()}`}
              disabled={working}
              onPress={startOver}
              testID="reset-change"
            />
          </View>
        </View>
      ) : null}

      {step === 'password' ? (
        <FormChain onSubmit={() => void savePassword()}>
          <View className="flex-row items-center gap-2" testID="reset-verified">
            <Icon icon={CheckCircle2} size={16} color="primary" />
            <Text size="sm" color="mutedForeground">
              Code verified. Choose a new password.
            </Text>
          </View>
          <View className="gap-2">
            <FieldLabel nativeID="reset-new-label">New password</FieldLabel>
            <PasswordInput
              kind="new-password"
              testID="reset-new-password"
              label="New password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              shown={showPw}
              onToggleShown={() => setShowPw((s) => !s)}
              autoCapitalize="none"
              autoFocus
            />
            <StrengthMeter password={password} />
          </View>
          <View className="gap-2">
            <FieldLabel nativeID="reset-confirm-label">Confirm password</FieldLabel>
            <PasswordInput
              kind="new-password"
              testID="reset-confirm-password"
              label="Confirm password"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                setError(null);
              }}
              shown={showPw}
              onToggleShown={() => setShowPw((s) => !s)}
              autoCapitalize="none"
            />
            {mismatch ? (
              <Text size="xs" color="destructive" testID="reset-mismatch">
                The two passwords do not match.
              </Text>
            ) : confirm.length > 0 ? (
              <Text size="xs" color="mutedForeground">
                Passwords match.
              </Text>
            ) : null}
          </View>
          {error ? <ErrorMessage message={error} /> : null}
          {codeDead ? (
            <Button
              variant="outline"
              label="Request a new code"
              onPress={startOver}
              testID="reset-new-code"
            />
          ) : null}
          <Button
            testID="reset-submit"
            size="lg"
            icon={KeyRound}
            label={working ? 'Saving…' : 'Reset password'}
            disabled={working || pwProblem !== null}
            onPress={() => void savePassword()}
          />
        </FormChain>
      ) : null}

      {step === 'done' ? (
        <View className="items-center gap-4 py-2" testID="reset-done">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Icon icon={CheckCircle2} size={28} rawColor="#059669" />
          </View>
          <Text size="sm" color="mutedForeground" className="text-center">
            Your password was changed. Sign in with your new password.
          </Text>
          <Button
            testID="reset-sign-in"
            size="lg"
            label="Sign in"
            className="self-stretch"
            onPress={() => router.replace('/login')}
          />
        </View>
      ) : null}
    </AuthLayout>
  );
}
