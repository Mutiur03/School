/**
 * Billing (read-only), verified against server/src/modules/school/school.route.ts and
 * billing.controller.ts: GET /api/schools/billing, admin only, the current school's
 * subscription (school from host + token). Platform admins edit it elsewhere.
 */
import type { ApiClient } from './client';
import { isObj, num, parseError, str, strOrNull } from './parse';

export type SubscriptionStatus =
  'trialing' | 'active' | 'past_due' | 'suspended' | 'expired' | 'cancelled';
export type AccessState = 'active' | 'grace' | 'locked';

export type SubscriptionDateField =
  | 'trial_started_at'
  | 'trial_ends_at'
  | 'subscription_started_at'
  | 'current_period_started_at'
  | 'current_period_ends_at'
  | 'cancelled_at';

export interface Subscription {
  status: SubscriptionStatus;
  plan_name: string;
  access_state: AccessState;
  access_ends_at: string | null;
  grace_ends_at: string | null;
  days_remaining: number;
  grace_days_remaining: number;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
}

export const BILLING_PATHS = { current: '/api/schools/billing' } as const;

const STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'expired',
  'cancelled',
];
const ACCESS: readonly AccessState[] = ['active', 'grace', 'locked'];

export function parseSubscription(v: unknown): Subscription {
  if (!isObj(v)) throw parseError(BILLING_PATHS.current);
  const status = STATUSES.find((s) => s === v.status);
  if (!status) throw parseError(BILLING_PATHS.current);
  const access = ACCESS.find((a) => a === v.access_state) ?? 'locked';
  return {
    status,
    plan_name: str(v.plan_name, 'Annual plan'),
    access_state: access,
    access_ends_at: strOrNull(v.access_ends_at),
    grace_ends_at: strOrNull(v.grace_ends_at),
    days_remaining: num(v.days_remaining),
    grace_days_remaining: num(v.grace_days_remaining),
    trial_started_at: strOrNull(v.trial_started_at),
    trial_ends_at: strOrNull(v.trial_ends_at),
    subscription_started_at: strOrNull(v.subscription_started_at),
    current_period_started_at: strOrNull(v.current_period_started_at),
    current_period_ends_at: strOrNull(v.current_period_ends_at),
    cancelled_at: strOrNull(v.cancelled_at),
  };
}

export function createBillingApi(client: ApiClient) {
  return {
    async current(signal?: AbortSignal): Promise<Subscription> {
      return parseSubscription(await client.get<unknown>(BILLING_PATHS.current, { signal }));
    },
  };
}

export type BillingApi = ReturnType<typeof createBillingApi>;
