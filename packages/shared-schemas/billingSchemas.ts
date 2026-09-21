import { z } from 'zod';

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'expired',
  'cancelled',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionDateField =
  | 'trial_started_at'
  | 'trial_ends_at'
  | 'subscription_started_at'
  | 'current_period_started_at'
  | 'current_period_ends_at'
  | 'cancelled_at';

/** Which date fields to show / require for each status. */
export const SUBSCRIPTION_STATUS_FIELDS: Record<
  SubscriptionStatus,
  { required: SubscriptionDateField[]; visible: SubscriptionDateField[] }
> = {
  trialing: {
    required: ['trial_started_at', 'trial_ends_at'],
    visible: ['trial_started_at', 'trial_ends_at'],
  },
  active: {
    required: ['subscription_started_at', 'current_period_started_at', 'current_period_ends_at'],
    visible: ['subscription_started_at', 'current_period_started_at', 'current_period_ends_at'],
  },
  past_due: {
    required: ['current_period_started_at', 'current_period_ends_at'],
    visible: ['subscription_started_at', 'current_period_started_at', 'current_period_ends_at'],
  },
  suspended: {
    required: [],
    visible: ['current_period_started_at', 'current_period_ends_at'],
  },
  expired: {
    required: ['current_period_ends_at'],
    visible: ['subscription_started_at', 'current_period_started_at', 'current_period_ends_at'],
  },
  cancelled: {
    required: ['cancelled_at'],
    visible: ['cancelled_at', 'current_period_ends_at'],
  },
};

export const SUBSCRIPTION_DATE_FIELD_LABELS: Record<SubscriptionDateField, string> = {
  trial_started_at: 'Trial start',
  trial_ends_at: 'Trial end',
  subscription_started_at: 'Subscription start',
  current_period_started_at: 'Current period start',
  current_period_ends_at: 'Current period end',
  cancelled_at: 'Cancelled on',
};

/** Absolute calendar bounds for billing date inputs (YYYY-MM-DD). */
export const SUBSCRIPTION_DATE_MIN = '2000-01-01';

export function subscriptionDateMax(now = new Date()): string {
  const max = new Date(Date.UTC(now.getUTCFullYear() + 30, now.getUTCMonth(), now.getUTCDate()));
  return max.toISOString().slice(0, 10);
}

export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

const utcDay = (value: Date) =>
  Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());

const isValidDate = (value: Date | null | undefined): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const nullableDate = z
  .preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.date().nullable(),
  )
  .refine((value) => value === null || !Number.isNaN(value.getTime()), {
    message: 'Invalid date',
  });

type DateValues = Partial<Record<SubscriptionDateField, string | Date | null | undefined>>;

/** HTML min/max for a date field given the other selected dates. */
export function subscriptionDateInputBounds(
  status: SubscriptionStatus,
  values: DateValues,
  field: SubscriptionDateField,
  now = new Date(),
): { min: string; max: string } {
  const absoluteMax = subscriptionDateMax(now);
  const today = toDateInputValue(now);
  const yesterday = toDateInputValue(new Date(utcDay(now) - 86_400_000));

  const asInput = (key: SubscriptionDateField) => toDateInputValue(values[key] ?? null);

  let min = SUBSCRIPTION_DATE_MIN;
  let max = absoluteMax;

  switch (field) {
    case 'trial_started_at': {
      const end = asInput('trial_ends_at');
      if (end && end < max) max = end;
      break;
    }
    case 'trial_ends_at': {
      const start = asInput('trial_started_at');
      if (start && start > min) min = start;
      break;
    }
    case 'subscription_started_at': {
      const periodStart = asInput('current_period_started_at');
      if (periodStart && periodStart < max) max = periodStart;
      break;
    }
    case 'current_period_started_at': {
      const subStart = asInput('subscription_started_at');
      const periodEnd = asInput('current_period_ends_at');
      if (subStart && subStart > min) min = subStart;
      if (periodEnd && periodEnd < max) max = periodEnd;
      break;
    }
    case 'current_period_ends_at': {
      const periodStart = asInput('current_period_started_at');
      const subStart = asInput('subscription_started_at');
      const floor = periodStart || subStart;
      if (floor && floor > min) min = floor;
      if (status === 'expired' && yesterday < max) max = yesterday;
      if (status === 'past_due' && today < max) max = today;
      break;
    }
    case 'cancelled_at': {
      if (today < max) max = today;
      const periodEnd = asInput('current_period_ends_at');
      // Cancel can land on/before period end; still allow earlier cancels.
      if (periodEnd && periodEnd < max) {
        // keep today as max; period end only informs UI help, not a hard cancel max
      }
      break;
    }
  }

  if (min > max) min = max;
  return { min, max };
}

