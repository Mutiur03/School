import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openFeePdf, useFeeCollectionReport, useFeeDuesReport } from '@/queries/fees.queries';
import { cn, formatDay, formatYmd } from '@/lib/utils';
import { DataTable, DateInput, Money, PageTitle, StateRows, num, td } from '../Accounts/ui';
import { MONTHS, THIS_YEAR } from './constants';
import { ClassSelect, Select, YearSelect } from './shared';

const Tabs = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: 'collection' | 'dues') => void;
}) => (
  <div className="bg-muted inline-flex rounded-lg p-1" role="group" aria-label="Report">
    {(
      [
        ['collection', 'Collection'],
        ['dues', 'Dues'],
      ] as const
    ).map(([id, label]) => (
      <button
        key={id}
        type="button"
        aria-pressed={value === id}
        onClick={() => onChange(id)}
        className={cn(
          'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
          value === id ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

const Collection = () => {
  const [from, setFrom] = useState(`${THIS_YEAR}-01-01`);
  const [to, setTo] = useState(formatYmd(new Date()));
  const { data, isLoading, isError } = useFeeCollectionReport(from, to);

  const block = (
    title: string,
    columns: { label: string; className?: string }[],
    rows: React.ReactNode[][],
  ) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <DataTable columns={columns} minWidth="20rem">
        <StateRows
          colSpan={columns.length}
          loading={isLoading}
          error={isError}
          empty={rows.length === 0}
          emptyText="Nothing collected in this range."
        />
        {!isLoading &&
          rows.map((r, i) => (
            <tr key={i} className="bg-card">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? td : num}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
      </DataTable>
    </section>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateInput label="From" value={from} onChange={setFrom} />
        <DateInput label="To" value={to} onChange={setTo} />
        <Button
          type="button"
          variant="outline"
          disabled={!data}
          onClick={() => openFeePdf('/api/fee-reports/collection/pdf', { from, to })}
        >
          <Download /> PDF
        </Button>
        {data && (
          <p className="ml-auto text-sm">
            <span className="text-muted-foreground">{data.count} receipts · </span>
            <b>
              <Money value={data.total} />
            </b>
          </p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {block(
          'By fee head',
          [
            { label: 'Fee' },
            { label: 'Waiver', className: 'text-right' },
            { label: 'Collected', className: 'text-right' },
          ],
          (data?.by_head ?? []).map((h) => [
            h.name,
            <Money key="w" value={h.waiver} />,
            <Money key="t" value={h.total} />,
          ]),
        )}
        {block(
          'By class',
          [
            { label: 'Class' },
            { label: 'Receipts', className: 'text-right' },
            { label: 'Collected', className: 'text-right' },
          ],
          (data?.by_class ?? []).map((c) => [
            `Class ${c.class}`,
            c.count,
            <Money key="t" value={c.total} />,
          ]),
        )}
        {block(
          'By account',
          [{ label: 'Account' }, { label: 'Collected', className: 'text-right' }],
          (data?.by_account ?? []).map((a) => [a.name, <Money key="t" value={a.total} />]),
        )}
        {block(
          'By day',
          [
            { label: 'Date' },
            { label: 'Receipts', className: 'text-right' },
            { label: 'Collected', className: 'text-right' },
          ],
          (data?.by_day ?? []).map((d) => [
            formatDay(d.date),
            d.count,
            <Money key="t" value={d.total} />,
          ]),
        )}
      </div>
    </>
  );
};

const Dues = () => {
  const [year, setYear] = useState(THIS_YEAR);
  const [cls, setCls] = useState<number | ''>('');
  const [section, setSection] = useState('');
  const [upto, setUpto] = useState(new Date().getMonth() + 1);
  const params = { year, class: cls, section, upto_month: upto };
  const { data, isLoading, isError } = useFeeDuesReport(params, cls !== '');
  const columns = [
    { label: 'Roll', className: 'w-20' },
    { label: 'Sec', className: 'w-16' },
    { label: 'Student' },
    { label: 'Charge', className: 'w-28 text-right' },
    { label: 'Waiver', className: 'w-28 text-right' },
    { label: 'Paid', className: 'w-28 text-right' },
    { label: 'Due', className: 'w-28 text-right' },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <YearSelect value={year} onChange={setYear} />
        <ClassSelect value={cls} onChange={setCls} />
        <Select label="Section" value={section} onChange={setSection} className="w-24">
          <option value="">All</option>
          {['A', 'B', 'C', 'D', 'E'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          label="Monthly fees up to"
          value={upto}
          onChange={(v) => setUpto(Number(v))}
          className="w-28"
        >
          {MONTHS.slice(1).map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!data}
          onClick={() => openFeePdf('/api/fee-reports/dues/pdf', params)}
        >
          <Download /> PDF
        </Button>
        {data && (
          <p className="ml-auto text-sm">
            <span className="text-muted-foreground">{data.rows.length} students · Due </span>
            <b>
              <Money value={data.total_due} />
            </b>
          </p>
        )}
      </div>
      {cls === '' ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Pick a class to list its dues.
        </p>
      ) : (
        <DataTable columns={columns} minWidth="42rem">
          <StateRows
            colSpan={columns.length}
            loading={isLoading}
            error={isError}
            empty={(data?.rows.length ?? 0) === 0}
            emptyText="No dues. Everyone has paid up to this month."
          />
          {!isLoading &&
            data?.rows.map((r) => (
              <tr key={r.student_id} className="bg-card hover:bg-muted/40">
                <td className={td}>{r.roll}</td>
                <td className={td}>{r.section}</td>
                <td className={td}>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted-foreground text-xs">ID {r.login_id}</p>
                </td>
                <td className={num}>
                  <Money value={r.charge} />
                </td>
                <td className={num}>
                  <Money value={r.waiver} />
                </td>
                <td className={num}>
                  <Money value={r.paid} />
                </td>
                <td className={cn(num, 'text-destructive font-semibold')}>
                  <Money value={r.due} />
                </td>
              </tr>
            ))}
        </DataTable>
      )}
    </>
  );
};

const FeeReports = () => {
  const [tab, setTab] = useState<'collection' | 'dues'>('collection');
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageTitle title="Fee Reports" subtitle="What was collected and who still owes.">
        <Tabs value={tab} onChange={setTab} />
      </PageTitle>
      {tab === 'collection' ? <Collection /> : <Dues />}
    </div>
  );
};

export default FeeReports;
