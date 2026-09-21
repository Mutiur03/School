import type { UpdateSubscriptionData } from '@school/shared-schemas';
import type { SubscriptionStatus } from '@/generated/prisma/client.js';
import { prisma } from '@/config/prisma.js';
import { ApiError } from '@/utils/ApiError.js';
import { redis } from '@/config/redis.js';
import {
  calculateSubscriptionAccess,
  effectiveSubscriptionStatus,
} from './subscription-access.js';

const subscriptionCacheKey = (schoolId: number) => `school:subscription:${schoolId}`;

const subscriptionInclude = {
  school: { select: { id: true, name: true, shortName: true, logo: true } },
} as const;

type AccessFields = {
  status: string;
  trial_ends_at: Date | null;
  current_period_ends_at: Date | null;
};

function withSummary<T extends AccessFields>(subscription: T) {
  return { ...subscription, ...calculateSubscriptionAccess(subscription) };
}

/** Persist active→past_due / →expired and past_due→expired (lazy, on read). */
async function persistLifecycleIfNeeded<T extends AccessFields>(
  schoolId: number,
  subscription: T,
): Promise<T> {
  const effective = effectiveSubscriptionStatus(subscription);
  if (effective === subscription.status) return subscription;

  const canAuto =
    (subscription.status === 'active' &&
      (effective === 'past_due' || effective === 'expired')) ||
    (subscription.status === 'past_due' && effective === 'expired');
  if (!canAuto) return subscription;

  const fromStatus = subscription.status as SubscriptionStatus;
  const toStatus = effective as SubscriptionStatus;

  const result = await prisma.school_subscriptions.updateMany({
    where: { school_id: schoolId, status: fromStatus },
    data: { status: toStatus, status_changed_at: new Date() },
  });
  await redis.del(subscriptionCacheKey(schoolId)).catch(() => {});
  if (result.count === 0) return subscription;
  return { ...subscription, status: toStatus };
}

export class BillingService {
  static async getAccessForSchool(schoolId: number) {
    const key = subscriptionCacheKey(schoolId);
    const cached = await redis.get(key).catch(() => null);
    let subscription: AccessFields | null = null;

    if (cached) {
      const parsed = JSON.parse(cached) as {
        status: string;
        trial_ends_at: string | null;
        current_period_ends_at: string | null;
      };
      subscription = {
        status: parsed.status,
        trial_ends_at: parsed.trial_ends_at ? new Date(parsed.trial_ends_at) : null,
        current_period_ends_at: parsed.current_period_ends_at
          ? new Date(parsed.current_period_ends_at)
          : null,
      };
    } else {
      subscription = await prisma.school_subscriptions.findUnique({
        where: { school_id: schoolId },
        select: { status: true, trial_ends_at: true, current_period_ends_at: true },
      });
    }

    if (!subscription) throw new ApiError(404, 'Subscription not found for this school');
    subscription = await persistLifecycleIfNeeded(schoolId, subscription);
    redis.set(key, JSON.stringify(subscription), 'EX', 300).catch(() => {});
    return calculateSubscriptionAccess(subscription);
  }

  static async getForSchool(schoolId: number) {
    const subscription = await prisma.school_subscriptions.findUnique({
      where: { school_id: schoolId },
      include: subscriptionInclude,
    });
    if (!subscription) throw new ApiError(404, 'Subscription not found for this school');
    const resolved = await persistLifecycleIfNeeded(schoolId, subscription);
    return withSummary(resolved);
  }

  static async updateForSchool(schoolId: number, data: UpdateSubscriptionData) {
    const existing = await prisma.school_subscriptions.findUnique({
      where: { school_id: schoolId },
      select: { status: true },
    });
    if (!existing) throw new ApiError(404, 'Subscription not found for this school');

    const subscription = await prisma.school_subscriptions.update({
      where: { school_id: schoolId },
      data: {
        ...data,
        plan_name: 'Annual',
        billing_interval: 'annual',
        status_changed_at: existing.status === data.status ? undefined : new Date(),
      },
      include: subscriptionInclude,
    });
    await redis.del(subscriptionCacheKey(schoolId)).catch(() => {});
    return withSummary(subscription);
  }
}
