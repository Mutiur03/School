import { Link } from 'react-router-dom';
import StatsCard from '@/components/StatsCard';
import { SectionCard } from '@/components';
import { openFeePdf, useFeeSummary } from '@/queries/fees.queries';
import { formatDay, formatMoney, formatYmd } from '@/lib/utils';
import { DataTable, PageTitle, StateRows, num, td } from '../Accounts/ui';

const today = formatYmd(new Date());

const columns = [
  { label: 'Receipt', className: 'w-24' },
  { label: 'Date', className: 'w-32' },
  { label: 'Student' },
  { label: 'Class', className: 'w-28' },
  { label: 'Total', className: 'w-32 text-right' },
];

const FeeOverview = () => {
  const { data, isLoading, isError } = useFeeSummary(today);
  const peak = Math.max(1, ...(data?.last_7_days ?? []).map((d) => d.total));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Fees" subtitle="Collection at a glance.">
        <Link
          to="/admin/fees/collect"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
        >
          Collect fees
        </Link>
      </PageTitle>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatsCard
          label="Today"
          value={formatMoney(data?.today ?? 0)}
          color="emerald"
          loading={isLoading}
        />
        <StatsCard
          label="This month"
          value={formatMoney(data?.month ?? 0)}
          color="blue"
          loading={isLoading}
        />
        <StatsCard
          label="This year"
          value={formatMoney(data?.year ?? 0)}
          color="violet"
          loading={isLoading}
        />
      </div>

      <SectionCard className="mb-6">
        <h2 className="mb-4 text-sm font-semibold">Last 7 days</h2>
        <div
          className="flex h-40 items-end gap-3"
          role="img"
          aria-label="Collection in the last 7 days"
        >
          {(data?.last_7_days ?? []).map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs tabular-nums">
                {d.total ? formatMoney(d.total) : ''}
              </span>
              <div
                className="bg-primary w-full rounded-t"
                style={{
                  height: `${Math.max(2, (d.total / peak) * 100)}%`,
                  opacity: d.total ? 1 : 0.2,
                }}
              />
              <span className="text-muted-foreground text-xs">{formatDay(d.date).slice(0, 6)}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <h2 className="mb-2 text-sm font-semibold">Latest receipts</h2>
      <DataTable columns={columns} minWidth="36rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={(data?.latest.length ?? 0) === 0}
          emptyText="No receipts yet."
        />
        {!isLoading &&
          data?.latest.map((r) => (
            <tr key={r.id} className="bg-card hover:bg-muted/40">
              <td className={td}>
                <button
                  type="button"
                  className="font-medium tabular-nums hover:underline"
                  onClick={() => openFeePdf(`/api/fee-receipts/${r.id}/pdf`)}
                >
                  #{r.receipt_no}
                </button>
              </td>
              <td className={`${td} text-muted-foreground`}>{formatDay(r.date)}</td>
              <td className={td}>{r.student.name}</td>
              <td className={td}>
                {r.class}-{r.section} · {r.roll}
              </td>
              <td className={num}>{formatMoney(r.total)}</td>
            </tr>
          ))}
      </DataTable>
    </div>
  );
};

export default FeeOverview;
