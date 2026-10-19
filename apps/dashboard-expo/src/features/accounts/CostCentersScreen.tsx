/**
 * Cost Centers, replicating dashboard/src/pages/Admin/Accounts/CostCenters.tsx: Name, Code,
 * Status, actions; the add / edit dialog validated with the shared costCenterFormSchema; delete
 * behind a confirm. Live data: GET/POST/PATCH/DELETE /api/cost-centers (admin, this school).
 */
import { costCenterFormSchema } from '@school/shared-schemas';
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
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useCostCenters } from '@/features/finance/queries';
import type { CostCenter, CostCenterInput } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

type Form = { name: string; code: string; is_active: boolean };
const EMPTY: Form = { name: '', code: '', is_active: true };

export function CostCentersScreen() {
  const { accounts } = useApi();
  const q = useCostCenters();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CostCenter | null>(null);
  const { control, handleSubmit, reset, setError } = useForm<Form>({ defaultValues: EMPTY });

  const save = useAdminMutation({
    mutationFn: (input: CostCenterInput) =>
      editing ? accounts.updateCostCenter(editing.id, input) : accounts.createCostCenter(input),
    invalidate: [['cost-centers']],
    success: () => (editing ? 'Cost center updated.' : 'Cost center added.'),
    failure: editing ? 'Failed to update the cost center.' : 'Failed to add the cost center.',
    onSuccess: () => setOpen(false),
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => accounts.deleteCostCenter(id),
    invalidate: [['cost-centers']],
    success: 'Cost center deleted.',
    failure: 'Failed to delete the cost center.',
    onSuccess: () => setDeleteTarget(null),
  });
  const openForm = (c: CostCenter | null) => {
    setEditing(c);
    reset(c ? { name: c.name, code: c.code ?? '', is_active: c.is_active } : EMPTY);
    setOpen(true);
  };
  const submit = handleSubmit((f) => {
    const r = costCenterFormSchema.safeParse(f);
    if (!r.success) {
      for (const i of r.error.issues)
        setError(String(i.path[0]) as keyof Form, { message: i.message });
      return;
    }
    save.mutate({ name: r.data.name, code: r.data.code ?? null, is_active: r.data.is_active });
  });

  const actions = (c: CostCenter) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit ${c.name}`}
        tone="emerald"
        onPress={() => openForm(c)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${c.name}`}
        tone="red"
        onPress={() => setDeleteTarget(c)}
      />
    </View>
  );
  const columns: Column<CostCenter>[] = [
    {
      key: 'name',
      label: 'Name',
      className: 'min-w-0 flex-1',
      render: (c) => (
        <Text size="sm" weight="medium" numberOfLines={1}>
          {c.name}
        </Text>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      className: 'w-32',
      render: (c) => (
        <Text size="sm" color="mutedForeground">
          {c.code ?? '—'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-28',
      render: (c) => (
        <Text size="sm" color={c.is_active ? undefined : 'mutedForeground'}>
          {c.is_active ? 'Active' : 'Inactive'}
        </Text>
      ),
    },
    { key: 'actions', label: 'Actions', className: 'w-[96px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Cost Centers"
      description="Tag vouchers by department, project or activity."
      actions={
        <Button
          icon={Plus}
          label="Add cost center"
          onPress={() => openForm(null)}
          testID="add-cost-center"
        />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load cost centers"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="cost-centers"
          rows={q.data ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={q.isPending}
          empty="No cost centers yet."
          onRowPress={openForm}
          renderMobile={(c) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text size="xs" color="mutedForeground">
                  {[c.code, c.is_active ? 'Active' : 'Inactive'].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {actions(c)}
            </View>
          )}
        />
      )}
      <Dialog
        open={open}
        onClose={() => (save.isPending ? undefined : setOpen(false))}
        title={editing ? 'Edit cost center' : 'Add cost center'}
        size="md"
        testID="cost-center-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setOpen(false)}
              disabled={save.isPending}
            />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add cost center'}
              onPress={() => void submit()}
              disabled={save.isPending}
            />
          </>
        }
      >
        <TextField control={control} name="name" label="Name" required maxLength={100} />
        <TextField
          control={control}
          name="code"
          label="Code"
          placeholder="Optional"
          maxLength={20}
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
        message={`Delete "${deleteTarget?.name ?? 'this cost center'}"? This cannot be undone.`}
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete cost center'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
