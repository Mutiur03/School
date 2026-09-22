export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 10;
const DAY_MS = 86_400_000;

/**
 * Lifecycle on dates:
 * active → past_due when period ends → expired when grace ends.
 * Cancelled / suspended stay manual.
 */
export function effectiveSubscriptionStatus(
  subscription: {
    status: string;
    current_period_ends_at: Date | null;
  },
  now = new Date(),
): string {
  const { status, current_period_ends_at: periodEnd } = subscription;
  if ((status !== 'active' && status !== 'past_due') || !periodEnd) return status;

  if (status === 'active' && now <= periodEnd) return 'active';

  const graceEndsAt = new Date(periodEnd.getTime() + SUBSCRIPTION_GRACE_PERIOD_DAYS * DAY_MS);
  if (now <= graceEndsAt) return 'past_due';
  return 'expired';
}

export function calculateSubscriptionAccess(
  subscription: {
    status: string;
    trial_ends_at: Date | null;
    current_period_ends_at: Date | null;
  },
  now = new Date(),
) {
  const status = effectiveSubscriptionStatus(subscription, now);

  const accessEndsAt =
    status === 'trialing'
      ? subscription.trial_ends_at
      : (subscription.current_period_ends_at ?? subscription.trial_ends_at);

  const immediatelyLocked = status === 'suspended' || status === 'cancelled';

  // Active: full access until period end.
  // Past due (incl. auto after period end): grace only, then lock / expired.
  // Trial / expired / etc.: no grace window.
  const graceEligible = status === 'active' || status === 'past_due';
  const graceEndsAt =
    graceEligible && accessEndsAt
      ? new Date(accessEndsAt.getTime() + SUBSCRIPTION_GRACE_PERIOD_DAYS * DAY_MS)
      : null;

  let accessState: 'active' | 'grace' | 'locked';
  if (immediatelyLocked || !accessEndsAt) {
    accessState = 'locked';
  } else if (status === 'past_due') {
    accessState = graceEndsAt && now <= graceEndsAt ? 'grace' : 'locked';
  } else if (now <= accessEndsAt) {
    accessState = 'active';
  } else if (graceEndsAt && now <= graceEndsAt) {
    accessState = 'grace';
  } else {
    accessState = 'locked';
  }

  const daysRemaining =
    accessState === 'active' && accessEndsAt
      ? Math.max(0, Math.ceil((accessEndsAt.getTime() - now.getTime()) / DAY_MS))
      : 0;
  const graceDaysRemaining =
    accessState === 'grace' && graceEndsAt
      ? Math.max(0, Math.ceil((graceEndsAt.getTime() - now.getTime()) / DAY_MS))
      : 0;

  return {
    status,
    access_state: accessState,
    is_locked: accessState === 'locked',
    access_ends_at: accessEndsAt,
    grace_ends_at: graceEndsAt,
    grace_period_days: graceEligible ? SUBSCRIPTION_GRACE_PERIOD_DAYS : 0,
    days_remaining: daysRemaining,
    grace_days_remaining: graceDaysRemaining,
  };
}

// ponytail: tiny assert check — run: server/node_modules/.bin/tsx server/src/modules/billing/subscription-access.ts
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/subscription-access.ts')) {
  const now = new Date('2026-09-21T12:00:00.000Z');
  const trial = calculateSubscriptionAccess(
    {
      status: 'trialing',
      trial_ends_at: new Date('2026-09-10T23:59:59.999Z'),
      current_period_ends_at: null,
    },
    now,
  );
  const activeOk = calculateSubscriptionAccess(
    {
      status: 'active',
      trial_ends_at: null,
      current_period_ends_at: new Date('2026-12-01T23:59:59.999Z'),
    },
    now,
  );
  const activeGrace = calculateSubscriptionAccess(
    {
      status: 'active',
      trial_ends_at: null,
      current_period_ends_at: new Date('2026-09-15T23:59:59.999Z'),
    },
    now,
  );
  const activeExpired = calculateSubscriptionAccess(
    {
      status: 'active',
      trial_ends_at: null,
      current_period_ends_at: new Date('2026-08-01T23:59:59.999Z'),
    },
    now,
  );
  // Same end date as "still in period today" — past_due must be grace, not active.
  const pastDueToday = calculateSubscriptionAccess(
    {
      status: 'past_due',
      trial_ends_at: null,
      current_period_ends_at: new Date('2026-09-21T23:59:59.999Z'),
    },
    now,
  );
  const pastDueExpired = calculateSubscriptionAccess(
    {
      status: 'past_due',
      trial_ends_at: null,
      current_period_ends_at: new Date('2026-08-01T23:59:59.999Z'),
    },
    now,
  );

  console.assert(
    trial.access_state === 'locked' && trial.grace_ends_at === null,
    'trial: no grace',
  );
  console.assert(
    activeOk.access_state === 'active' && activeOk.status === 'active',
    'active: full access',
  );
  console.assert(
    activeGrace.status === 'past_due' && activeGrace.access_state === 'grace',
    'active past period: auto past_due + grace',
  );
  console.assert(
    activeExpired.status === 'expired' && activeExpired.access_state === 'locked',
    'active past grace: auto expired + locked',
  );
  console.assert(
    pastDueToday.access_state === 'grace' && pastDueToday.days_remaining === 0,
    'past_due: grace only, never active',
  );
  console.assert(
    pastDueExpired.status === 'expired' && pastDueExpired.access_state === 'locked',
    'past_due after grace: auto expired + locked',
  );
  console.log('subscription-access self-check ok');
}
