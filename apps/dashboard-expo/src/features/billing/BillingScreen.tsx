/**
 * Billing (read-only), replicating dashboard/src/pages/Admin/Billing.tsx: subtitle "{status} ·
 * {plan} · {access}", the status strip (Status pill, Access with dot, Days remaining / Grace
 * days left, Access ends, summary line), the Plan and Dates cards and the Help card.
 * Live data: GET /api/school/billing (admin only, this school). Platform admins change it.
 */
import { useQuery } from '@tanstack/react-query';
import { SUBSCRIPTION_DATE_FIELD_LABELS, SUBSCRIPTION_STATUS_FIELDS } from '@school/shared-schemas';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Icon } from '@/components/ui/Icon';
import { CalendarDays, CircleDollarSign, Clock3, ShieldCheck } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  ACCESS_LABELS,
  BILLING_STATUS_LABELS,
  STATUS_SUMMARY,
  billingView,
  formatBillingDate,
} from '@/features/billing/model';
import type { AccessState, SubscriptionStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { useTheme } from '@/theme/ThemeProvider';

const STATUS_CLASS: Record<SubscriptionStatus, { box: string; text: string }> = {
  trialing: { box: 'border-sky-200 bg-sky-50', text: 'text-sky-900' },
  active: { box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-900' },
  past_due: { box: 'border-amber-200 bg-amber-50', text: 'text-amber-900' },
  suspended: { box: 'border-orange-200 bg-orange-50', text: 'text-orange-900' },
  expired: { box: 'border-slate-200 bg-slate-100', text: 'text-slate-800' },
  cancelled: { box: 'border-red-200 bg-red-50', text: 'text-red-900' },
};
const ACCESS_DOT: Record<AccessState, string> = {
  active: 'bg-emerald-500',
  grace: 'bg-amber-500',
  locked: 'bg-red-500',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="border-border flex-row items-center justify-between gap-4 border-b py-2.5">
      <Text size="sm" color="mutedForeground">
        {label}
      </Text>
      <View className="shrink items-end">
        {typeof children === 'string' ? (
          <Text size="sm" weight="medium" tabular>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

function Cell({
  label,
  children,
  dot,
}: {
  label: string;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <View className="min-w-[45%] flex-1 gap-1 sm:min-w-0">
      <View className="flex-row items-center gap-1.5">
        {dot ? <View className={cn('h-1.5 w-1.5 rounded-full', dot)} /> : null}
        <Text size="xs" color="mutedForeground">
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function BillingScreen() {
  const { billing } = useApi();
  const { resolution } = useTenant();
  const { shadows } = useTheme();
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'billing'),
    queryFn: ({ signal }) => billing.current(signal),
  });
  const s = q.data;
  const view = s
    ? billingView(s, SUBSCRIPTION_STATUS_FIELDS, SUBSCRIPTION_DATE_FIELD_LABELS)
    : null;

  return (
    <PageLayout
      title="Billing"
      description={view ? view.subtitle : 'Your school’s subscription status and access timeline.'}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isPending ? (
        <View className="gap-5">
          <Skeleton height={112} />
          <View className="flex-row flex-wrap gap-5">
            <Skeleton height={160} className="min-w-[280px] flex-1" />
            <Skeleton height={160} className="min-w-[280px] flex-1" />
          </View>
        </View>
      ) : q.isError || !s || !view ? (
        <ErrorState
          title="Billing details could not be loaded."
          message={q.error?.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View
            accessibilityLabel="Subscription status"
            className="border-border bg-card flex-row flex-wrap gap-x-6 gap-y-4 rounded-xl border px-5 py-4"
            style={{ boxShadow: shadows.sm }}
            testID="billing-status"
          >
            <Cell label="Status">
              <View
                className={cn(
                  'self-start rounded-full border px-2.5 py-0.5',
                  STATUS_CLASS[s.status].box,
                )}
              >
                <Text size="sm" weight="semibold" className={STATUS_CLASS[s.status].text}>
                  {BILLING_STATUS_LABELS[s.status]}
                </Text>
              </View>
            </Cell>
            <Cell label="Access" dot={ACCESS_DOT[s.access_state]}>
              <Text size="base" weight="semibold">
                {ACCESS_LABELS[s.access_state]}
              </Text>
            </Cell>
            <Cell label={view.daysLabel}>
              <Text size="xl" weight="semibold" tabular>
                {view.days}
              </Text>
            </Cell>
            <Cell label="Access ends">
              <Text size="base" weight="semibold" tabular>
                {view.showAccessEnds ? formatBillingDate(s.access_ends_at) : '—'}
              </Text>
            </Cell>
            <View className="w-full">
              <Text size="sm" color="mutedForeground">
                {STATUS_SUMMARY[s.status]}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-5">
            {view.showPlan ? (
              <SectionCard
                title="Plan"
                icon={<Icon icon={CircleDollarSign} size={20} color="primary" />}
                className="min-w-[280px] flex-1"
              >
                <Row label="Plan">{s.plan_name}</Row>
                <Row label="Billing cycle">Annual</Row>
                {view.showRenewal ? (
                  <Row label="Renewal">
                    <View className="flex-row items-center gap-1.5">
                      <Icon icon={Clock3} size={14} color="mutedForeground" />
                      <Text size="sm" weight="medium">
                        Every 12 months
                      </Text>
                    </View>
                  </Row>
                ) : null}
              </SectionCard>
            ) : null}
            <SectionCard
              title="Dates"
              icon={<Icon icon={CalendarDays} size={20} color="primary" />}
              className="min-w-[280px] flex-1"
            >
              {view.dates.map((r) => (
                <Row key={r.label} label={r.label}>
                  {formatBillingDate(r.value)}
                </Row>
              ))}
            </SectionCard>
          </View>
          <SectionCard title="Help" icon={<Icon icon={ShieldCheck} size={20} color="primary" />}>
            <Text size="sm" color="mutedForeground">
              Subscription dates and status are managed by the platform administrator. Contact them
              if any detail needs updating.
            </Text>
          </SectionCard>
        </>
      )}
    </PageLayout>
  );
}
