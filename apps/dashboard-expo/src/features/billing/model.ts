/**
 * Pure helpers for Billing (dashboard/src/pages/Admin/Billing.tsx + src/types/billing.ts). The
 * per-status visible date fields and their labels come from @school/shared-schemas
 * (SUBSCRIPTION_STATUS_FIELDS / SUBSCRIPTION_DATE_FIELD_LABELS) and are passed in.
 */
import type {
  AccessState,
  Subscription,
  SubscriptionDateField,
  SubscriptionStatus,
} from '@/lib/api';

export const BILLING_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Past due',
  suspended: 'Suspended',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const ACCESS_LABELS: Record<AccessState, string> = {
  active: 'Access open',
  grace: '10-day grace period',
  locked: 'Access locked',
};

export const STATUS_SUMMARY: Record<SubscriptionStatus, string> = {
  trialing: 'Free trial access — locks when the trial ends.',
  active: 'Annual plan · billed every 12 months',
  past_due: 'Payment overdue — grace access only until lock',
  suspended: 'Access suspended by the platform administrator',
  expired: 'Annual period has ended',
  cancelled: 'Subscription cancelled',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "4 Oct 2026" (en-GB day month year), "Not set" when missing. */
export function formatBillingDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const t = Date.parse(value);
  if (Number.isNaN(t)) return 'Not set';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function billingView(
  s: Subscription,
  visibleFor: Record<SubscriptionStatus, { visible: readonly SubscriptionDateField[] }>,
  labels: Record<SubscriptionDateField, string>,
) {
  const visible = visibleFor[s.status].visible;
  const showAccessEnds = s.status !== 'suspended' && s.status !== 'cancelled';
  const rows: { label: string; value: string | null }[] = [
    ...(showAccessEnds ? [{ label: 'Access ends', value: s.access_ends_at }] : []),
    ...visible.map((f) => ({ label: labels[f], value: s[f] })),
    ...(s.grace_ends_at ? [{ label: 'Grace period ends', value: s.grace_ends_at }] : []),
  ];
  const endKey: SubscriptionDateField =
    s.status === 'trialing' ? 'trial_ends_at' : 'current_period_ends_at';
  const dates =
    showAccessEnds && s.access_ends_at && visible.includes(endKey) && s[endKey] === s.access_ends_at
      ? rows.filter((r) => r.label !== 'Access ends')
      : rows;
  return {
    dates,
    showPlan: s.status !== 'trialing' && s.status !== 'cancelled',
    showRenewal: s.status === 'active' || s.status === 'past_due',
    showAccessEnds,
    daysLabel: s.access_state === 'grace' ? 'Grace days left' : 'Days remaining',
    days:
      s.access_state === 'locked'
        ? '—'
        : String(s.access_state === 'grace' ? s.grace_days_remaining : s.days_remaining),
    subtitle: `${BILLING_STATUS_LABELS[s.status]} · ${s.plan_name} · ${ACCESS_LABELS[s.access_state]}`,
  };
}
