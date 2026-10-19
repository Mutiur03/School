/**
 * Overview, ported from dashboard/src/pages/SuperAdmin/Dashboard.tsx: fleet health across all
 * school tenants (Schools, On free trial, Trials ending ≤14d, Needs attention), the attention
 * note, and link cards to Schools / Exam types / SMS. Data: GET /api/schools.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Clock3,
  MessageSquare,
  RefreshCw,
  TriangleAlert,
} from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { fleetStats } from '@/features/platform/model';
import { PLATFORM_LINKS } from '@/features/platform/routes';
import { usePlatformSchools } from '@/features/platform/ui';
import { StatsCard } from '@/features/student/components';

const LINKS = [
  {
    title: 'Schools',
    description: 'Create tenants and edit branding, billing, admins, and SMS.',
    href: PLATFORM_LINKS.schools.href,
    icon: Building2,
    action: 'Open schools',
  },
  {
    title: 'Exam types',
    description: 'Global exam catalog and which types each school can use.',
    href: PLATFORM_LINKS.examTypes.href,
    icon: ClipboardList,
    action: 'Open exam types',
  },
  {
    title: 'SMS',
    description: 'Shared balance and per-school provider setup.',
    href: PLATFORM_LINKS.sms.href,
    icon: MessageSquare,
    action: 'Open SMS',
  },
] as const;

export default function PlatformOverviewScreen() {
  const router = useRouter();
  const q = usePlatformSchools();
  const stats = fleetStats(q.data ?? []);
  const loading = q.isLoading;

  return (
    <PageLayout
      title="Overview"
      description="Fleet health across all school tenants."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
      actions={
        <Button
          variant="outline"
          icon={RefreshCw}
          label="Refresh"
          disabled={q.isFetching}
          onPress={() => void q.refetch()}
        />
      }
    >
      {q.isError ? (
        <ErrorState message="Could not load schools." onRetry={() => void q.refetch()} />
      ) : null}
      <View className="flex-row flex-wrap gap-4" testID="platform-overview-stats">
        <StatsCard
          label="Schools"
          value={stats.total}
          color="blue"
          icon={Building2}
          loading={loading}
        />
        <StatsCard label="On free trial" value={stats.trialing} icon={Clock3} loading={loading} />
        <StatsCard
          label="Trials ending ≤14d"
          value={stats.trialsEndingSoon}
          color={stats.trialsEndingSoon > 0 ? 'amber' : 'default'}
          icon={Clock3}
          loading={loading}
        />
        <StatsCard
          label="Needs attention"
          value={stats.attention}
          color={stats.attention > 0 ? 'amber' : 'default'}
          icon={TriangleAlert}
          loading={loading}
        />
      </View>
      <Text size="xs" color="mutedForeground" className="-mt-2">
        Needs attention = past due + locked/expired/suspended/cancelled + trials ending within 14
        days ({stats.pastDue} past due, {stats.expiredOrLocked} locked).
      </Text>
      <View className="flex-row flex-wrap gap-4">
        {LINKS.map((l) => (
          <View
            key={l.href}
            className="min-w-[260px] flex-1 basis-full sm:basis-[45%] lg:basis-[30%]"
          >
            <SectionCard title={l.title} icon={<Icon icon={l.icon} size={20} color="primary" />}>
              <Text size="sm" color="mutedForeground" className="mb-4">
                {l.description}
              </Text>
              <View className="items-start">
                <Button
                  label={l.action}
                  icon={ArrowRight}
                  iconPosition="end"
                  onPress={() => router.push(l.href)}
                />
              </View>
            </SectionCard>
          </View>
        ))}
      </View>
    </PageLayout>
  );
}
