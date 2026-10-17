import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationPopup } from '@/components';
import { useAccHeads } from '@/queries/accounts.queries';
import {
  useCreateFeeHead,
  useDeleteFeeHead,
  useFeeHeads,
  useUpdateFeeHead,
} from '@/queries/fees.queries';
import type { FeeHead, FeeHeadInput } from '@/types/fees';
import { DataTable, Field, FormPopup, PageTitle, RowActions, StateRows, td } from '../Accounts/ui';
import { selectClass } from '../Accounts/heads';

const EMPTY: FeeHeadInput = {
  name: '',
  frequency: 'monthly',
  income_head_id: 0,
  deposit_head_id: 0, // form value for "chosen at collection"; sent as null
  is_waivable: true,
  sort_order: 0,
  is_active: true,
};

const columns = [
  { label: 'Fee' },
  { label: 'Charged', className: 'w-28' },
  { label: 'Income account' },
  { label: 'Deposit account' },
  { label: 'Waivable', className: 'w-28' },
  { label: 'Status', className: 'w-28' },
  { label: 'Actions', className: 'w-px text-right' },
];

const FeeHeads = () => {
  const { data: heads = [], isLoading, isError } = useFeeHeads();
  const { data: accHeads = [] } = useAccHeads();
  const incomeHeads = accHeads.filter((h) => h.type === 'income' && h.is_active);
  const cashBankHeads = accHeads.filter((h) => h.is_cash_bank && h.is_active);
  const create = useCreateFeeHead();
  const update = useUpdateFeeHead();
  const remove = useDeleteFeeHead();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeHead | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FeeHeadInput>({ defaultValues: EMPTY });
  const name = watch('name');

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
            sort_order: h.sort_order,
            is_active: h.is_active,
          }
        : EMPTY,
    );
    setOpen(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    const body = {
      ...data,
      // select value 0 = new fee: server creates the income account
      income_head_id: Number(data.income_head_id) || undefined,
      // select value 0 = no fixed account (null clears it on edit)
      deposit_head_id: Number(data.deposit_head_id) || null,
      sort_order: Number(data.sort_order),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: body });
      else await create.mutateAsync(body);
      setOpen(false);
    } catch {
      // onError already toasts
    }
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Fee Heads"
        subtitle="What the school charges. Collected money is credited to the income account."
      >
        <Button type="button" onClick={() => openForm(null)}>
          <Plus /> Add fee head
        </Button>
      </PageTitle>

      <DataTable columns={columns} minWidth="42rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={heads.length === 0}
          emptyText="No fee heads yet."
        />
        {!isLoading &&
          heads.map((h) => (
            <tr key={h.id} className="bg-card hover:bg-muted/40">
              <td className={td}>
                <button
                  type="button"
                  onClick={() => openForm(h)}
                  className="font-medium hover:underline"
                >
                  {h.name}
                </button>
              </td>
              <td className={td}>{h.frequency === 'monthly' ? 'Every month' : 'Once'}</td>
              <td className={`${td} text-muted-foreground`}>{h.income_head.name}</td>
              <td className={`${td} text-muted-foreground`}>
                {h.deposit_head?.name ?? 'Chosen at collection'}
              </td>
              <td className={td}>{h.is_waivable ? 'Yes' : 'No'}</td>
              <td className={td}>
                {h.is_active ? 'Active' : <span className="text-muted-foreground">Inactive</span>}
              </td>
              <td className={`${td} text-right`}>
                <RowActions
                  label={h.name}
                  onEdit={() => openForm(h)}
                  onDelete={() => setDeleteTarget(h)}
                />
              </td>
            </tr>
          ))}
      </DataTable>

      <FormPopup
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit fee head' : 'Add fee head'}
        onSubmit={onSubmit}
        saving={create.isPending || update.isPending}
        submitLabel={editing ? 'Save changes' : 'Add fee head'}
        size="md"
      >
        <Field label="Name" required error={errors.name?.message}>
          <Input
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g. Tuition Fee"
          />
        </Field>
        <Field label="Charged">
          <select {...register('frequency')} className={selectClass}>
            <option value="monthly">Every month (Jan–Dec)</option>
            <option value="once">Once a year</option>
          </select>
        </Field>
        <Field label="Income account" error={errors.income_head_id?.message}>
          <select
            {...register('income_head_id', {
              validate: (v) => !editing || Number(v) > 0 || 'Pick an income account',
            })}
            className={selectClass}
          >
            {!editing && (
              <option value={0}>Create "{name.trim() || 'fee'} Fees" automatically</option>
            )}
            {incomeHeads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deposit account">
          <select {...register('deposit_head_id')} className={selectClass}>
            <option value={0}>Chosen at collection</option>
            {cashBankHeads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Set this when the fee always goes into one bank or cash account, for example admission
            into a separate bank account.
          </p>
        </Field>
        <Field label="Order">
          <Input type="number" min={0} {...register('sort_order')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_waivable')} className="h-4 w-4" /> Waivers apply
          to this fee
        </label>
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
        confirmLabel="Delete fee head"
        msg={`Delete "${deleteTarget?.name ?? 'this fee head'}"? Fee heads with collected fees cannot be deleted; mark them inactive instead.`}
      />
    </div>
  );
};

export default FeeHeads;
