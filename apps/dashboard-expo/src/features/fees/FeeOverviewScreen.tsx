/**
 * Fees overview, replicating dashboard/src/pages/Admin/Fees/FeeOverview.tsx: Collect fees, the
 * Today / This month / This year cards, the last-7-days bars and the latest receipts (tap a
 * receipt number for its PDF). Live data: GET /api/fee-reports/summary?date (admin, this school).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Banknote } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { formatDay, todayYmd } from '@/features/holidays/model';
import { barHeights } from '@/features/fees/model';
import { useFinanceKey } from '@/features/finance/queries';
import { Money } from '@/features/finance/ui';
import type { FeeSummary } from '@/lib/api';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { formatMoney, ZERO } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';
import { useTheme } from '@/theme/ThemeProvider';

type Latest = FeeSummary['latest'][number];

function Card({
  label,
  value,
  dot,
  loading,
}: {
  label: string;
  value: string;
  dot: string;
  loading: boolean;
}) {
  const { shadows } = useTheme();
  return (
    <View
      className="border-border bg-card min-w-[200px] flex-1 gap-1 rounded-xl border px-5 py-4"
      style={{ boxShadow: shadows.sm }}
    >
      <View className="flex-row items-center gap-1.5">
        <View className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <Text size="xs" color="mutedForeground">
          {label}
        </Text>
      </View>
      {loading ? (
        <Skeleton height={28} width={120} />
      ) : (
        <Text size="2xl" weight="semibold" tabular>
          {value}
        </Text>
      )}
    </View>
  );
}

export function FeeOverviewScreen() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const toast = useToast();
  const [today] = useState(todayYmd());
  const q = useQuery({
    queryKey: key('fee-summary', today),
    queryFn: () => fees.summary(today),
    staleTime: 30_000,
  });
  const d = q.data;
  const days = d?.last_7_days ?? [];
  const heights = barHeights(days);

  const print = async (r: Latest) => {
    try {
      const res = await openPdf(
        () => fees.receiptPdf(r.id),
        pdfFileName(['receipt', r.receipt_no]),
      );
      if (res !== 'opened') toast.error('This device cannot open the receipt.');
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to open the receipt'));
    }
  };

  const columns: Column<Latest>[] = [
    {
      key: 'no',
      label: 'Receipt',
      className: 'w-24',
      render: (r) => (
        <Pressable accessibilityRole="link" onPress={() => void print(r)}>
          <Text size="sm" weight="medium" tabular className="hover:underline">
            #{r.receipt_no}
          </Text>
        </Pressable>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground">
          {formatDay(r.date)}
        </Text>
      ),
    },
    {
      key: 'student',
      label: 'Student',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" numberOfLines={1}>
          {r.student_name}
        </Text>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      className: 'w-28',
      render: (r) => <Text size="sm">{`${r.class}-${r.section} · ${r.roll}`}</Text>,
    },
    {
      key: 'total',
      label: 'Total',
      className: 'w-32',
      align: 'right',
      render: (r) => <Money value={r.total} />,
    },
  ];

  return (
    <PageLayout
      title="Fees"
      description="Collection at a glance."
      actions={
        <Button
          icon={Banknote}
          label="Collect fees"
          onPress={() => router.push('/fees/collect')}
          testID="go-collect"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !d ? (
        <ErrorState
          title="Couldn't load fees"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-4">
            <Card
              label="Today"
              value={formatMoney(d?.today ?? ZERO)}
              dot="bg-emerald-500"
              loading={q.isPending}
            />
            <Card
              label="This month"
              value={formatMoney(d?.month ?? ZERO)}
              dot="bg-blue-500"
              loading={q.isPending}
            />
            <Card
              label="This year"
              value={formatMoney(d?.year ?? ZERO)}
              dot="bg-violet-500"
              loading={q.isPending}
            />
          </View>
          <SectionCard title="Last 7 days" testID="fee-7days">
            <View
              className="h-40 flex-row items-end gap-3"
              accessibilityLabel="Collection in the last 7 days"
            >
              {days.map((day, i) => (
                <View key={day.date} className="h-full flex-1 items-center justify-end gap-1">
                  <Text size="xs" color="mutedForeground" tabular numberOfLines={1}>
                    {day.total ? formatMoney(day.total) : ''}
                  </Text>
                  <View className="w-full flex-1 justify-end">
                    <View
                      className="bg-primary w-full rounded-t"
                      style={{ height: `${heights[i] ?? 2}%`, opacity: day.total ? 1 : 0.2 }}
                    />
                  </View>
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {formatDay(day.date).split(' ').slice(0, 2).join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>
          <View className="gap-2">
            <Text size="sm" weight="semibold">
              Latest receipts
            </Text>
            <DataTable
              testID="fee-latest"
              rows={d?.latest ?? []}
              columns={columns}
              rowKey={(r) => r.id}
              loading={q.isPending}
              empty="No receipts yet."
              onRowPress={(r) => void print(r)}
              renderMobile={(r) => (
                <View className="flex-row items-center gap-3">
                  <View className="min-w-0 flex-1">
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {`#${r.receipt_no} · ${r.student_name}`}
                    </Text>
                    <Text size="xs" color="mutedForeground">
                      {`${formatDay(r.date)} · Class ${r.class}-${r.section} · Roll ${r.roll}`}
                    </Text>
                  </View>
                  <Money value={r.total} weight="semibold" />
                </View>
              )}
            />
          </View>
        </>
      )}
    </PageLayout>
  );
}
