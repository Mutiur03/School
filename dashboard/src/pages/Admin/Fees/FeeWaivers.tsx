import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationPopup } from '@/components';
import ActionButton from '@/components/ActionButton';
import {
  useCreateFeeWaiver,
  useDeleteFeeWaiver,
  useFeeHeads,
  useFeeWaivers,
} from '@/queries/fees.queries';
import type { FeeWaiver } from '@/types/fees';
import { DataTable, Field, FormPopup, Money, PageTitle, StateRows, num, td } from '../Accounts/ui';
import { selectClass } from '../Accounts/heads';
import { THIS_YEAR } from './constants';
import { StudentPicker, YearSelect, type PickedStudent } from './shared';

const columns = [
  { label: 'Student' },
  { label: 'Fee' },
  { label: 'Waiver', className: 'w-40 text-right' },
  { label: 'Note' },
  { label: 'Actions', className: 'w-px text-right' },
];

const FeeWaivers = () => {
  const [year, setYear] = useState(THIS_YEAR);
  const { data: waivers = [], isLoading, isError } = useFeeWaivers({ year });
  const { data: heads = [] } = useFeeHeads();
  const create = useCreateFeeWaiver();
  const remove = useDeleteFeeWaiver();

  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [headId, setHeadId] = useState('');
  const [percent, setPercent] = useState(false);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FeeWaiver | null>(null);

  const openForm = () => {
    setStudent(null);
    setHeadId('');
    setPercent(false);
    setValue('');
    setNote('');
    setOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return toast.error('Pick a student');
    const amount = Number(value);
    if (!(amount > 0)) return toast.error('Enter a waiver amount');
    try {
      await create.mutateAsync({
        student_id: student.id,
        year,
        fee_head_id: headId ? Number(headId) : undefined,
        percent,
        value: amount,
        note: note.trim() || undefined,
      });
      setOpen(false);
    } catch {
      // onError already toasts
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Fee Waivers"
        subtitle="Per-student concessions, applied to every installment."
      >
        <Button type="button" onClick={openForm}>
          <Plus /> Add waiver
        </Button>
      </PageTitle>

      <div className="mb-4">
        <YearSelect value={year} onChange={setYear} />
      </div>

      <DataTable columns={columns} minWidth="42rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={waivers.length === 0}
          emptyText={`No waivers in ${year}.`}
        />
        {!isLoading &&
          waivers.map((w) => (
            <tr key={w.id} className="bg-card hover:bg-muted/40">
              <td className={td}>
                <p className="font-medium">{w.student.name}</p>
                <p className="text-muted-foreground text-xs">ID {String(w.student.login_id)}</p>
              </td>
              <td className={td}>
                {w.fee_head?.name ?? <span className="text-muted-foreground">All fees</span>}
              </td>
              <td className={num}>{w.percent ? `${w.value}%` : <Money value={w.value} />}</td>
              <td className={`${td} text-muted-foreground`}>{w.note ?? '—'}</td>
              <td className={`${td} text-right`}>
                <ActionButton
                  iconOnly
                  label="Remove waiver"
                  icon={<Trash2 size={16} />}
                  onClick={() => setDeleteTarget(w)}
                />
              </td>
            </tr>
          ))}
      </DataTable>

      <FormPopup
        open={open}
        onClose={() => setOpen(false)}
        title="Add waiver"
        onSubmit={onSubmit}
        saving={create.isPending}
        submitLabel="Add waiver"
        size="xl"
      >
        <StudentPicker year={year} value={student?.id ?? null} onChange={setStudent} />
        <Field label="Applies to">
          <select
            value={headId}
            onChange={(e) => setHeadId(e.target.value)}
            className={selectClass}
          >
            <option value="">All waivable fees</option>
            {heads
              .filter((h) => h.is_waivable)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              value={percent ? 'percent' : 'fixed'}
              onChange={(e) => setPercent(e.target.value === 'percent')}
              className={selectClass}
            >
              <option value="fixed">Fixed amount per installment</option>
              <option value="percent">Percent of the fee</option>
            </select>
          </Field>
          <Field label={percent ? 'Percent' : 'Amount'} required>
            <Input
              type="number"
              min={0}
              max={percent ? 100 : undefined}
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Note">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Orphan, sibling discount"
          />
        </Field>
      </FormPopup>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Remove waiver"
        msg={`Remove the waiver for ${deleteTarget?.student.name ?? 'this student'}? Their unpaid fees go back to the full amount.`}
      />
    </div>
  );
};

export default FeeWaivers;
