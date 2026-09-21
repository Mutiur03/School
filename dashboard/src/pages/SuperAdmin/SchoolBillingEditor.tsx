import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CalendarClock, Loader2, RefreshCw, Save } from 'lucide-react';
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_FIELDS,
  subscriptionDateInputBounds,
  updateSubscriptionSchema,
  type SubscriptionDateField,
  type SubscriptionStatus,
} from '@school/shared-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BILLING_STATUS_CLASSES,
  BILLING_STATUS_LABELS,
  dateInputValue,
  formatBillingDate,
  type SubscriptionDetails,
} from '@/types/billing';

type BillingForm = {
  status: SubscriptionStatus;
  annual_price: string;
  currency: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_started_at: string;
  current_period_started_at: string;
  current_period_ends_at: string;
  cancelled_at: string;
  notes: string;
};

const DATE_FIELD_LABELS: Record<SubscriptionDateField, string> = {
  trial_started_at: 'Trial starts',
  trial_ends_at: 'Trial ends',
  subscription_started_at: 'Subscription starts',
  current_period_started_at: 'Current annual period starts',
  current_period_ends_at: 'Current annual period ends',
  cancelled_at: 'Cancelled on',
};

const END_DATE_FIELDS = new Set<SubscriptionDateField>([
  'trial_ends_at',
  'current_period_ends_at',
]);

const todayInput = () => dateInputValue(new Date().toISOString());

const shiftDateInput = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const shiftYearInput = (value: string, years: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
};

/** Fill / clear dates that belong to the newly selected status. */
const DATE_FIELDS: SubscriptionDateField[] = [
  'trial_started_at',
  'trial_ends_at',
  'subscription_started_at',
  'current_period_started_at',
  'current_period_ends_at',
  'cancelled_at',
];

const applyStatusDefaults = (form: BillingForm, status: SubscriptionStatus): BillingForm => {
  const today = todayInput();
  const visible = new Set(SUBSCRIPTION_STATUS_FIELDS[status].visible);
  const next: BillingForm = { ...form, status };

  // Clear date fields that don't belong to the new status.
  for (const field of DATE_FIELDS) {
    if (!visible.has(field)) next[field] = '';
  }

  switch (status) {
    case 'trialing':
      next.trial_started_at = form.trial_started_at || today;
      next.trial_ends_at = form.trial_ends_at || shiftDateInput(today, 30);
      break;
    case 'active':
      next.subscription_started_at = form.subscription_started_at || today;
      next.current_period_started_at = form.current_period_started_at || today;
      next.current_period_ends_at = form.current_period_ends_at || shiftYearInput(today, 1);
      break;
    case 'past_due':
      next.subscription_started_at =
        form.subscription_started_at || form.current_period_started_at || today;
      next.current_period_started_at =
        form.current_period_started_at || form.subscription_started_at || today;
      next.current_period_ends_at = form.current_period_ends_at || today;
      break;
    case 'suspended':
      break;
    case 'expired':
      next.subscription_started_at =
        form.subscription_started_at || form.current_period_started_at || today;
      next.current_period_started_at =
        form.current_period_started_at || form.subscription_started_at || today;
      next.current_period_ends_at =
        form.current_period_ends_at && form.current_period_ends_at < today
          ? form.current_period_ends_at
          : shiftDateInput(today, -1);
      break;
    case 'cancelled':
      next.cancelled_at = form.cancelled_at || today;
      break;
  }

  return next;
};

const toForm = (value: SubscriptionDetails): BillingForm => ({
  status: value.status,
  annual_price: value.annual_price == null ? '' : String(value.annual_price),
  currency: value.currency,
  trial_started_at: dateInputValue(value.trial_started_at),
  trial_ends_at: dateInputValue(value.trial_ends_at),
  subscription_started_at: dateInputValue(value.subscription_started_at),
  current_period_started_at: dateInputValue(value.current_period_started_at),
  current_period_ends_at: dateInputValue(value.current_period_ends_at),
  cancelled_at: dateInputValue(value.cancelled_at),
  notes: value.notes ?? '',
});

const isoDate = (value: string, endOfDay = false) =>
  value ? new Date(`${value}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`).toISOString() : null;

