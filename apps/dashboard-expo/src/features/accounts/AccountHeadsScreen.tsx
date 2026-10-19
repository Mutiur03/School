/**
 * Account Heads, replicating dashboard/src/pages/Admin/Accounts/AccountHeads.tsx: the chart of
 * accounts grouped by type (Assets, Liabilities, Equity, Income, Expenses) with "+ Add" per type,
 * children indented under parents, Code, Cash / bank details, Opening and Status; the add / edit
 * dialog (Name, Code, Type, Parent head, Cash / bank, Bank name, Account no., Opening balance on
 * the natural side + As of, Active) and delete behind a confirm. The opening balance is parsed
 * exactly into paisa; changing it moves the opening voucher, so that save asks first.
 * Live data: GET/POST/PATCH/DELETE /api/acc-heads (admin, this school).
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import {
  ACC_TYPES,
  OPENING_EQUITY,
  OPENING_SIDE,
  TYPE_LABELS,
  accHeadInput,
  canHaveOpening,
  defaultOpeningDate,
  groupByType,
  openingChanged,
  type AccHeadForm,
} from '@/features/accounts/model';
import { MONEY_KEYS, useAccHeads } from '@/features/finance/queries';
import { Money, MoneyInput } from '@/features/finance/ui';
import type { AccHead, AccHeadInput } from '@/lib/api';
import { formatMoney, moneyText, ZERO } from '@/lib/money/money';
import type { AccHeadType } from '@school/shared-schemas';
import { useApi } from '@/session/ApiProvider';

type Row =
  | { kind: 'group'; type: AccHeadType; count: number }
  | { kind: 'head'; head: AccHead; depth: number };

const EMPTY: AccHeadForm = {
  name: '',
  code: '',
  type: 'expense',
  parent_id: null,
  is_cash_bank: false,
  bank_name: '',
  account_no: '',
  is_active: true,
  opening_balance: '',
  opening_date: '',
};

export function AccountHeadsScreen() {
  const { accounts } = useApi();
  const flight = useSingleFlight();
  const q = useAccHeads();
  const heads = q.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccHead | null>(null);
  const [pending, setPending] = useState<AccHeadInput | null>(null);
  const { control, handleSubmit, reset, watch, setError } = useForm<AccHeadForm>({
    defaultValues: EMPTY,
  });
  const type = watch('type');
  const isCashBank = watch('is_cash_bank');
  const parentOptions = heads.filter((h) => h.type === type && h.id !== editing?.id);
  const openingDate = heads.find((h) => h.opening_date)?.opening_date ?? defaultOpeningDate();

  const save = useAdminMutation({
    mutationFn: async (input: AccHeadInput) => {
      if (editing) await accounts.updateHead(editing.id, input);
      else await accounts.createHead(input);
    },
    invalidate: MONEY_KEYS,
    success: () => (editing ? 'Account head updated.' : 'Account head added.'),
    failure: editing ? 'Failed to update the head.' : 'Failed to add the head.',
    onSuccess: () => {
      setPending(null);
      setOpen(false);
    },
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => accounts.deleteHead(id),
    invalidate: [['acc-heads']],
    success: 'Account head deleted.',
    failure: 'Failed to delete the head.',
    onSuccess: () => setDeleteTarget(null),
  });

  const openForm = (h: AccHead | null, preset?: AccHeadType) => {
    setEditing(h);
    reset(
      h
        ? {
            name: h.name,
            code: h.code ?? '',
            type: h.type,
            parent_id: h.parent_id,
            is_cash_bank: h.is_cash_bank,
            bank_name: h.bank_name ?? '',
            account_no: h.account_no ?? '',
            is_active: h.is_active,
            opening_balance: moneyText(h.opening_balance),
            opening_date: openingDate,
          }
        : { ...EMPTY, type: preset ?? EMPTY.type, opening_date: openingDate },
    );
    setOpen(true);
  };
  const send = (input: AccHeadInput) =>
    void flight.run(() => save.mutateAsync(input)).catch(() => {});
  const submit = handleSubmit((f) => {
    const r = accHeadInput(f, editing, heads);
    if (!r.ok) return setError(r.field, { message: r.error });
    if (openingChanged(editing, r.input)) setPending(r.input);
    else send(r.input);
  });

  const rows: Row[] = heads.length
    ? groupByType(heads).flatMap((g) => [
        { kind: 'group' as const, type: g.type, count: g.rows.length },
        ...g.rows.map((r) => ({ kind: 'head' as const, head: r.head, depth: r.depth })),
      ])
    : [];

  const actions = (h: AccHead) => (
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
  const groupLabel = (r: Extract<Row, { kind: 'group' }>) => (
    <Text size="sm" weight="semibold">
      {TYPE_LABELS[r.type]}{' '}
      <Text size="sm" color="mutedForeground">
        ({r.count})
      </Text>
    </Text>
  );
  const nameCell = (h: AccHead, depth: number) => (
    <Text size="sm" weight="medium" numberOfLines={1} style={{ paddingLeft: depth * 20 }}>
      {depth > 0 ? (
        <Text size="sm" color="mutedForeground">
          └{' '}
        </Text>
      ) : null}
      {h.name}
    </Text>
  );
  const opening = (h: AccHead) =>
    h.opening_balance && h.name !== OPENING_EQUITY ? (
      <Money value={h.opening_balance} />
    ) : (
      <Text size="sm" color="mutedForeground">
        —
      </Text>
    );
  const columns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      className: 'min-w-0 flex-1',
      render: (r) => (r.kind === 'group' ? groupLabel(r) : nameCell(r.head, r.depth)),
    },
    {
      key: 'code',
      label: 'Code',
      className: 'w-28',
      render: (r) =>
        r.kind === 'head' ? (
          <Text size="sm" color="mutedForeground" tabular>
            {r.head.code ?? '—'}
          </Text>
        ) : null,
    },
    {
      key: 'cash',
      label: 'Cash / bank',
      className: 'w-56',
      render: (r) =>
        r.kind === 'head' ? (
          r.head.is_cash_bank ? (
            <View className="flex-row items-center gap-2">
              <Badge label="Cash/Bank" variant="secondary" />
              <Text size="xs" color="mutedForeground" numberOfLines={1} className="shrink">
                {[r.head.bank_name, r.head.account_no].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : (
            <Text size="sm" color="mutedForeground">
              —
            </Text>
          )
        ) : null,
    },
    {
      key: 'opening',
      label: 'Opening',
      className: 'w-36',
      align: 'right',
      render: (r) => (r.kind === 'head' ? opening(r.head) : null),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-24',
      render: (r) =>
        r.kind === 'head' ? (
          <Text size="sm" color={r.head.is_active ? undefined : 'mutedForeground'}>
            {r.head.is_active ? 'Active' : 'Inactive'}
          </Text>
        ) : null,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[96px]',
      align: 'right',
      render: (r) =>
        r.kind === 'group' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            label="Add"
            onPress={() => openForm(null, r.type)}
          />
        ) : (
          actions(r.head)
        ),
    },
  ];

  return (
    <PageLayout
      title="Account Heads"
      description={q.isPending ? undefined : `${heads.length} heads in the chart of accounts`}
      actions={
        <Button icon={Plus} label="Add head" onPress={() => openForm(null)} testID="add-acc-head" />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load account heads"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="acc-heads"
          rows={rows}
          columns={columns}
          rowKey={(r) => (r.kind === 'group' ? `g-${r.type}` : r.head.id)}
          loading={q.isPending}
          empty="No account heads yet. Add your first one."
          renderMobile={(r) =>
            r.kind === 'group' ? (
              <View className="flex-row items-center justify-between">
                {groupLabel(r)}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  label="Add"
                  onPress={() => openForm(null, r.type)}
                />
              </View>
            ) : (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  {nameCell(r.head, r.depth)}
                  <Text
                    size="xs"
                    color="mutedForeground"
                    numberOfLines={1}
                    style={{ paddingLeft: r.depth * 20 }}
                  >
                    {[
                      r.head.code,
                      r.head.is_cash_bank ? 'Cash/Bank' : null,
                      r.head.is_active ? null : 'Inactive',
                    ]
                      .filter(Boolean)
                      .join(' · ') || ' '}
                  </Text>
                </View>
                {opening(r.head)}
                {actions(r.head)}
              </View>
            )
          }
        />
      )}

      <Dialog
        open={open}
        onClose={() => (save.isPending ? undefined : setOpen(false))}
        title={editing ? 'Edit account head' : 'Add account head'}
        testID="acc-head-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setOpen(false)}
              disabled={save.isPending}
            />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add head'}
              onPress={() => void submit()}
              disabled={save.isPending}
              testID="acc-head-submit"
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
        <FieldRow>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <Field label="Code">
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="Optional"
                  maxLength={20}
                  accessibilityLabel="Code"
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Field label="Type" required>
                <Select
                  label="Type"
                  value={field.value}
                  onChange={field.onChange}
                  options={ACC_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                />
              </Field>
            )}
          />
        </FieldRow>
        <Controller
          control={control}
          name="parent_id"
          render={({ field }) => (
            <Field label="Parent head">
              <Select
                label="Parent head"
                value={field.value ?? 0}
                onChange={(v) => field.onChange(v || null)}
                options={[
                  { value: 0, label: '— None (top level) —' },
                  ...parentOptions.map((p) => ({
                    value: p.id,
                    label: p.code ? `${p.code} · ${p.name}` : p.name,
                  })),
                ]}
              />
            </Field>
          )}
        />
        {type === 'asset' ? (
          <Controller
            control={control}
            name="is_cash_bank"
            render={({ field }) => (
              <Checkbox
                boxed
                checked={field.value}
                onChange={field.onChange}
                label="Cash / bank account"
                description="Money can be received into or paid from this head."
              />
            )}
          />
        ) : null}
        {type === 'asset' && isCashBank ? (
          <FieldRow>
            <Controller
              control={control}
              name="bank_name"
              render={({ field }) => (
                <Field label="Bank name">
                  <Input
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="Leave empty for cash"
                    maxLength={150}
                    accessibilityLabel="Bank name"
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="account_no"
              render={({ field }) => (
                <Field label="Account no.">
                  <Input
                    value={field.value}
                    onChangeText={field.onChange}
                    maxLength={50}
                    accessibilityLabel="Account number"
                  />
                </Field>
              )}
            />
          </FieldRow>
        ) : null}
        {canHaveOpening(type, editing) ? (
          <>
            <FieldRow>
              <Controller
                control={control}
                name="opening_balance"
                render={({ field, fieldState }) => (
                  <Field
                    label={`Opening balance (${OPENING_SIDE[type]})`}
                    error={fieldState.error?.message}
                  >
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      label="Opening balance"
                      allowNegative
                      invalid={!!fieldState.error}
                      testID="opening-balance"
                    />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="opening_date"
                render={({ field, fieldState }) => (
                  <Field label="As of" error={fieldState.error?.message}>
                    <DateInput
                      label="As of"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!fieldState.error}
                    />
                  </Field>
                )}
              />
            </FieldRow>
            <Text size="xs" color="mutedForeground">
              What this account held when you started using the system. One date applies to all
              opening balances.
            </Text>
          </>
        ) : null}
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} label="Active" />
          )}
        />
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        tone="default"
        title="Change the opening balance?"
        message={`The opening balance of ${pending?.name ?? ''} becomes ${formatMoney(pending?.opening_balance ?? ZERO)} as of ${pending?.opening_date ?? ''}. The opening-balances voucher is updated and Opening Balance Equity takes the difference.`}
        confirmLabel={save.isPending ? 'Saving…' : 'Save'}
        busy={save.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && send(pending)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Delete "${deleteTarget?.name ?? 'this head'}"? Heads used in vouchers cannot be deleted.`}
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete head'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
