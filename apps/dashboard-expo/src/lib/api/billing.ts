/**
 * Billing (read-only), server/src/nest/modules/school/school.controller.ts:
 * GET /api/school/billing, admin only, the current school's
 * subscription (school from host + token). Platform admins edit it elsewhere.
 */
import type { ApiClient } from './client';
import { isApiError } from './errors';
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

/** GET /api/school/subscription-access: any tenant role; the server also answers 402 with this body when locked. */
export interface SubscriptionAccess {
  status: SubscriptionStatus;
  access_state: AccessState;
  is_locked: boolean;
  grace_days_remaining: number;
}

export const BILLING_PATHS = {
  current: '/api/school/billing',
  access: '/api/school/subscription-access',
} as const;

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

export function parseAccess(v: unknown): SubscriptionAccess {
  if (!isObj(v)) throw parseError(BILLING_PATHS.access);
  const state = ACCESS.find((a) => a === v.access_state) ?? 'locked';
  return {
    status: STATUSES.find((s) => s === v.status) ?? 'expired',
    access_state: state,
    is_locked: v.is_locked === true || state === 'locked',
    grace_days_remaining: num(v.grace_days_remaining),
  };
}

export function createBillingApi(client: ApiClient) {
  return {
    /** A 402 that carries the access payload still means "locked", not "failed". */
    async access(signal?: AbortSignal): Promise<SubscriptionAccess> {
      try {
        return parseAccess(await client.get<unknown>(BILLING_PATHS.access, { signal }));
      } catch (e) {
        if (isApiError(e) && e.isSubscriptionLocked && e.data) return parseAccess(e.data);
        throw e;
      }
    },

    async current(signal?: AbortSignal): Promise<Subscription> {
      return parseSubscription(await client.get<unknown>(BILLING_PATHS.current, { signal }));
    },
  };
}

export type BillingApi = ReturnType<typeof createBillingApi>;