export default function SchoolBillingEditor({ schoolId }: { schoolId: number }) {
  const [form, setForm] = useState<BillingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<{ data: SubscriptionDetails }>(
        `/api/schools/${schoolId}/billing`,
      );
      setForm(toForm(response.data.data));
    } catch (error) {
      console.error('Failed to load billing details', error);
      toast.error('Failed to load billing details');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof BillingForm>(key: K, value: BillingForm[K]) =>
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (!DATE_FIELDS.includes(key as SubscriptionDateField)) return next;

      // Keep paired ranges valid when one side moves.
      if (
        key === 'trial_started_at' &&
        next.trial_ends_at &&
        next.trial_started_at &&
        next.trial_ends_at < next.trial_started_at
      ) {
        next.trial_ends_at = next.trial_started_at;
      }
      if (
        key === 'trial_ends_at' &&
        next.trial_started_at &&
        next.trial_ends_at &&
        next.trial_ends_at < next.trial_started_at
      ) {
        next.trial_started_at = next.trial_ends_at;
      }
      if (
        key === 'subscription_started_at' &&
        next.current_period_started_at &&
        next.subscription_started_at &&
        next.current_period_started_at < next.subscription_started_at
      ) {
        next.current_period_started_at = next.subscription_started_at;
      }
      if (
        (key === 'current_period_started_at' || key === 'subscription_started_at') &&
        next.current_period_ends_at
      ) {
        const floor = next.current_period_started_at || next.subscription_started_at;
        if (floor && next.current_period_ends_at < floor) {
          next.current_period_ends_at = floor;
        }
      }
      if (
        key === 'current_period_ends_at' &&
        next.current_period_started_at &&
        next.current_period_ends_at &&
        next.current_period_ends_at < next.current_period_started_at
      ) {
        next.current_period_started_at = next.current_period_ends_at;
      }
      return next;
    });

  const onStatusChange = (status: SubscriptionStatus) => {
    setForm((current) => (current ? applyStatusDefaults(current, status) : current));
  };

  const save = async () => {
    if (!form) return;

    const payload = {
      status: form.status,
      annual_price: form.annual_price === '' ? null : Number(form.annual_price),
      currency: form.currency,
      trial_started_at: isoDate(form.trial_started_at),
      trial_ends_at: isoDate(form.trial_ends_at, true),
      subscription_started_at: isoDate(form.subscription_started_at),
      current_period_started_at: isoDate(form.current_period_started_at),
      current_period_ends_at: isoDate(form.current_period_ends_at, true),
      cancelled_at: isoDate(form.cancelled_at),
      notes: form.notes || null,
    };

    const parsed = updateSubscriptionSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Fix the billing dates before saving');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.put<{ data: SubscriptionDetails }>(
        `/api/schools/${schoolId}/billing`,
        parsed.data,
      );
      setForm(toForm(response.data.data));
      toast.success('Billing details updated');
    } catch (error) {
      console.error('Failed to update billing details', error);
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to update billing details'
          : 'Failed to update billing details',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading billing details…
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-muted-foreground text-sm">Billing details are unavailable.</p>
        <Button type="button" variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  const statusFields = SUBSCRIPTION_STATUS_FIELDS[form.status];
  const requiredSet = new Set(statusFields.required);
  const accessEndValue =
    form.status === 'trialing'
      ? form.trial_ends_at
      : form.current_period_ends_at || form.trial_ends_at;
  const calculatedGraceEnd = accessEndValue
    ? new Date(
        new Date(`${accessEndValue}T23:59:59.999Z`).getTime() + 10 * 86_400_000,
      ).toISOString()
    : null;
  const immediateLock = form.status === 'suspended' || form.status === 'cancelled';
  const trialNoGrace = form.status === 'trialing';
  const isPastDue = form.status === 'past_due';
  const isActive = form.status === 'active';
  const graceEligible = isActive || isPastDue;

  return (
    <div className="space-y-6" role="tabpanel" id="panel-billing" aria-labelledby="tab-billing">
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p>
            <strong>
              {immediateLock
                ? 'Locks access immediately.'
                : trialNoGrace
                  ? `Trial locks on ${formatBillingDate(accessEndValue ? `${accessEndValue}T23:59:59.999Z` : null)}.`
                  : graceEligible
                    ? `Access locks on ${formatBillingDate(calculatedGraceEnd)}.`
                    : `Access ends ${formatBillingDate(accessEndValue ? `${accessEndValue}T23:59:59.999Z` : null)}.`}
            </strong>{' '}
            {isActive
              ? 'After period end → past due (10-day grace) → expired.'
              : isPastDue
                ? 'Grace only — never full active access.'
                : form.status === 'expired'
                  ? 'Grace is over.'
                  : trialNoGrace
                    ? 'No grace on trial.'
                    : null}
          </p>
          <details className="text-xs opacity-90">
            <summary className="cursor-pointer font-medium">How access works</summary>
            <p className="mt-1 leading-5">
              Changing status fills the dates that status needs. Active auto-becomes past due when
              the period ends, then expired after the 10-day grace. Cancelled and suspended stay
              manual.
            </p>
          </details>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="billing-status">Status</Label>
          <select
            id="billing-status"
            value={form.status}
            onChange={(event) => onStatusChange(event.target.value as SubscriptionStatus)}
            className={`ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 ${BILLING_STATUS_CLASSES[form.status]}`}
          >
            {SUBSCRIPTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {BILLING_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Plan</Label>
          <p className="border-input bg-muted/40 text-foreground flex h-10 items-center rounded-md border px-3 text-sm">
            Annual
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-price">Annual price</Label>
          <Input
            id="billing-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Not set"
            value={form.annual_price}
            onChange={(event) => update('annual_price', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-currency">Currency</Label>
          <Input
            id="billing-currency"
            maxLength={3}
            value={form.currency}
            onChange={(event) => update('currency', event.target.value.toUpperCase())}
          />
        </div>
        {statusFields.visible.map((key) => {
          const required = requiredSet.has(key);
          const endDate = END_DATE_FIELDS.has(key);
          const bounds = subscriptionDateInputBounds(form.status, form, key);
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={`billing-${key}`}>
                {DATE_FIELD_LABELS[key]}
                {required ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Input
                id={`billing-${key}`}
                type="date"
                required={required}
                min={bounds.min}
                max={bounds.max}
                value={form[key]}
                onChange={(event) => update(key, event.target.value)}
                aria-describedby={endDate ? 'billing-period-help' : undefined}
              />
            </div>
          );
        })}
      </div>
      {statusFields.visible.some((field) => END_DATE_FIELDS.has(field)) ? (
        <p id="billing-period-help" className="text-muted-foreground text-xs">
          End dates include the full selected day. Period end must be on/after period start
          {form.status === 'expired'
            ? ', and before today for expired.'
            : form.status === 'past_due'
              ? ', and today or earlier for past due.'
              : '.'}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="billing-notes">Internal notes</Label>
        <Textarea
          id="billing-notes"
          rows={4}
          maxLength={2000}
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          placeholder="Renewal terms, contact history, or manual payment notes…"
        />
        <p className="text-muted-foreground text-xs">Visible only to superadmins.</p>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={load} disabled={saving}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save billing
        </Button>
      </div>
    </div>
  );
}
