/**
 * Fee Structure, replicating dashboard/src/pages/Admin/Fees/FeeStructure.tsx: session + class,
 * "Copy classes from <year - 1>", and one amount per fee head (blank = not charged). Amounts are
 * parsed exactly into paisa (no float) with at most two decimals and must be above zero. The
 * server replaces the whole class on save, so Save and Copy both go through a confirm and can't
 * be sent twice. Live data: GET/PUT/POST /api/fee-structures, GET /api/fee-heads.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Copy, Save } from '@/components/ui/icons';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { amountText, frequencyLabel, structureDirty, structureItems } from '@/features/fees/model';
import { useFeeHeads, useFinanceKey } from '@/features/finance/queries';
import { ClassSelect, Filters, MoneyInput, YearSelect } from '@/features/finance/ui';
import type { FeeHead } from '@/lib/api';
import { formatMoney } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';

export function FeeStructureScreen() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const flight = useSingleFlight();
  const [year, setYear] = useState(new Date().getFullYear());
  const [cls, setCls] = useState(0);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState<'save' | 'copy' | null>(null);
  const headsQ = useFeeHeads();
  const heads = headsQ.data ?? [];
  const q = useQuery({
    queryKey: key('fee-structure', year, cls),
    queryFn: () => fees.structures(year, cls),
    enabled: cls > 0,
  });
  const saved = q.data;
  useEffect(() => {
    setTexts(Object.fromEntries((saved ?? []).map((r) => [r.fee_head_id, amountText(r.amount)])));
  }, [saved]);

  const { items, errors } = structureItems(heads, texts);
  const invalid = Object.keys(errors).length > 0;
  const dirty = structureDirty(saved ?? [], items);

  const save = useAdminMutation<void>({
    mutationFn: () => fees.saveStructure({ year, cls, items }),
    invalidate: [['fee-structure'], ['fee-statement'], ['fee-dues']],
    success: `Class ${cls} fees saved.`,
    failure: 'Failed to save the fee structure.',
    onSuccess: () => setConfirm(null),
  });
  const copy = useAdminMutation<void, { copied: number }>({
    mutationFn: () => fees.copyStructure(year - 1, year),
    invalidate: [['fee-structure'], ['fee-statement'], ['fee-dues']],
    success: (r) =>
      r.copied
        ? `Copied ${plural(r.copied, 'class', 'classes')} from ${year - 1}.`
        : `Nothing to copy: every class already has fees in ${year}.`,
    failure: 'Failed to copy the fee structure.',
    onSuccess: () => setConfirm(null),
  });
  const busy = save.isPending || copy.isPending;

  const columns: Column<FeeHead>[] = [
    {
      key: 'fee',
      label: 'Fee',
      className: 'min-w-0 flex-1',
      render: (h) => (
        <Text size="sm" numberOfLines={1}>
          {h.name}
          {!h.is_active ? (
            <Text size="sm" color="mutedForeground">
              {' '}
              (inactive)
            </Text>
          ) : null}
        </Text>
      ),
    },
    {
      key: 'freq',
      label: 'Charged',
      className: 'w-32',
      render: (h) => (
        <Text size="sm" color="mutedForeground">
          {h.frequency === 'monthly' ? 'Every month' : 'Once'}
        </Text>
      ),
    },
    {
      key: 'amount',
      label: 'Amount (per installment)',
      className: 'w-56',
      align: 'right',
      render: (h) => amountCell(h),
    },
  ];

  // a render function, not a component: a nested component would remount and drop focus
  const amountCell = (head: FeeHead) => (
    <View className="w-44 gap-0.5 self-end">
      <MoneyInput
        value={texts[head.id] ?? ''}
        onChange={(t) => setTexts((a) => ({ ...a, [head.id]: t }))}
        label={`${head.name} amount`}
        placeholder="Not charged"
        invalid={!!errors[head.id]}
        editable={!busy}
        testID={`amount-${head.id}`}
      />
      {errors[head.id] ? (
        <Text size="xs" color="destructive">
          {errors[head.id]}
        </Text>
      ) : null}
    </View>
  );

  return (
    <PageLayout
      title="Fee Structure"
      description="What each class pays in a session."
      actions={
        <Button
          variant="outline"
          icon={Copy}
          label={`Copy classes from ${year - 1}`}
          disabled={busy}
          onPress={() => setConfirm('copy')}
          testID="copy-structure"
        />
      }
    >
      <Filters>
        <YearSelect value={year} onChange={setYear} />
        <ClassSelect value={cls} onChange={setCls} />
        {cls ? (
          <Button
            icon={Save}
            label={save.isPending ? 'Saving…' : `Save class ${cls} fees`}
            disabled={busy || invalid || !dirty || q.isPending}
            onPress={() => setConfirm('save')}
            testID="save-structure"
          />
        ) : null}
      </Filters>
      {!cls ? (
        <EmptyState message="Pick a class to edit its fees." />
      ) : q.isError && !saved ? (
        <ErrorState
          title="Couldn't load the fee structure"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="fee-structure"
          rows={heads}
          columns={columns}
          rowKey={(h) => h.id}
          loading={q.isPending || headsQ.isPending}
          empty="Add fee heads first."
          renderMobile={(h) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {h.name}
                </Text>
                <Text size="xs" color="mutedForeground">
                  {frequencyLabel(h.frequency)}
                  {h.is_active ? '' : ' · inactive'}
                </Text>
              </View>
              {amountCell(h)}
            </View>
          )}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        tone="default"
        title={confirm === 'copy' ? `Copy fees into ${year}?` : `Save class ${cls} fees?`}
        message={
          confirm === 'copy'
            ? `Classes with no fees in ${year} get ${year - 1}'s amounts. Classes that already have fees in ${year} are left as they are.`
            : `Class ${cls} in ${year} will charge: ${
                items.length
                  ? items
                      .map(
                        (i) =>
                          `${heads.find((h) => h.id === i.fee_head_id)?.name ?? i.fee_head_id} ${formatMoney(i.amount)}`,
                      )
                      .join(', ')
                  : 'nothing'
              }. This replaces the class's current fees; installments already collected keep their receipts.`
        }
        confirmLabel={busy ? 'Saving…' : confirm === 'copy' ? 'Copy fees' : 'Save fees'}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          void flight
            .run(async () => {
              if (confirm === 'copy') await copy.mutateAsync();
              else await save.mutateAsync();
            })
            .catch(() => {})
        }
      />
    </PageLayout>
  );
}
