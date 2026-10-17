import { useEffect, useState } from 'react';
import { Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCopyFeeStructure,
  useFeeHeads,
  useFeeStructure,
  useSetFeeStructure,
} from '@/queries/fees.queries';
import { DataTable, PageTitle, StateRows, td } from '../Accounts/ui';
import { THIS_YEAR } from './constants';
import { ClassSelect, YearSelect } from './shared';

const columns = [
  { label: 'Fee' },
  { label: 'Charged', className: 'w-32' },
  { label: 'Amount (per installment)', className: 'w-56 text-right' },
];

/** Amount each class pays per fee head in a session. Empty amount = not charged. */
const FeeStructure = () => {
  const [year, setYear] = useState(THIS_YEAR);
  const [cls, setCls] = useState<number | ''>('');
  const { data: heads = [], isLoading: headsLoading } = useFeeHeads();
  const { data: rows, isLoading, isError } = useFeeStructure(year, cls || undefined);
  const save = useSetFeeStructure();
  const copy = useCopyFeeStructure();

  // fee_head_id → amount text, rebuilt whenever the saved structure changes
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  useEffect(() => {
    setAmounts(Object.fromEntries((rows ?? []).map((r) => [r.fee_head_id, String(r.amount)])));
  }, [rows]);

  const items = heads
    .filter((h) => amounts[h.id]?.trim())
    .map((h) => ({ fee_head_id: h.id, amount: Number(amounts[h.id]) }));
  const invalid = items.some((i) => !(i.amount > 0));

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Fee Structure" subtitle="What each class pays in a session.">
        <Button
          type="button"
          variant="outline"
          disabled={copy.isPending}
          onClick={() => copy.mutate({ from_year: year - 1, to_year: year })}
        >
          <Copy /> Copy classes from {year - 1}
        </Button>
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <YearSelect value={year} onChange={setYear} />
        <ClassSelect value={cls} onChange={setCls} />
        {cls !== '' && (
          <Button
            type="button"
            disabled={save.isPending || invalid}
            onClick={() => save.mutate({ year, class: cls, items })}
          >
            <Save /> Save class {cls} fees
          </Button>
        )}
      </div>

      {cls === '' ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Pick a class to edit its fees.
        </p>
      ) : (
        <DataTable columns={columns} minWidth="32rem">
          <StateRows
            colSpan={columns.length}
            loading={isLoading || headsLoading}
            error={isError}
            empty={heads.length === 0}
            emptyText="Add fee heads first."
          />
          {!isLoading &&
            heads.map((h) => (
              <tr key={h.id} className="bg-card">
                <td className={td}>
                  {h.name}
                  {!h.is_active && <span className="text-muted-foreground"> (inactive)</span>}
                </td>
                <td className={`${td} text-muted-foreground`}>
                  {h.frequency === 'monthly' ? 'Every month' : 'Once'}
                </td>
                <td className={`${td} text-right`}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={amounts[h.id] ?? ''}
                    onChange={(e) => setAmounts((a) => ({ ...a, [h.id]: e.target.value }))}
                    placeholder="Not charged"
                    aria-label={`${h.name} amount`}
                    className="ml-auto w-44 text-right"
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}
    </div>
  );
};

export default FeeStructure;
