import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, CalendarDays, CircleDollarSign, Clock3, ShieldCheck } from 'lucide-react';
import {
  SUBSCRIPTION_DATE_FIELD_LABELS,
  SUBSCRIPTION_STATUS_FIELDS,
  type SubscriptionDateField,
} from '@school/shared-schemas';
import { SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
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

const accessDot: Record<SubscriptionDetails['access_state'], string> = {
  active: 'bg-emerald-500',
  grace: 'bg-amber-500',
  locked: 'bg-red-500',
};

const STATUS_SUMMARY: Record<SubscriptionDetails['status'], string> = {
  trialing: 'Free trial access â€” locks when the trial ends.',
  active: 'Annual plan Â· billed every 12 months',
  past_due: 'Payment overdue â€” grace access only until lock',
  suspended: 'Access suspended by the platform administrator',
  expired: 'Annual period has ended',
  cancelled: 'Subscription cancelled',
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{children}</dd>
  </div>
);

export default function Billing() {
  const {
    data: subscription,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['billing'],
    queryFn: async () =>
      (await axios.get<{ data: SubscriptionDetails }>('/api/schools/billing')).data.data,
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {subscription
            ? `${BILLING_STATUS_LABELS[subscription.status]} Â· ${subscription.plan_name} Â· ${accessLabel[subscription.access_state]}`
            : 'Your schoolâ€™s subscription status and access timeline.'}
        </p>
      </header>

      {isPending ? (
        <div className="animate-pulse space-y-6">
          <div className="bg-muted h-24 rounded-xl" />
          <div className="grid gap-5 md:grid-cols-2">
            <div className="bg-muted h-40 rounded-xl" />
            <div className="bg-muted h-40 rounded-xl" />
          </div>
        </div>
      ) : isError || !subscription ? (
        <SectionCard className="text-center">
          <AlertTriangle className="text-destructive mx-auto mb-3 h-8 w-8" />
          <p className="mb-4 text-sm">Billing details could not be loaded.</p>
          <Button type="button" onClick={() => refetch()}>
            Try again
          </Button>
        </SectionCard>
      ) : (
        <BillingContent subscription={subscription} />
      )}
    </div>
  );
}

function BillingContent({ subscription }: { subscription: SubscriptionDetails }) {
  const { status, access_state } = subscription;
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
      <section
        aria-label="Subscription status"
        className="border-border bg-card grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border px-5 py-4 shadow-sm sm:grid-cols-4"
      >
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Status</p>
          <span
            className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${BILLING_STATUS_CLASSES[status]}`}
          >
            {BILLING_STATUS_LABELS[status]}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${accessDot[access_state]}`} aria-hidden />
            Access
          </p>
          <p className="mt-0.5 text-xl font-semibold">{accessLabel[access_state]}</p>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">
            {access_state === 'grace' ? 'Grace days left' : 'Days remaining'}
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {access_state === 'locked'
              ? 'â€”'
              : access_state === 'grace'
                ? subscription.grace_days_remaining
                : subscription.days_remaining}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Access ends</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">
            {showAccessEnds ? formatBillingDate(subscription.access_ends_at) : 'â€”'}
          </p>
        </div>
        <p className="text-muted-foreground col-span-full text-sm">{STATUS_SUMMARY[status]}</p>
      </section>

      <div className={`grid grid-cols-1 gap-5 ${showPlanCard ? 'md:grid-cols-2' : ''}`}>
        {showPlanCard ? (
          <SectionCard title="Plan" icon={<CircleDollarSign size={20} />}>
            <dl className="space-y-4 text-sm">
              <Row label="Plan">{subscription.plan_name}</Row>
              <Row label="Billing cycle">Annual</Row>
              {showRenewal ? (
                <Row label="Renewal">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" /> Every 12 months
                  </span>
                </Row>
              ) : null}
            </dl>
          </SectionCard>
        ) : null}

        <SectionCard title="Dates" icon={<CalendarDays size={20} />}>
          <dl className="space-y-4 text-sm">
            {filteredRows.map((row) => (
              <Row key={row.label} label={row.label}>
                {formatBillingDate(row.value)}
              </Row>
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
