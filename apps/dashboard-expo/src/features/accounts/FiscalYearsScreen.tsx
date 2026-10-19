/**
 * Fiscal Years, replicating dashboard/src/pages/Admin/Accounts/FiscalYears.tsx: Year, Income,
 * Expense, Surplus / deficit, Status (Closed + date / Open), Close year / Reopen. Both go through
 * a confirm that states what happens, are disabled when the server says they can't run
 * (can_close / can_reopen) and can't be sent twice.
 * Live data: GET /api/acc-years, PUT /api/acc-years/:year, DELETE /api/acc-years/:year.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Lock, LockOpen } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { closeYearMessage, reopenYearMessage, surplusLabel } from '@/features/accounts/model';
import { MONEY_KEYS, useAccYears } from '@/features/finance/queries';
import { Money } from '@/features/finance/ui';
import { formatDate } from '@/features/student/format';
import type { AccYear } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

export function FiscalYearsScreen() {
  const { accounts } = useApi();
  const flight = useSingleFlight();
  const q = useAccYears();
  const [closing, setClosing] = useState<AccYear | null>(null);
  const [reopening, setReopening] = useState<AccYear | null>(null);
  const close = useAdminMutation({
    mutationFn: (y: number) => accounts.closeYear(y),
    invalidate: MONEY_KEYS,
    success: 'Year closed.',
    failure: 'Failed to close the year.',
    onSuccess: () => setClosing(null),
  });
  const reopen = useAdminMutation({
    mutationFn: (y: number) => accounts.reopenYear(y),
    invalidate: MONEY_KEYS,
    success: 'Year reopened.',
    failure: 'Failed to reopen the year.',
    onSuccess: () => setReopening(null),
  });
  const busy = close.isPending || reopen.isPending;

  const status = (y: AccYear) =>
    y.closed ? (
      <View className="bg-secondary flex-row items-center gap-1 self-start rounded-full px-2 py-0.5">
        <Icon icon={Lock} size={12} color="secondaryForeground" />
        <Text size="xs" weight="medium" color="secondaryForeground">
          {`Closed${y.closed_at ? ` ${formatDate(y.closed_at)}` : ''}`}
        </Text>
      </View>
    ) : (
      <Text size="sm" color="mutedForeground">
        Open
      </Text>
    );
  const action = (y: AccYear) =>
    y.closed ? (
      <Button
        size="sm"
        variant="outline"
        icon={LockOpen}
        label="Reopen"
        disabled={!y.can_reopen || busy}
        accessibilityHint={y.can_reopen ? undefined : 'Reopen the later closed year first'}
        onPress={() => setReopening(y)}
        testID={`reopen-${y.year}`}
      />
    ) : (
      <Button
        size="sm"
        icon={Lock}
        label="Close year"
        disabled={!y.can_close || busy}
        accessibilityHint={y.can_close ? undefined : 'Close the earlier open year first'}
        onPress={() => setClosing(y)}
        testID={`close-${y.year}`}
      />
    );
  const columns: Column<AccYear>[] = [
    {
      key: 'year',
      label: 'Year',
      className: 'w-28',
      render: (y) => (
        <Text size="sm" weight="medium" tabular>
          {y.year}
        </Text>
      ),
    },
    {
      key: 'income',
      label: 'Income',
      className: 'w-36',
      align: 'right',
      render: (y) => <Money value={y.income} />,
    },
    {
      key: 'expense',
      label: 'Expense',
      className: 'w-36',
      align: 'right',
      render: (y) => <Money value={y.expense} />,
    },
    {
      key: 'net',
      label: 'Surplus / deficit',
      className: 'w-44',
      align: 'right',
      render: (y) => (
        <Text size="sm" tabular color={y.net < 0 ? 'destructive' : undefined}>
          {surplusLabel(y.net)}
        </Text>
      ),
    },
    { key: 'status', label: 'Status', className: 'min-w-0 flex-1', render: status },
    { key: 'actions', label: 'Actions', className: 'w-[130px]', align: 'right', render: action },
  ];

  return (
    <PageLayout
      title="Fiscal Years"
      description="Close a year when its books are final. Results move into Retained Earnings and the year is locked."
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load fiscal years"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="acc-years"
          rows={q.data ?? []}
          columns={columns}
          rowKey={(y) => y.year}
          loading={q.isPending}
          empty="No years yet."
          renderMobile={(y) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text size="sm" weight="semibold" tabular>
                  {y.year}
                </Text>
                <Text size="xs" color={y.net < 0 ? 'destructive' : 'mutedForeground'} tabular>
                  {surplusLabel(y.net)}
                </Text>
                {status(y)}
              </View>
              {action(y)}
            </View>
          )}
        />
      )}
      <ConfirmDialog
        open={closing !== null}
        tone="default"
        title={`Close ${closing?.year ?? ''}?`}
        message={closing ? closeYearMessage(closing) : ''}
        confirmLabel={close.isPending ? 'Closing…' : 'Close year'}
        busy={close.isPending}
        onClose={() => setClosing(null)}
        onConfirm={() =>
          closing && void flight.run(() => close.mutateAsync(closing.year)).catch(() => {})
        }
      />
      <ConfirmDialog
        open={reopening !== null}
        tone="default"
        title={`Reopen ${reopening?.year ?? ''}?`}
        message={reopening ? reopenYearMessage(reopening) : ''}
        confirmLabel={reopen.isPending ? 'Reopening…' : 'Reopen year'}
        busy={reopen.isPending}
        onClose={() => setReopening(null)}
        onConfirm={() =>
          reopening && void flight.run(() => reopen.mutateAsync(reopening.year)).catch(() => {})
        }
      />
    </PageLayout>
  );
}
