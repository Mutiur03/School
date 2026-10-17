import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ConfirmationPopup } from '@/components';
import ActionButton from '@/components/ActionButton';
import { openFeePdf, useDeleteFeeReceipt, useFeeReceipts } from '@/queries/fees.queries';
import type { FeeReceiptListItem } from '@/types/fees';
import { formatDay, formatYmd } from '@/lib/utils';
import { DataTable, DateInput, Money, PageTitle, StateRows, num, td } from '../Accounts/ui';
import { ClassSelect } from './shared';

const columns = [
  { label: 'Receipt', className: 'w-24' },
  { label: 'Date', className: 'w-32' },
  { label: 'Student' },
  { label: 'Class', className: 'w-28' },
  { label: 'Account' },
  { label: 'Total', className: 'w-32 text-right' },
  { label: 'Actions', className: 'w-px text-right' },
];

const monthStart = () => formatYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const FeeReceipts = () => {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(formatYmd(new Date()));
  const [cls, setCls] = useState<number | ''>('');
  const [receiptNo, setReceiptNo] = useState('');
  const {
    data: receipts = [],
    isLoading,
    isError,
  } = useFeeReceipts({
    from,
    to,
    class: cls,
    receipt_no: receiptNo,
  });
  const remove = useDeleteFeeReceipt();
  const [deleteTarget, setDeleteTarget] = useState<FeeReceiptListItem | null>(null);
  const total = receipts.reduce((t, r) => t + Math.round(r.total * 100), 0) / 100;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageTitle
        title="Fee Receipts"
        subtitle="Every collection, with its voucher in the ledger."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
        <ClassSelect value={cls} onChange={setCls} allowAll />
        <label className="block space-y-1">
          <span className="text-muted-foreground block text-xs font-medium">Receipt no.</span>
          <Input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="w-28"
          />
        </label>
      </div>

      <DataTable
        columns={columns}
        minWidth="52rem"
        footer={
          <tr>
            <td className={`${td} font-semibold`} colSpan={5}>
              {receipts.length} receipts
            </td>
            <td className={`${num} font-semibold`}>
              <Money value={total} />
            </td>
            <td />
          </tr>
        }
      >
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={receipts.length === 0}
          emptyText="No receipts for these filters."
        />
        {!isLoading &&
          receipts.map((r) => (
            <tr key={r.id} className="bg-card hover:bg-muted/40">
              <td className={`${td} font-medium tabular-nums`}>#{r.receipt_no}</td>
              <td className={`${td} text-muted-foreground whitespace-nowrap`}>
                {formatDay(r.date)}
              </td>
              <td className={td}>
                <p className="font-medium">{r.student.name}</p>
                <p className="text-muted-foreground text-xs">ID {String(r.student.login_id)}</p>
              </td>
              <td className={td}>
                {r.class}-{r.section} · {r.roll}
              </td>
              <td className={`${td} text-muted-foreground`}>
                {r.pay_head.name}
                <span className="ml-2 text-xs">{r.voucher_no}</span>
              </td>
              <td className={num}>
                <Money value={r.total} />
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <ActionButton
                  iconOnly
                  label="Print receipt"
                  icon={<Printer size={16} />}
                  onClick={() => openFeePdf(`/api/fee-receipts/${r.id}/pdf`)}
                />
                <ActionButton
                  iconOnly
                  label="Delete receipt"
                  icon={<Trash2 size={16} />}
                  onClick={() => setDeleteTarget(r)}
                />
              </td>
            </tr>
          ))}
      </DataTable>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete receipt"
        msg={`Delete receipt #${deleteTarget?.receipt_no ?? ''} and its voucher ${deleteTarget?.voucher_no ?? ''}? The fees become due again.`}
      />
    </div>
  );
};

export default FeeReceipts;
