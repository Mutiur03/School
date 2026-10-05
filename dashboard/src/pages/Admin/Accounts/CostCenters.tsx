import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import {
  costCenterFormSchema,
  type CostCenterFormData,
  type CostCenterFormInput,
} from '@school/shared-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationPopup } from '@/components';
import {
  useCostCenters,
  useCreateCostCenter,
  useDeleteCostCenter,
  useUpdateCostCenter,
} from '@/queries/accounts.queries';
import type { CostCenter } from '@/types/accounts';
import { DataTable, Field, FormPopup, PageTitle, RowActions, StateRows, td } from './ui';

const EMPTY: CostCenterFormInput = { name: '', code: '', is_active: true };

const columns = [
  { label: 'Name' },
  { label: 'Code', className: 'w-32' },
  { label: 'Status', className: 'w-28' },
  { label: 'Actions', className: 'w-px text-right' },
];

const CostCenters = () => {
  const { data: centers = [], isLoading, isError } = useCostCenters();
  const create = useCreateCostCenter();
  const update = useUpdateCostCenter();
  const remove = useDeleteCostCenter();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CostCenter | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CostCenterFormInput, unknown, CostCenterFormData>({
    defaultValues: EMPTY,
    resolver: zodResolver(costCenterFormSchema),
  });

  const openForm = (c: CostCenter | null) => {
    setEditing(c);
    reset(c ? { name: c.name, code: c.code ?? '', is_active: c.is_active } : EMPTY);
    setOpen(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else await create.mutateAsync(data);
      setOpen(false);
    } catch {
      // onError already toasts
    }
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Cost Centers" subtitle="Tag vouchers by department, project or activity.">
        <Button type="button" onClick={() => openForm(null)}>
          <Plus /> Add cost center
        </Button>
      </PageTitle>

      <DataTable columns={columns} minWidth="30rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={centers.length === 0}
          emptyText="No cost centers yet."
        />
        {!isLoading &&
          centers.map((c) => (
            <tr key={c.id} className="bg-card hover:bg-muted/40">
              <td className={td}>
                <button
                  type="button"
                  onClick={() => openForm(c)}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </button>
              </td>
              <td className={`${td} text-muted-foreground`}>{c.code ?? '—'}</td>
              <td className={td}>
                {c.is_active ? 'Active' : <span className="text-muted-foreground">Inactive</span>}
              </td>
              <td className={`${td} text-right`}>
                <RowActions
                  label={c.name}
                  onEdit={() => openForm(c)}
                  onDelete={() => setDeleteTarget(c)}
                />
              </td>
            </tr>
          ))}
      </DataTable>

      <FormPopup
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit cost center' : 'Add cost center'}
        onSubmit={onSubmit}
        saving={create.isPending || update.isPending}
        submitLabel={editing ? 'Save changes' : 'Add cost center'}
        size="md"
      >
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="Code">
          <Input {...register('code')} placeholder="Optional" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_active')} className="h-4 w-4" /> Active
        </label>
      </FormPopup>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete cost center"
        msg={`Delete "${deleteTarget?.name ?? 'this cost center'}"? This cannot be undone.`}
      />
    </div>
  );
};

export default CostCenters;
