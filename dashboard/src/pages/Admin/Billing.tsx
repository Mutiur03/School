import { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays, CircleDollarSign, Clock3, Loader2, ShieldCheck } from 'lucide-react';
import {
  SUBSCRIPTION_DATE_FIELD_LABELS,
  SUBSCRIPTION_STATUS_FIELDS,
  type SubscriptionDateField,
} from '@school/shared-schemas';
import { PageHeader, SectionCard } from '@/components';
import {
  BILLING_STATUS_CLASSES,
  BILLING_STATUS_LABELS,
  formatBillingDate,
  type SubscriptionDetails,
} from '@/types/billing';

const accessLabel: Record<SubscriptionDetails['access_state'], string> = {
  active: 'Access open',
  grace: '10-day grace period',
  locked: 'Access locked',
};

const accessBadgeClass: Record<SubscriptionDetails['access_state'], string> = {
  active: 'border-current/25 bg-white/55 dark:bg-black/15',
  grace: 'border-amber-300/60 bg-amber-100/70 dark:bg-amber-950/40',
  locked: 'border-red-300/60 bg-red-100/70 dark:bg-red-950/40',
};

const STATUS_SUMMARY: Record<SubscriptionDetails['status'], string> = {
  trialing: 'Free trial access — locks when the trial ends.',
  active: 'Annual plan · billed every 12 months',
  past_due: 'Payment overdue — grace access only until lock',
  suspended: 'Access suspended by the platform administrator',
  expired: 'Annual period has ended',
  cancelled: 'Subscription cancelled',
};

export default function Billing() {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios
      .get<{ data: SubscriptionDetails }>('/api/schools/billing')
      .then((response) => {
        if (active) setSubscription(response.data.data);
      })
      .catch(() => {
        if (active) setError('Billing details could not be loaded. Refresh the page to try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Billing"
        description="View your school’s subscription status and access timeline."
      />

      {loading ? (
        <div className="text-muted-foreground flex min-h-64 items-center justify-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading billing details…
        </div>
      ) : error || !subscription ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          {error || 'Billing details are unavailable.'}
        </div>
      ) : (
        <BillingContent subscription={subscription} />
      )}
    </div>
  );
}

function BillingContent({ subscription }: { subscription: SubscriptionDetails }) {
  const { status } = subscription;
  const visibleFields = SUBSCRIPTION_STATUS_FIELDS[status].visible;
  const showPlanCard = status !== 'trialing' && status !== 'cancelled';
  const showRenewal = status === 'active' || status === 'past_due';
  const showGrace = Boolean(subscription.grace_ends_at);
  const showAccessEnds = status !== 'suspended' && status !== 'cancelled';

  const dateRows: { label: string; value: string | null }[] = [
    ...(showAccessEnds ? [{ label: 'Access ends', value: subscription.access_ends_at }] : []),
    ...visibleFields.map((field: SubscriptionDateField) => ({
      label: SUBSCRIPTION_DATE_FIELD_LABELS[field],
      value: subscription[field],
    })),
    ...(showGrace ? [{ label: 'Grace period ends', value: subscription.grace_ends_at }] : []),
  ];

  // Avoid duplicating access ends when it matches the status end date already listed.
  const accessEndKey =
    status === 'trialing' ? 'trial_ends_at' : ('current_period_ends_at' as const);
  const filteredRows =
    showAccessEnds &&
    subscription.access_ends_at &&
    visibleFields.includes(accessEndKey) &&
    subscription[accessEndKey] === subscription.access_ends_at
      ? dateRows.filter((row) => row.label !== 'Access ends')
      : dateRows;

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-6 ${BILLING_STATUS_CLASSES[status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest">Subscription status</p>
            <h2 className="mt-2 text-3xl font-bold">{BILLING_STATUS_LABELS[status]}</h2>
            <p className="mt-2 text-sm opacity-80">{STATUS_SUMMARY[status]}</p>
            <span
              className={`mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${accessBadgeClass[subscription.access_state]}`}
            >
              {accessLabel[subscription.access_state]}
            </span>
          </div>
          {subscription.access_state !== 'locked' && (
            <div className="border-current/20 rounded-xl border bg-white/55 px-4 py-3 text-right dark:bg-black/10">
              <p className="text-3xl font-bold tabular-nums">
                {subscription.access_state === 'grace'
                  ? subscription.grace_days_remaining
                  : subscription.days_remaining}
              </p>
              <p className="text-xs font-medium uppercase">
                {subscription.access_state === 'grace' ? 'grace days left' : 'days remaining'}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className={`grid grid-cols-1 gap-5 ${showPlanCard ? 'md:grid-cols-2' : ''}`}>
        {showPlanCard ? (
          <SectionCard title="Plan" icon={<CircleDollarSign size={20} />}>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{subscription.plan_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Billing cycle</dt>
                <dd className="font-medium">Annual</dd>
              </div>
              {showRenewal ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Renewal</dt>
                  <dd className="flex items-center gap-1.5 font-medium">
                    <Clock3 className="h-4 w-4" /> Every 12 months
                  </dd>
                </div>
              ) : null}
            </dl>
          </SectionCard>
        ) : null}

        <SectionCard title="Dates" icon={<CalendarDays size={20} />}>
          <dl className="space-y-4 text-sm">
            {filteredRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{formatBillingDate(row.value)}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Help" icon={<ShieldCheck size={20} />}>
        <p className="text-muted-foreground text-sm">
          Subscription dates and status are managed by the platform administrator. Contact them if
          any detail needs updating.
        </p>
      </SectionCard>
    </div>
  );
}
