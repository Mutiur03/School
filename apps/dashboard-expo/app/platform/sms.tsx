/**
 * SMS Management, ported from dashboard/src/pages/SuperAdmin/SmsOverview.tsx: shared account
 * balance, schools on shared / self-hosted, needs attention (not configured or < 200 left), and
 * the searchable table (School / Mode / Sender ID / Est. SMS). A row opens that school's SMS tab.
 * Read-only: GET /api/schools/sms-overview.
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import {
  ChevronRight,
  Cloud,
  MessageSquare,
  ServerCog,
  TriangleAlert,
  Wallet,
} from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { filterByName, isLowBalance, smsSummary } from '@/features/platform/model';
import { ModeBadge, SchoolLogo, usePlatformKey } from '@/features/platform/ui';
import { StatsCard } from '@/features/student/components';
import type { SmsOverviewRow } from '@/lib/api';
import { usePlatformApi } from '@/session/ApiProvider';

export default function PlatformSmsScreen() {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: key('sms-overview'),
    queryFn: ({ signal }) => platform.smsOverview(signal),
    staleTime: 30_000,
  });
  const schools = useMemo(() => q.data?.schools ?? [], [q.data]);
  const rows = useMemo(
    () => filterByName(schools, search, (r) => [r.school_name]),
    [schools, search],
  );
  const summary = smsSummary(schools);
  const loading = q.isLoading;
  const open = (row: SmsOverviewRow) =>
    router.push({
      pathname: '/platform/schools',
      params: { school: String(row.school_id), tab: 'sms' },
    });

  const estimate = (row: SmsOverviewRow) => (
    <Text
      size="sm"
      weight="medium"
      tabular
      className={isLowBalance(row.estimated_sms) ? 'text-amber-600' : undefined}
    >
      {row.estimated_sms ?? '—'}
    </Text>
  );

  const columns: Column<SmsOverviewRow>[] = [
    {
      key: 'school',
      label: 'School',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <View className="min-w-0 flex-row items-center gap-3">
          <SchoolLogo logo={r.logo} size={32} />
          <Text size="sm" weight="medium" numberOfLines={1} className="shrink">
            {r.school_name}
          </Text>
        </View>
      ),
    },
    { key: 'mode', label: 'Mode', className: 'w-40', render: (r) => <ModeBadge row={r} /> },
    {
      key: 'sender',
      label: 'Sender ID',
      className: 'w-40',
      render: (r) => (
        <Text size="sm" color="mutedForeground" numberOfLines={1}>
          {r.sender_id || '—'}
        </Text>
      ),
    },
    { key: 'est', label: 'Est. SMS', align: 'right', className: 'w-28', render: estimate },
    {
      key: 'go',
      label: '',
      className: 'w-8',
      align: 'right',
      render: () => <Icon icon={ChevronRight} size={16} color="mutedForeground" />,
    },
  ];

  return (
    <PageLayout
      title="SMS Management"
      description="Shared account balance and every school's SMS mode (not configured / shared / self-hosted)."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError ? (
        <ErrorState
          title="Could not load SMS overview"
          message="Check your connection and try again."
          onRetry={() => void q.refetch()}
        />
      ) : null}
      <View className="flex-row flex-wrap gap-4">
        <StatsCard
          label="Shared account balance"
          value={q.data?.system.estimated_sms ?? '—'}
          color="blue"
          icon={Wallet}
          loading={loading}
        />
        <StatsCard
          label="Schools on shared account"
          value={summary.shared}
          icon={Cloud}
          loading={loading}
        />
        <StatsCard
          label="Self-hosted schools"
          value={summary.selfHosted}
          color="emerald"
          icon={ServerCog}
          loading={loading}
        />
        <StatsCard
          label="Needs attention"
          value={summary.needsAttention}
          color={summary.needsAttention > 0 ? 'amber' : 'default'}
          icon={TriangleAlert}
          loading={loading}
        />
      </View>
      {q.data?.system.message && !loading ? (
        <Text size="xs" color="mutedForeground" className="-mt-2">
          {q.data.system.message}
        </Text>
      ) : null}
      <SectionCard
        title="Schools"
        description={`${rows.length} of ${schools.length}`}
        icon={<Icon icon={MessageSquare} size={20} color="primary" />}
        noPadding
        headerAction={
          <View className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search schools…"
              label="Search schools"
            />
          </View>
        }
      >
        <DataTable
          testID="platform-sms-table"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.school_id}
          loading={loading}
          empty={search ? 'No schools match your search.' : 'No schools found.'}
          onRowPress={open}
          rowPressOnWide
          renderMobile={(r) => (
            <View className="flex-row items-center gap-3">
              <SchoolLogo logo={r.logo} size={36} />
              <View className="min-w-0 flex-1 gap-1">
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {r.school_name}
                </Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <ModeBadge row={r} />
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {r.sender_id || 'No sender ID'}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                {estimate(r)}
                <Text size="xs" color="mutedForeground">
                  est. SMS
                </Text>
              </View>
            </View>
          )}
        />
      </SectionCard>
    </PageLayout>
  );
}
