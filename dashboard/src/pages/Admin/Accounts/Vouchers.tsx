import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { VoucherType } from '@school/shared-schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationPopup } from '@/components';
import { useAccYears, useDeleteVoucher, useVouchers } from '@/queries/accounts.queries';
import type { Voucher } from '@/types/accounts';
import { cn, formatDay, formatYmd } from '@/lib/utils';
import {
  DataTable,
  DateInput,
  Money,
  PageTitle,
  RowActions,
  StateRows,
  YearSelect,
  num,
  td,
} from './ui';
import VoucherForm from './VoucherForm';
import { VOUCHER_MODES, selectClass } from './heads';

const TYPE_STYLE: Record<VoucherType, string> = {
  receipt: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  payment: 'bg-red-500/15 text-red-700 dark:text-red-300',
  contra: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  journal: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};
const TYPE_LABEL = Object.fromEntries(VOUCHER_MODES.map((m) => [m.type, m.label])) as Record<
  VoucherType,
  string
>;

const columns = [
  { label: 'Voucher', className: 'w-28' },
  { label: 'Date', className: 'w-32' },
  { label: 'Type', className: 'w-28' },
  { label: 'Narration' },
  { label: 'Total', className: 'w-36 text-right' },
  { label: 'Actions', className: 'w-px text-right' },
];

const Vouchers = () => {
  const [type, setType] = useState<VoucherType | ''>('');
  // this year by default, like the reports; the Year dropdown reaches older years
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data: vouchers = [], isLoading, isError } = useVouchers({ type, from, to });
  const remove = useDeleteVoucher();
  const { data: years = [] } = useAccYears();
  // a closed year freezes every voucher dated in it
  const closedYears = new Set(years.filter((y) => y.closed).map((y) => y.year));
  const isLocked = (v: Voucher) =>
    !!(
      v.fee_receipt_no ||
      v.is_opening ||
      v.is_closing ||
      closedYears.has(Number(v.date.slice(0, 4)))
    );

  // undefined = closed, null = new voucher
  const [formVoucher, setFormVoucher] = useState<Voucher | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Vouchers" subtitle="Receipts, payments, transfers and journals.">
        <Button type="button" onClick={() => setFormVoucher(null)}>
          <Plus /> New voucher
        </Button>
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block space-y-1">
          <span className="text-muted-foreground block text-xs font-medium">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as VoucherType | '')}
            className={cn(selectClass, 'w-40')}
          >
            <option value="">All types</option>
            {VOUCHER_MODES.map((m) => (
              <option key={m.type} value={m.type}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <YearSelect
          from={from}
          to={to}
          onPick={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
      </div>

      <DataTable columns={columns} minWidth="48rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={vouchers.length === 0}
          emptyText="No vouchers for these filters."
        />
        {!isLoading &&
          vouchers.map((v) => (
            <tr key={v.id} className="bg-card hover:bg-muted/40">
              <td className={td}>
                {isLocked(v) ? (
                  <span className="font-medium tabular-nums">{v.voucher_no}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormVoucher(v)}
                    className="font-medium tabular-nums hover:underline"
                  >
                    {v.voucher_no}
                  </button>
                )}
              </td>
              <td className={`${td} text-muted-foreground whitespace-nowrap`}>
                {formatDay(v.date.slice(0, 10))}
              </td>
              <td className={td}>
                <Badge className={cn('border-transparent', TYPE_STYLE[v.type])}>
                  {TYPE_LABEL[v.type]}
                </Badge>
              </td>
              <td className={td}>
                <p className="max-w-md truncate" title={v.narration ?? undefined}>
                  {v.narration || <span className="text-muted-foreground">—</span>}
                </p>
                {v.reference && <p className="text-muted-foreground text-xs">Ref: {v.reference}</p>}
              </td>
              <td className={num}>
                <Money value={v.total} />
              </td>
              <td className={`${td} text-right`}>
                {isLocked(v) ? (
                  <Badge
                    variant="outline"
                    className="whitespace-nowrap"
                    title={
                      v.is_closing
                        ? 'Year-end closing. Reopen the year in Fiscal Years to undo it.'
                        : v.is_opening
                          ? 'Opening balances. Edit them on each account head.'
                          : v.fee_receipt_no
                            ? 'Posted by fee collection. Edit or delete the receipt in Fees > Receipts.'
                            : 'This year is closed. Reopen it in Fiscal Years to change it.'
                    }
                  >
                    {v.is_closing
                      ? 'Year-end closing'
                      : v.is_opening
                        ? 'Opening balances'
                        : v.fee_receipt_no
                          ? `Fee receipt #${v.fee_receipt_no}`
                          : 'Year closed'}
                  </Badge>
                ) : (
                  <RowActions
                    label={v.voucher_no}
                    onEdit={() => setFormVoucher(v)}
                    onDelete={() => setDeleteTarget(v)}
                  />
                )}
              </td>
            </tr>
          ))}
      </DataTable>

      {formVoucher !== undefined && (
        <VoucherForm
          key={formVoucher?.id ?? 'new'}
          voucher={formVoucher}
          onClose={() => setFormVoucher(undefined)}
        />
      )}

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete voucher"
        msg={`Delete voucher ${deleteTarget?.voucher_no ?? ''}? This cannot be undone.`}
      />
    </div>
  );
};

export default Vouchers;
