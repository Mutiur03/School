import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import {
  ACC_HEAD_TYPES,
  accHeadFormSchema,
  type AccHeadFormData,
  type AccHeadFormInput,
  type AccHeadType,
} from '@school/shared-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmationPopup } from '@/components';
import {
  useAccHeads,
  useCreateAccHead,
  useDeleteAccHead,
  useUpdateAccHead,
} from '@/queries/accounts.queries';
import type { AccHead } from '@/types/accounts';
import { DataTable, Field, FormPopup, PageTitle, RowActions, StateRows, td } from './ui';
import { TYPE_LABELS, groupByType, selectClass } from './heads';

const EMPTY: AccHeadFormInput = {
  name: '',
  code: '',
  type: 'expense',
  parent_id: '',
  is_cash_bank: false,
  bank_name: '',
  account_no: '',
  is_active: true,
};

const columns = [
  { label: 'Name' },
  { label: 'Code', className: 'w-28' },
  { label: 'Cash / bank', className: 'w-56' },
  { label: 'Status', className: 'w-24' },
  { label: 'Actions', className: 'w-px text-right' },
];

const AccountHeads = () => {
  const { data: heads = [], isLoading, isError } = useAccHeads();
  const createHead = useCreateAccHead();
  const updateHead = useUpdateAccHead();
  const deleteHead = useDeleteAccHead();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccHead | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AccHeadFormInput, unknown, AccHeadFormData>({
    defaultValues: EMPTY,
    resolver: zodResolver(accHeadFormSchema),
  });
  const type = watch('type') as AccHeadType;
  const isCashBank = watch('is_cash_bank');
  const parentOptions = heads.filter((h) => h.type === type && h.id !== editing?.id);

  const openForm = (head: AccHead | null, presetType?: AccHeadType) => {
    setEditing(head);
    reset(
      head
        ? {
            name: head.name,
            code: head.code ?? '',
            type: head.type,
            parent_id: head.parent_id ? String(head.parent_id) : '',
            is_cash_bank: head.is_cash_bank,
            bank_name: head.bank_name ?? '',
            account_no: head.account_no ?? '',
            is_active: head.is_active,
          }
        : { ...EMPTY, type: presetType ?? EMPTY.type },
    );
    setOpen(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    // Cash/bank only applies to assets; drop stale bank details otherwise.
    const cash = data.type === 'asset' && data.is_cash_bank;
    const payload: AccHeadFormData = {
      ...data,
      parent_id: parentOptions.some((p) => p.id === data.parent_id) ? data.parent_id : null,
      is_cash_bank: cash,
      bank_name: cash ? data.bank_name : null,
      account_no: cash ? data.account_no : null,
    };
    try {
      if (editing) await updateHead.mutateAsync({ id: editing.id, data: payload });
      else await createHead.mutateAsync(payload);
      setOpen(false);
    } catch {
      // onError already toasts
    }
  });

  const groups = groupByType(heads);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Account Heads"
        subtitle={isLoading ? undefined : `${heads.length} heads in the chart of accounts`}
      >
        <Button type="button" onClick={() => openForm(null)}>
          <Plus /> Add head
        </Button>
      </PageTitle>

      <DataTable columns={columns}>
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={heads.length === 0}
          emptyText="No account heads yet. Add your first one."
        />
        {!isLoading &&
          heads.length > 0 &&
          groups.map(({ type: t, rows }) => [
            <tr key={t} className="bg-muted/40">
              <td colSpan={columns.length} className="px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {TYPE_LABELS[t]}{' '}
                    <span className="text-muted-foreground font-normal">({rows.length})</span>
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => openForm(null, t)}>
                    <Plus /> Add
                  </Button>
                </div>
              </td>
            </tr>,
            ...rows.map(({ head: h, depth }) => (
              <tr key={h.id} className="bg-card hover:bg-muted/40">
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => openForm(h)}
                    className="text-left font-medium hover:underline"
                    style={{ paddingLeft: `${depth * 1.25}rem` }}
                  >
                    {depth > 0 && <span className="text-muted-foreground mr-1">└</span>}
                    {h.name}
                  </button>
                </td>
                <td className={`${td} text-muted-foreground tabular-nums`}>{h.code ?? '—'}</td>
                <td className={`${td} text-muted-foreground`}>
                  {h.is_cash_bank ? (
                    <span>
                      <Badge variant="secondary">Cash/Bank</Badge>{' '}
                      {[h.bank_name, h.account_no].filter(Boolean).join(' · ')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
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
            )),
          ])}
      </DataTable>

      <FormPopup
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit account head' : 'Add account head'}
        onSubmit={onSubmit}
        saving={createHead.isPending || updateHead.isPending}
        submitLabel={editing ? 'Save changes' : 'Add head'}
      >
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="e.g. Tuition Fee" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <Input {...register('code')} placeholder="Optional" />
          </Field>
          <Field label="Type" required error={errors.type?.message}>
            <select {...register('type')} className={selectClass}>
              {ACC_HEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Parent head">
          <select {...register('parent_id')} className={selectClass}>
            <option value="">— None (top level) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} · ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </Field>
        {type === 'asset' && (
          <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input type="checkbox" {...register('is_cash_bank')} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="block text-sm font-medium">Cash / bank account</span>
              <span className="text-muted-foreground block text-sm">
                Money can be received into or paid from this head.
              </span>
            </span>
          </label>
        )}
        {type === 'asset' && isCashBank && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name">
              <Input {...register('bank_name')} placeholder="Leave empty for cash" />
            </Field>
            <Field label="Account no.">
              <Input {...register('account_no')} />
            </Field>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_active')} className="h-4 w-4" /> Active
        </label>
      </FormPopup>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteHead.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete head"
        msg={`Delete "${deleteTarget?.name ?? 'this head'}"? Heads used in vouchers cannot be deleted.`}
      />
    </div>
  );
};

export default AccountHeads;
