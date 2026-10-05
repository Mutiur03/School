import React from 'react';
import type { AccHead, AmountRow } from '@/types/accounts';
import { formatMoney } from '@/lib/utils';
import { DataTable, Money, num, td } from '../ui';

/** Amount list grouped under each row's parent head name, with subtotals and a total. */
const AmountTable = ({
  title,
  rows,
  total,
  byId,
  extra,
}: {
  title: string;
  rows: AmountRow[];
  total: number;
  byId: Map<number, AccHead>;
  /** Extra rows rendered before the total (e.g. surplus). */
  extra?: React.ReactNode;
}) => {
  const groups = new Map<number | null, AmountRow[]>();
  for (const r of rows) {
    const key = r.parent_id != null && byId.has(r.parent_id) ? r.parent_id : null;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <DataTable
      columns={[{ label: title }, { label: 'Amount', className: 'w-40 text-right' }]}
      minWidth="20rem"
      footer={
        <tr className="font-semibold">
          <td className={td}>Total {title.toLowerCase()}</td>
          <td className={num}>{formatMoney(total)}</td>
        </tr>
      }
    >
      {rows.length === 0 && !extra && (
        <tr>
          <td colSpan={2} className="text-muted-foreground px-4 py-8 text-center text-sm">
            Nothing to show.
          </td>
        </tr>
      )}
      {[...groups].map(([parentId, items]) => (
        <React.Fragment key={parentId ?? 'top'}>
          {parentId != null && (
            <tr className="bg-muted/30">
              <td className={`${td} font-medium`}>{byId.get(parentId)?.name}</td>
              <td className={`${num} font-medium`}>
                {formatMoney(items.reduce((s, r) => s + r.amount, 0))}
              </td>
            </tr>
          )}
          {items.map((r) => (
            <tr key={r.head_id} className="bg-card">
              <td className={td} style={{ paddingLeft: parentId != null ? '2.25rem' : undefined }}>
                {r.name}
              </td>
              <td className={num}>
                <Money value={r.amount} />
              </td>
            </tr>
          ))}
        </React.Fragment>
      ))}
      {extra}
    </DataTable>
  );
};

export default AmountTable;
