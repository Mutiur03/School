import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationPopup } from '@/components';
import { useAccYears, useCloseYear, useReopenYear } from '@/queries/accounts.queries';
import type { AccYear } from '@/types/accounts';
import { formatDay, formatMoney } from '@/lib/utils';
import { DataTable, Money, PageTitle, StateRows, num, td } from './ui';

const columns = [
  { label: 'Year', className: 'w-28' },
  { label: 'Income', className: 'w-36 text-right' },
  { label: 'Expense', className: 'w-36 text-right' },
  { label: 'Surplus / deficit', className: 'w-44 text-right' },
  { label: 'Status', className: 'w-44' },
  { label: 'Actions', className: 'w-px text-right' },
];

const FiscalYears = () => {
  const { data: years = [], isLoading, isError } = useAccYears();
  const close = useCloseYear();
  const reopen = useReopenYear();
  const [closing, setClosing] = useState<AccYear | null>(null);
  const [reopening, setReopening] = useState<AccYear | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Fiscal Years"
        subtitle="Close a year when its books are final. Results move into Retained Earnings and the year is locked."
      />

      <DataTable columns={columns} minWidth="44rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={years.length === 0}
          emptyText="No years yet."
        />
        {years.map((y) => (
          <tr key={y.year} className="bg-card">
            <td className={`${td} font-medium tabular-nums`}>{y.year}</td>
            <td className={num}>
              <Money value={y.income} />
            </td>
            <td className={num}>
              <Money value={y.expense} />
            </td>
            <td className={num}>
              <span className={y.net < 0 ? 'text-destructive' : undefined}>
                <Money value={Math.abs(y.net)} /> {y.net < 0 ? 'deficit' : 'surplus'}
              </span>
            </td>
            <td className={td}>
              {y.closed ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" /> Closed
                  {y.closed_at && ` ${formatDay(y.closed_at)}`}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Open</span>
              )}
            </td>
            <td className={`${td} text-right`}>
              {y.closed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!y.can_reopen}
                  title={y.can_reopen ? undefined : 'Reopen the later closed year first'}
                  onClick={() => setReopening(y)}
                >
                  <LockOpen /> Reopen
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!y.can_close}
                  title={y.can_close ? undefined : 'Close the earlier open year first'}
                  onClick={() => setClosing(y)}
                >
                  <Lock /> Close year
                </Button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <ConfirmationPopup
        open={closing !== null}
        onOpenChange={(o) => !o && setClosing(null)}
        variant="default"
        title={`Close ${closing?.year ?? ''}?`}
        confirmLabel="Close year"
        msg={
          closing
            ? `The ${closing.net < 0 ? 'deficit' : 'surplus'} of ${formatMoney(Math.abs(closing.net))} moves into Retained Earnings and ${closing.year + 1} starts with zero income and expense. No voucher or fee receipt dated in ${closing.year} can be added, changed or deleted until you reopen it.`
            : undefined
        }
        onConfirm={() => {
          if (closing) close.mutate(closing.year);
          setClosing(null);
        }}
      />
      <ConfirmationPopup
        open={reopening !== null}
        onOpenChange={(o) => !o && setReopening(null)}
        variant="default"
        title={`Reopen ${reopening?.year ?? ''}?`}
        confirmLabel="Reopen year"
        msg={
          reopening
            ? `The ${reopening.year} closing entry is removed and entries in that year can be changed again. Close it once you have finished.`
            : undefined
        }
        onConfirm={() => {
          if (reopening) reopen.mutate(reopening.year);
          setReopening(null);
        }}
      />
    </div>
  );
};

export default FiscalYears;
