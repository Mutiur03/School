/**
 * Fee Heads, replicating dashboard/src/pages/Admin/Fees/FeeHeads.tsx: the heads table (Fee,
 * Charged, Income account, Deposit account, Waivable, Status, actions), the add / edit dialog
 * (Name, Charged, Income account with "Create "<name> Fees" automatically" for new heads,
 * Deposit account or "Chosen at collection", Order, Waivers apply, Active) and delete behind a
 * confirm. Live data: GET/POST/PATCH/DELETE /api/fee-heads, GET /api/acc-heads.
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { frequencyLabel } from '@/features/fees/model';
import { useAccHeads, useFeeHeads } from '@/features/finance/queries';
import type { FeeFrequency, FeeHead, FeeHeadInput } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

interface Form {
  name: string;
  frequency: FeeFrequency;
  income_head_id: number;
  deposit_head_id: number;
  is_waivable: boolean;
  sort_order: string;
  is_active: boolean;
}
const EMPTY: Form = {
  name: '',
  frequency: 'monthly',
  income_head_id: 0,
  deposit_head_id: 0,
  is_waivable: true,
  sort_order: '0',
  is_active: true,
};

export function FeeHeadsScreen() {
  const { fees } = useApi();
  const q = useFeeHeads();
  const acc = useAccHeads();
  const incomeHeads = (acc.data ?? []).filter((h) => h.type === 'income' && h.is_active);
  const cashBank = (acc.data ?? []).filter((h) => h.is_cash_bank && h.is_active);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeHead | null>(null);
  const { control, handleSubmit, reset, watch, setError } = useForm<Form>({ defaultValues: EMPTY });
  const name = watch('name');

  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: FeeHeadInput }) =>
      v.id ? fees.updateHead(v.id, v.input) : fees.createHead(v.input),
    invalidate: [['fee-heads'], ['acc-heads'], ['fee-statement']],
    success: () => (editing ? 'Fee head updated.' : 'Fee head added.'),
    failure: editing ? 'Failed to update the fee head.' : 'Failed to add the fee head.',
    onSuccess: () => setOpen(false),
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => fees.deleteHead(id),
    invalidate: [['fee-heads']],
    success: 'Fee head deleted.',
    failure: 'Failed to delete the fee head.',
    onSuccess: () => setDeleteTarget(null),
  });

  const openForm = (h: FeeHead | null) => {
    setEditing(h);
    reset(
      h
        ? {
            name: h.name,
            frequency: h.frequency,
            income_head_id: h.income_head_id,
            deposit_head_id: h.deposit_head_id ?? 0,
            is_waivable: h.is_waivable,
            sort_order: String(h.sort_order),
            is_active: h.is_active,
          }
        : EMPTY,
    );
    setOpen(true);
  };

  const submit = handleSubmit((f) => {
    if (!f.name.trim()) return setError('name', { message: 'Name is required' });
    if (editing && !f.income_head_id)
      return setError('income_head_id', { message: 'Pick an income account' });
    const order = /^\d{1,6}$/.test(f.sort_order.trim()) ? Number(f.sort_order) : NaN;
    if (Number.isNaN(order))
      return setError('sort_order', { message: 'Order must be a whole number' });
    save.mutate({
      id: editing?.id ?? null,
      input: {
        name: f.name,
        frequency: f.frequency,
        ...(f.income_head_id ? { income_head_id: f.income_head_id } : {}),
        deposit_head_id: f.deposit_head_id || null,
        is_waivable: f.is_waivable,
        sort_order: order,
        is_active: f.is_active,
      },
    });
  });

  const heads = q.data ?? [];
  const actions = (h: FeeHead) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit ${h.name}`}
        tone="emerald"
        onPress={() => openForm(h)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${h.name}`}
        tone="red"
        onPress={() => setDeleteTarget(h)}
      />
    </View>
  );
  const muted = (s: string) => (
    <Text size="sm" color="mutedForeground" numberOfLines={1}>
      {s}
    </Text>
  );
  const columns: Column<FeeHead>[] = [
    {
      key: 'name',
      label: 'Fee',
      className: 'min-w-0 flex-1',
      render: (h) => (
        <Text size="sm" weight="medium" numberOfLines={1}>
          {h.name}
        </Text>
      ),
    },
    {
      key: 'freq',
      label: 'Charged',
      className: 'w-28',
      render: (h) => <Text size="sm">{frequencyLabel(h.frequency)}</Text>,
    },
    {
      key: 'income',
      label: 'Income account',
      className: 'min-w-0 flex-1',
      render: (h) => muted(h.income_head?.name ?? '—'),
    },
    {
      key: 'deposit',
      label: 'Deposit account',
      className: 'min-w-0 flex-1',
      render: (h) => muted(h.deposit_head?.name ?? 'Chosen at collection'),
    },
    {
      key: 'waivable',
      label: 'Waivable',
      className: 'w-24',
      render: (h) => <Text size="sm">{h.is_waivable ? 'Yes' : 'No'}</Text>,
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-24',
      render: (h) => (h.is_active ? <Text size="sm">Active</Text> : muted('Inactive')),
    },
    { key: 'actions', label: 'Actions', className: 'w-[96px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Fee Heads"
      description="What the school charges. Collected money is credited to the income account."
      actions={
        <Button
          icon={Plus}
          label="Add fee head"
          onPress={() => openForm(null)}
          testID="add-fee-head"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load fee heads"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="fee-heads"
          rows={heads}
          columns={columns}
          rowKey={(h) => h.id}
          loading={q.isPending}
          empty="No fee heads yet."
          onRowPress={openForm}
          renderMobile={(h) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {h.name}
                </Text>
                <Text size="xs" color="mutedForeground" numberOfLines={1}>
                  {`${frequencyLabel(h.frequency)} · ${h.income_head?.name ?? '—'} · ${h.deposit_head?.name ?? 'Chosen at collection'}${h.is_active ? '' : ' · Inactive'}`}
                </Text>
              </View>
              {actions(h)}
            </View>
          )}
        />
      )}

      <Dialog
        open={open}
        onClose={() => (save.isPending ? undefined : setOpen(false))}
        title={editing ? 'Edit fee head' : 'Add fee head'}
        size="md"
        testID="fee-head-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setOpen(false)}
              disabled={save.isPending}
            />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add fee head'}
              onPress={() => void submit()}
              disabled={save.isPending}
              testID="fee-head-submit"
            />
          </>
        }
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field label="Name" required error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                placeholder="e.g. Tuition Fee"
                maxLength={100}
                accessibilityLabel="Name"
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <Field label="Charged">
              <Select
                label="Charged"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'monthly', label: 'Every month (Jan–Dec)' },
                  { value: 'once', label: 'Once a year' },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="income_head_id"
          render={({ field, fieldState }) => (
            <Field label="Income account" error={fieldState.error?.message}>
              <Select
                label="Income account"
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick an income account"
                options={[
                  ...(editing
                    ? []
                    : [{ value: 0, label: `Create "${name.trim() || 'fee'} Fees" automatically` }]),
                  ...incomeHeads.map((h) => ({ value: h.id, label: h.name })),
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="deposit_head_id"
          render={({ field }) => (
            <Field
              label="Deposit account"
              hint="Set this when the fee always goes into one bank or cash account, for example admission into a separate bank account."
            >
              <Select
                label="Deposit account"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 0, label: 'Chosen at collection' },
                  ...cashBank.map((h) => ({ value: h.id, label: h.name })),
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="sort_order"
          render={({ field, fieldState }) => (
            <Field label="Order" error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                accessibilityLabel="Order"
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="is_waivable"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              label="Waivers apply to this fee"
            />
          )}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label="Active" />
          )}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Delete "${deleteTarget?.name ?? 'this fee head'}"? Fee heads with collected fees cannot be deleted; mark them inactive instead.`}
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete fee head'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
