import type { SubscriptionStatus } from '@school/shared-schemas';

export interface SubscriptionDetails {
  id: number;
  school_id: number;
  status: SubscriptionStatus;
  plan_name: string;
  billing_interval: 'annual';
  annual_price: string | number | null;
  currency: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  status_changed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  access_ends_at: string | null;
  grace_ends_at: string | null;
  grace_period_days: number;
  access_state: 'active' | 'grace' | 'locked';
  is_locked: boolean;
  days_remaining: number;
  grace_days_remaining: number;
  school: {
    id: number;
    name: string;
    shortName: string | null;
    logo: string | null;
  };
}

export type SubscriptionAccess = Pick<
  SubscriptionDetails,
  | 'status'
  | 'access_state'
  | 'is_locked'
  | 'access_ends_at'
  | 'grace_ends_at'
  | 'grace_period_days'
  | 'days_remaining'
  | 'grace_days_remaining'
>;

export const BILLING_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Past due',
  suspended: 'Suspended',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/** Border/bg/text classes for subscription status surfaces. */
export const BILLING_STATUS_CLASSES: Record<SubscriptionStatus, string> = {
  trialing:
    'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
  active:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  past_due:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  suspended:
    'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100',
  expired:
    'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
  cancelled:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
};

export const formatBillingDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Not set';

export const dateInputValue = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';