export const updateSubscriptionSchema = z
  .object({
    status: z.enum(SUBSCRIPTION_STATUSES),
    annual_price: z.coerce.number().min(0).max(9999999999.99).nullable().optional(),
    currency: z.string().trim().toUpperCase().length(3),
    trial_started_at: nullableDate,
    trial_ends_at: nullableDate,
    subscription_started_at: nullableDate,
    current_period_started_at: nullableDate,
    current_period_ends_at: nullableDate,
    cancelled_at: nullableDate,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const absoluteMin = new Date(`${SUBSCRIPTION_DATE_MIN}T00:00:00.000Z`);
    const absoluteMax = new Date(`${subscriptionDateMax()}T23:59:59.999Z`);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    for (const field of SUBSCRIPTION_STATUS_FIELDS[value.status].required) {
      if (!value[field]) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${SUBSCRIPTION_DATE_FIELD_LABELS[field]} is required for ${value.status}`,
        });
      }
    }

    const dateFields: SubscriptionDateField[] = [
      'trial_started_at',
      'trial_ends_at',
      'subscription_started_at',
      'current_period_started_at',
      'current_period_ends_at',
      'cancelled_at',
    ];

    for (const field of dateFields) {
      const date = value[field];
      if (!isValidDate(date)) continue;
      if (date < absoluteMin || date > absoluteMax) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${SUBSCRIPTION_DATE_FIELD_LABELS[field]} must be between ${SUBSCRIPTION_DATE_MIN} and ${subscriptionDateMax()}`,
        });
      }
    }

    if (
      isValidDate(value.trial_started_at) &&
      isValidDate(value.trial_ends_at) &&
      utcDay(value.trial_ends_at) < utcDay(value.trial_started_at)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['trial_ends_at'],
        message: 'Trial end must be on or after the trial start',
      });
    }

    if (
      isValidDate(value.current_period_started_at) &&
      isValidDate(value.current_period_ends_at) &&
      utcDay(value.current_period_ends_at) < utcDay(value.current_period_started_at)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_period_ends_at'],
        message: 'Period end must be on or after the period start',
      });
    }

    if (
      isValidDate(value.subscription_started_at) &&
      isValidDate(value.current_period_started_at) &&
      utcDay(value.current_period_started_at) < utcDay(value.subscription_started_at)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_period_started_at'],
        message: 'Period start must be on or after the subscription start',
      });
    }

    if (
      isValidDate(value.subscription_started_at) &&
      isValidDate(value.current_period_ends_at) &&
      utcDay(value.current_period_ends_at) < utcDay(value.subscription_started_at)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_period_ends_at'],
        message: 'Period end must be on or after the subscription start',
      });
    }

    if (value.status === 'expired' && isValidDate(value.current_period_ends_at)) {
      if (utcDay(value.current_period_ends_at) >= utcDay(todayStart)) {
        ctx.addIssue({
          code: 'custom',
          path: ['current_period_ends_at'],
          message: 'Expired period end must be before today',
        });
      }
    }

    if (value.status === 'past_due' && isValidDate(value.current_period_ends_at)) {
      if (utcDay(value.current_period_ends_at) > utcDay(todayStart)) {
        ctx.addIssue({
          code: 'custom',
          path: ['current_period_ends_at'],
          message: 'Past due period end must be today or earlier',
        });
      }
    }

    if (value.status === 'cancelled' && isValidDate(value.cancelled_at)) {
      if (utcDay(value.cancelled_at) > utcDay(todayStart)) {
        ctx.addIssue({
          code: 'custom',
          path: ['cancelled_at'],
          message: 'Cancelled on cannot be in the future',
        });
      }
    }
  });

export type UpdateSubscriptionData = z.infer<typeof updateSubscriptionSchema>;
