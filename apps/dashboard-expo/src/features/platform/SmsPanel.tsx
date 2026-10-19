/**
 * A school's SMS provider setup (SchoolManagement.tsx "SMS" tab): estimated balance, top-up
 * (shared account only) or Switch to Shared (self-hosted), Provider / Sender ID(s) / API key.
 * GET/PUT /api/schools/:id/sms-credentials, POST /api/schools/:id/sms-balance. Never sends an
 * SMS. Every write is confirmed and single-flight; only writable fields are sent.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow } from '@/components/ui/Field';
import { Save } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorMessage, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import type { SmsCredentials } from '@/lib/api';
import { usePlatformApi } from '@/session/ApiProvider';
import { PasswordInput } from './AdminsPanel';
import {
  SMS_PROVIDERS,
  SWITCH_TO_SHARED_PAYLOAD,
  parseBalanceAmount,
  smsCredentialsPayload,
} from './model';
import { usePlatformKey, type useConfirmGate } from './ui';

export function SmsPanel({
  schoolId,
  schoolName,
  confirm,
}: {
  schoolId: number;
  schoolName: string;
  confirm: ReturnType<typeof useConfirmGate>;
}) {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const queryClient = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: key('sms-credentials', schoolId),
    queryFn: ({ signal }) => platform.getSmsCredentials(schoolId, signal),
  });
  const [creds, setCreds] = useState<SmsCredentials | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const busy = confirm.gate.busy;

  useEffect(() => {
    if (q.data) {
      setCreds(q.data);
      setApiKey('');
    }
  }, [q.data]);

  const applySaved = (saved: SmsCredentials) => {
    queryClient.setQueryData(key('sms-credentials', schoolId), saved);
    setCreds(saved);
    setApiKey('');
    void queryClient.invalidateQueries({ queryKey: key('sms-overview') });
  };

  if (q.isLoading || !creds) {
    return q.isError ? (
      <ErrorMessage message="Failed to load SMS credentials." />
    ) : (
      <LoadingState label="Loading SMS credentials…" />
    );
  }

  const save = () => {
    const payload = smsCredentialsPayload(creds, apiKey);
    const switching = !creds.api_key_masked && !!payload.api_key;
    confirm.ask(
      {
        title: 'Save SMS credentials?',
        message: switching
          ? `${schoolName} moves fully onto its own provider account (own sender ID, provider and balance). The shared account is no longer used for it.`
          : payload.api_key
            ? `Replace ${schoolName}'s provider API key and settings.`
            : `Update ${schoolName}'s SMS provider settings.`,
        confirmLabel: 'Save SMS Credentials',
        tone: switching || payload.api_key ? 'destructive' : 'default',
      },
      async () => {
        try {
          applySaved(await platform.updateSmsCredentials(schoolId, payload));
          toast.success('SMS credentials updated');
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to save SMS credentials'));
        }
      },
    );
  };

  const switchToShared = () =>
    confirm.ask(
      {
        title: 'Switch to shared account?',
        message:
          'This clears the API key, so the school stops using its own provider account and goes back to the shared platform account (own sender ID/provider settings are left in place but unused).',
        confirmLabel: 'Switch to Shared',
        tone: 'destructive',
      },
      async () => {
        try {
          applySaved(await platform.updateSmsCredentials(schoolId, SWITCH_TO_SHARED_PAYLOAD));
          toast.success('Switched to the shared SMS account');
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to switch to shared account'));
        }
      },
    );

  const addBalance = () => {
    const n = parseBalanceAmount(amount);
    if (n === null) {
      setAmountError('Enter a valid amount');
      return;
    }
    setAmountError(null);
    confirm.ask(
      {
        title: 'Add SMS balance?',
        message: `Credit ${n.toLocaleString()} SMS to ${schoolName} from the shared platform account.`,
        confirmLabel: 'Add Balance',
        tone: 'default',
      },
      async () => {
        try {
          const balance = await platform.addSmsBalance(schoolId, n);
          const next = { ...creds, estimated_sms: balance ?? creds.estimated_sms };
          queryClient.setQueryData(key('sms-credentials', schoolId), next);
          setCreds(next);
          setAmount('');
          void queryClient.invalidateQueries({ queryKey: key('sms-overview') });
          toast.success('SMS balance updated');
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to add SMS balance'));
        }
      },
    );
  };

  return (
    <View className="gap-4" testID="platform-sms-panel">
      <Text size="xs" color="mutedForeground">
        Setting an API key switches this school fully onto its own provider account (own sender ID,
        own provider, own balance) — the platform default is never used as a fallback once a key is
        set. Clear the key to go back to the shared default account.
      </Text>
      <View className="border-border bg-muted/40 gap-1 rounded-xl border p-4">
        <Text size="sm" color="mutedForeground">
          Estimated SMS Remaining
        </Text>
        <Text size="2xl" weight="bold" tabular>
          {creds.estimated_sms ?? '...'}
        </Text>
        {creds.balance_message ? (
          <Text size="xs" color="mutedForeground">
            {creds.balance_message}
          </Text>
        ) : null}
        {creds.api_key_masked ? (
          <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
            <Text size="xs" color="mutedForeground">
              Self-hosted account — top up directly with the provider.
            </Text>
            <Button
              variant="outline"
              size="sm"
              label="Switch to Shared Account"
              disabled={busy}
              onPress={switchToShared}
            />
          </View>
        ) : (
          <View className="mt-3 gap-1">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^\d]/g, ''))}
                  placeholder="Amount"
                  keyboardType="number-pad"
                  accessibilityLabel="Amount"
                  editable={!busy}
                />
              </View>
              <Button
                variant="outline"
                label={busy ? 'Working…' : 'Add Balance'}
                disabled={busy || !amount}
                onPress={addBalance}
              />
            </View>
            {amountError ? <ErrorMessage message={amountError} /> : null}
          </View>
        )}
      </View>
      <FieldRow>
        <Field label="Provider">
          <Select
            label="Provider"
            value={creds.service_type ?? SMS_PROVIDERS[0].value}
            options={SMS_PROVIDERS}
            onChange={(service_type) => setCreds({ ...creds, service_type })}
          />
        </Field>
        <Field
          label="Sender ID(s)"
          hint="Comma-separated for multiple; one is picked at random per message."
        >
          <Input
            value={creds.sender_id}
            onChangeText={(sender_id) => setCreds({ ...creds, sender_id })}
            placeholder="e.g. 8809…, 8801…"
            autoCapitalize="none"
            accessibilityLabel="Sender ID(s)"
          />
        </Field>
        <Field
          label="API Key"
          hint={
            creds.api_key_masked
              ? `Currently set (${creds.api_key_masked}). Leave blank to keep it.`
              : 'No API key set yet.'
          }
        >
          <PasswordInput
            label="API key"
            value={apiKey}
            onChangeText={setApiKey}
            show={showKey}
            onToggle={() => setShowKey((v) => !v)}
            placeholder="Enter a new API key to replace it…"
          />
        </Field>
      </FieldRow>
      <View className="border-border flex-row justify-end border-t pt-4">
        <Button
          icon={Save}
          label={busy ? 'Saving…' : 'Save SMS Credentials'}
          disabled={busy || q.isFetching}
          onPress={save}
        />
      </View>
    </View>
  );
}
