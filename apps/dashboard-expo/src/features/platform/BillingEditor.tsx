/**
 * A school's subscription, ported from dashboard/src/pages/SuperAdmin/SchoolBillingEditor.tsx:
 * access banner, Status (fills the dates that status needs), Plan, Annual price, Currency, the
 * status's date fields, internal notes, Reset / Save. Endpoints: GET/PUT /api/platform/schools/:id/billing.
 * Saving is confirmed (strong wording when it locks the school) and single-flight; the server
 * validates the same schema again.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Field, FieldRow } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { CalendarClock, RefreshCw, Save } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorMessage, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { BILLING_STATUS_LABELS, formatBillingDate } from '@/features/billing/model';
import { SUBSCRIPTION_STATUS_FIELDS } from '@school/shared-schemas';
import type { SubscriptionStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePlatformApi } from '@/session/ApiProvider';
import {
  BILLING_DATE_LABELS,
  END_DATE_FIELDS,
  accessSummary,
  applyStatusDefaults,
  billingConfirm,
  billingPayload,
  toBillingForm,
  updateBillingField,
  type BillingForm,
} from './model';
import { platformSchemas } from './schemas';
import { FadeSlideIn, usePlatformKey, type useConfirmGate } from './ui';

const STATUS_OPTIONS = (Object.keys(BILLING_STATUS_LABELS) as SubscriptionStatus[]).map((s) => ({
  value: s,
  label: BILLING_STATUS_LABELS[s],
}));

export function BillingEditor({
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
    queryKey: key('billing', schoolId),
    queryFn: ({ signal }) => platform.getBilling(schoolId, signal),
  });
  const [form, setForm] = useState<BillingForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setForm(toBillingForm(q.data));
  }, [q.data]);

  if (q.isLoading) return <LoadingState label="Loading billing details…" />;
  if (!form) {
    return (
      <View className="items-center gap-3 py-6">
        <Text size="sm" color="mutedForeground">
          Billing details are unavailable.
        </Text>
        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          label="Retry"
          onPress={() => void q.refetch()}
        />
      </View>
    );
  }

  const fields = SUBSCRIPTION_STATUS_FIELDS[form.status];
  const required = new Set(fields.required);
  const summary = accessSummary(form, (iso) => formatBillingDate(iso));
  const busy = confirm.gate.busy;

  const save = () => {
    const built = billingPayload(form, platformSchemas);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    const copy = billingConfirm(
      schoolName,
      q.data?.status ?? null,
      form.status,
      (s) => BILLING_STATUS_LABELS[s],
    );
    confirm.ask(copy, async () => {
      try {
        const saved = await platform.updateBilling(schoolId, built.value);
        queryClient.setQueryData(key('billing', schoolId), saved);
        setForm(toBillingForm(saved));
        void queryClient.invalidateQueries({ queryKey: key('schools') });
        toast.success('Billing details updated');
      } catch (e) {
        toast.error(mutationErrorMessage(e, 'Failed to update billing details'));
      }
    });
  };

  return (
    <View className="gap-6" testID="platform-billing">
      <View
        className={cn(
          'flex-row items-start gap-3 rounded-xl border p-4',
          summary.locksNow ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-indigo-50',
        )}
      >
        <Icon icon={CalendarClock} size={20} rawColor={summary.locksNow ? '#b91c1c' : '#312e81'} />
        <View className="min-w-0 flex-1 gap-1">
          <Text size="sm" className={summary.locksNow ? 'text-red-900' : 'text-indigo-950'}>
            <Text
              size="sm"
              weight="bold"
              className={summary.locksNow ? 'text-red-900' : 'text-indigo-950'}
            >
              {summary.headline}
            </Text>
            {summary.detail ? ` ${summary.detail}` : ''}
          </Text>
          <Text size="xs" className="text-indigo-950/80">
            Changing status fills the dates that status needs. Active auto-becomes past due when the
            period ends, then expired after the 10-day grace. Cancelled and suspended stay manual.
          </Text>
        </View>
      </View>

      <FieldRow>
        <Field label="Status">
          <Select
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(s) => setForm(applyStatusDefaults(form, s, platformSchemas))}
            testID="billing-status"
          />
        </Field>
        <Field label="Plan">
          <View className="border-control h-10 justify-center rounded-lg border bg-gray-50 px-3">
            <Text size="sm">Annual</Text>
          </View>
        </Field>
        <Field label="Annual price">
          <Input
            value={form.annual_price}
            placeholder="Not set"
            keyboardType="decimal-pad"
            accessibilityLabel="Annual price"
            onChangeText={(v) =>
              setForm(updateBillingField(form, 'annual_price', v.replace(/[^\d.]/g, '')))
            }
          />
        </Field>
        <Field label="Currency">
          <Input
            value={form.currency}
            maxLength={3}
            autoCapitalize="characters"
            accessibilityLabel="Currency"
            onChangeText={(v) => setForm(updateBillingField(form, 'currency', v.toUpperCase()))}
          />
        </Field>
        {fields.visible.map((f) => (
          <FadeSlideIn key={f}>
            <Field label={BILLING_DATE_LABELS[f]} required={required.has(f)}>
              <DateInput
                label={BILLING_DATE_LABELS[f]}
                value={form[f]}
                onChange={(v) => setForm(updateBillingField(form, f, v))}
              />
            </Field>
          </FadeSlideIn>
        ))}
      </FieldRow>
      {fields.visible.some((f) => END_DATE_FIELDS.has(f)) ? (
        <FadeSlideIn>
          <Text size="xs" color="mutedForeground">
            End dates include the full selected day. Period end must be on/after period start
            {form.status === 'expired'
              ? ', and before today for expired.'
              : form.status === 'past_due'
                ? ', and today or earlier for past due.'
                : '.'}
          </Text>
        </FadeSlideIn>
      ) : null}
      <Field label="Internal notes" hint="Visible only to superadmins.">
        <Input
          multiline
          rows={4}
          maxLength={2000}
          value={form.notes}
          accessibilityLabel="Internal notes"
          placeholder="Renewal terms, contact history, or manual payment notes…"
          onChangeText={(v) => setForm(updateBillingField(form, 'notes', v))}
        />
      </Field>
      {error ? (
        <FadeSlideIn>
          <ErrorMessage message={error} />
        </FadeSlideIn>
      ) : null}
      <View className="border-border flex-row justify-end gap-2 border-t pt-4">
        <Button
          variant="outline"
          icon={RefreshCw}
          label="Reset"
          disabled={busy}
          onPress={() => {
            setError(null);
            if (q.data) setForm(toBillingForm(q.data));
            void q.refetch();
          }}
        />
        <Button
          testID="billing-save"
          icon={Save}
          label={busy ? 'Saving…' : 'Save billing'}
          disabled={busy}
          onPress={save}
        />
      </View>
    </View>
  );
}
