/**
 * Fee Waivers, replicating dashboard/src/pages/Admin/Fees/FeeWaivers.tsx: session, the waivers
 * table (Student + ID, Fee or "All fees", Waiver as % or amount, Note, remove) and the Add waiver
 * dialog (student picker, Applies to, Type, Percent / Amount, Note). Amounts and percentages are
 * parsed exactly (≤ 2 decimals, percent ≤ 100, as the server validates). Save can't be sent twice
 * and removing goes through a confirm.
 * Edit (not on the web page; PATCH /api/fee-waivers/:id exists) changes Applies to, Type, value
 * and Note; the student is fixed, as the server requires.
 * Live data: GET/POST/PATCH/DELETE /api/fee-waivers, GET /api/fee-heads, GET /api/students.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import {
  amountText,
  waiverInput,
  waiverValueLabel,
  type PickerStudent,
} from '@/features/fees/model';
import { StudentPicker } from '@/features/fees/StudentPicker';
import { useFeeHeads, useFinanceKey } from '@/features/finance/queries';
import { MoneyInput, YearSelect } from '@/features/finance/ui';
import type { FeeWaiver, FeeWaiverInput } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

export function FeeWaiversScreen() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const toast = useToast();
  const flight = useSingleFlight();
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useQuery({ queryKey: key('fee-waivers', year), queryFn: () => fees.waivers({ year }) });
  const heads = useFeeHeads();
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<PickerStudent | null>(null);
  const [headId, setHeadId] = useState(0);
  const [percent, setPercent] = useState(false);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeWaiver | null>(null);
  const [editing, setEditing] = useState<FeeWaiver | null>(null);

  const create = useAdminMutation({
    mutationFn: (input: FeeWaiverInput) => fees.createWaiver(input),
    invalidate: [['fee-waivers'], ['fee-statement'], ['fee-dues']],
    success: 'Waiver added.',
    failure: 'Failed to add the waiver.',
    onSuccess: () => setOpen(false),
  });
  const update = useAdminMutation({
    mutationFn: (v: { id: number; input: FeeWaiverInput }) => fees.updateWaiver(v.id, v.input),
    invalidate: [['fee-waivers'], ['fee-statement'], ['fee-dues']],
    success: 'Waiver updated.',
    failure: 'Failed to update the waiver.',
    onSuccess: () => setOpen(false),
  });
  const saving = create.isPending || update.isPending;
  const remove = useAdminMutation({
    mutationFn: (id: number) => fees.deleteWaiver(id),
    invalidate: [['fee-waivers'], ['fee-statement'], ['fee-dues']],
    success: 'Waiver removed.',
    failure: 'Failed to remove the waiver.',
    onSuccess: () => setDeleteTarget(null),
  });

  const openForm = () => {
    setEditing(null);
    setStudent(null);
    setHeadId(0);
    setPercent(false);
    setValue('');
    setNote('');
    setError(null);
    setOpen(true);
  };
  const openEdit = (w: FeeWaiver) => {
    setEditing(w);
    setStudent(null);
    setHeadId(w.fee_head_id ?? 0);
    setPercent(w.percent);
    setValue(amountText(w.value));
    setNote(w.note ?? '');
    setError(null);
    setOpen(true);
  };
  const submit = () => {
    const r = waiverInput({
      studentId: editing ? editing.student_id : (student?.id ?? null),
      year: editing ? editing.year : year,
      feeHeadId: headId || null,
      percent,
      value,
      note,
    });
    if (!r.ok) {
      setError(r.error);
      toast.error(r.error);
      return;
    }
    setError(null);
    const target = editing;
    void flight
      .run(() =>
        target
          ? update.mutateAsync({ id: target.id, input: r.input })
          : create.mutateAsync(r.input),
      )
      .catch(() => {});
  };

  const waivers = q.data ?? [];
  const actions = (w: FeeWaiver) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit waiver for ${w.student?.name ?? 'student'}`}
        tone="emerald"
        onPress={() => openEdit(w)}
      />
      <ActionButton
        icon={Trash2}
        label="Remove waiver"
        tone="red"
        onPress={() => setDeleteTarget(w)}
      />
    </View>
  );
  const columns: Column<FeeWaiver>[] = [
    {
      key: 'student',
      label: 'Student',
      className: 'min-w-0 flex-1',
      render: (w) => (
        <View>
          <Text size="sm" weight="medium" numberOfLines={1}>
            {w.student?.name ?? '—'}
          </Text>
          <Text size="xs" color="mutedForeground">
            ID {w.student?.login_id ?? '—'}
          </Text>
        </View>
      ),
    },
    {
      key: 'fee',
      label: 'Fee',
      className: 'min-w-0 flex-1',
      render: (w) => (
        <Text size="sm" color={w.fee_head ? undefined : 'mutedForeground'}>
          {w.fee_head?.name ?? 'All fees'}
        </Text>
      ),
    },
    {
      key: 'value',
      label: 'Waiver',
      className: 'w-40',
      align: 'right',
      render: (w) => (
        <Text size="sm" tabular>
          {waiverValueLabel(w)}
        </Text>
      ),
    },
    {
      key: 'note',
      label: 'Note',
      className: 'min-w-0 flex-1',
      render: (w) => (
        <Text size="sm" color="mutedForeground" numberOfLines={1}>
          {w.note ?? '—'}
        </Text>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[96px]',
      align: 'right',
      render: (w) => actions(w),
    },
  ];

  return (
    <PageLayout
      title="Fee Waivers"
      description="Per-student concessions, applied to every installment."
      actions={<Button icon={Plus} label="Add waiver" onPress={openForm} testID="add-waiver" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <View>
        <YearSelect value={year} onChange={setYear} />
      </View>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load waivers"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="fee-waivers"
          rows={waivers}
          columns={columns}
          rowKey={(w) => w.id}
          loading={q.isPending}
          empty={`No waivers in ${year}.`}
          renderMobile={(w) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {w.student?.name ?? '—'}
                </Text>
                <Text size="xs" color="mutedForeground" numberOfLines={1}>
                  {`${w.fee_head?.name ?? 'All fees'}${w.note ? ` · ${w.note}` : ''}`}
                </Text>
              </View>
              <Text size="sm" weight="semibold" tabular>
                {waiverValueLabel(w)}
              </Text>
              {actions(w)}
            </View>
          )}
        />
      )}

      <Dialog
        open={open}
        onClose={() => (saving ? undefined : setOpen(false))}
        title={editing ? 'Edit waiver' : 'Add waiver'}
        size="xl"
        testID="waiver-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setOpen(false)}
              disabled={saving}
            />
            <Button
              label={saving ? 'Saving…' : editing ? 'Save changes' : 'Add waiver'}
              onPress={submit}
              disabled={saving}
              testID="waiver-submit"
            />
          </>
        }
      >
        {editing ? (
          <Field
            label="Student"
            hint="To move a waiver to another student, remove it and add a new one."
          >
            <Text size="sm" weight="medium">
              {`${editing.student?.name ?? '—'} · ID ${editing.student?.login_id ?? '—'}`}
            </Text>
          </Field>
        ) : (
          <StudentPicker year={year} value={student?.id ?? null} onChange={setStudent} />
        )}
        <Field label="Applies to">
          <Select
            label="Applies to"
            value={headId}
            onChange={setHeadId}
            options={[
              { value: 0, label: 'All waivable fees' },
              ...(heads.data ?? [])
                .filter((h) => h.is_waivable)
                .map((h) => ({ value: h.id, label: h.name })),
            ]}
          />
        </Field>
        <FieldRow>
          <Field label="Type">
            <Select
              label="Type"
              value={percent ? 'percent' : 'fixed'}
              onChange={(v) => setPercent(v === 'percent')}
              options={[
                { value: 'fixed', label: 'Fixed amount per installment' },
                { value: 'percent', label: 'Percent of the fee' },
              ]}
            />
          </Field>
          <Field label={percent ? 'Percent' : 'Amount'} required error={error ?? undefined}>
            <MoneyInput
              value={value}
              onChange={setValue}
              label={percent ? 'Percent' : 'Amount'}
              invalid={!!error}
              placeholder={percent ? '0-100' : '0.00'}
              testID="waiver-value"
            />
          </Field>
        </FieldRow>
        <Field label="Note">
          <Input
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Orphan, sibling discount"
            maxLength={255}
            accessibilityLabel="Note"
          />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Remove the waiver for ${deleteTarget?.student?.name ?? 'this student'}? Their unpaid fees go back to the full amount.`}
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove waiver'}
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && void flight.run(() => remove.mutateAsync(deleteTarget.id)).catch(() => {})
        }
      />
    </PageLayout>
  );
}
