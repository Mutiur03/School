/**
 * Fee Reports, replicating dashboard/src/pages/Admin/Fees/FeeReports.tsx: Collection (From / To,
 * PDF, "N receipts · total", By fee head / class / account / day) and Dues (Session, Class,
 * Section, "Monthly fees up to", PDF, "N students · Due total", the dues table). Amounts are the
 * server's, parsed into paisa. Live data: GET /api/fee-reports/{collection,dues}[/pdf].
 */
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { AlertCircle, Banknote, Download } from '@/components/ui/icons';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { formatDay, todayYmd } from '@/features/holidays/model';
import { MONTHS, SECTIONS } from '@/features/fees/model';
import { useFinanceKey } from '@/features/finance/queries';
import {
  ClassSelect,
  DateField,
  Filters,
  LabeledSelect,
  Money,
  YearSelect,
} from '@/features/finance/ui';
import type { FeeDuesRow } from '@/lib/api';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { formatMoney, ZERO, type Paisa } from '@/lib/money/money';
import { useApi } from '@/session/ApiProvider';

type Tab = 'collection' | 'dues';
type Cell = { label: string; amount?: Paisa; count?: number };

function usePdf() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (load: () => Promise<ArrayBuffer>, name: string) => {
    setBusy(true);
    try {
      const r = await openPdf(load, name);
      if (r !== 'opened') toast.error('This device cannot open the PDF.');
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to make the PDF'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function Block({
  title,
  rows,
  loading,
  countLabel,
  extraLabel,
}: {
  title: string;
  rows: (Cell & { extra?: Paisa })[];
  loading: boolean;
  countLabel?: string;
  extraLabel?: string;
}) {
  const columns: Column<Cell & { extra?: Paisa }>[] = [
    {
      key: 'l',
      label: title.replace('By ', '').replace(/^\w/, (c) => c.toUpperCase()),
      className: 'min-w-0 flex-1',
      render: (r) => (
        <Text size="sm" numberOfLines={1}>
          {r.label}
        </Text>
      ),
    },
    ...(extraLabel
      ? [
          {
            key: 'x',
            label: extraLabel,
            className: 'w-28',
            align: 'right' as const,
            render: (r: Cell & { extra?: Paisa }) => <Money value={r.extra ?? ZERO} />,
          },
        ]
      : []),
    ...(countLabel
      ? [
          {
            key: 'c',
            label: countLabel,
            className: 'w-24',
            align: 'right' as const,
            render: (r: Cell) => (
              <Text size="sm" tabular>
                {r.count ?? 0}
              </Text>
            ),
          },
        ]
      : []),
    {
      key: 'a',
      label: 'Collected',
      className: 'w-32',
      align: 'right',
      render: (r) => <Money value={r.amount ?? ZERO} />,
    },
  ];
  return (
    <View className="min-w-0 grow basis-full gap-2 lg:basis-[48%]">
      <Text size="sm" weight="semibold">
        {title}
      </Text>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.label}
        loading={loading}
        empty="Nothing collected in this range."
        renderMobile={(r) => (
          <View className="flex-row items-center justify-between gap-3">
            <Text size="sm" className="min-w-0 flex-1" numberOfLines={1}>
              {r.label}
            </Text>
            {r.count !== undefined && countLabel ? (
              <Text size="xs" color="mutedForeground">
                {plural(r.count, 'receipt')}
              </Text>
            ) : null}
            <Money value={r.amount ?? ZERO} weight="semibold" />
          </View>
        )}
      />
    </View>
  );
}

function Collection() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const pdf = usePdf();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayYmd());
  const ready = from.length === 10 && to.length === 10;
  const q = useQuery({
    queryKey: key('fee-collection', from, to),
    queryFn: () => fees.collection(from, to),
    enabled: ready,
  });
  const d = q.data;
  return (
    <>
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <Filters>
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          <Button
            variant="outline"
            icon={Download}
            label="PDF"
            disabled={!d || pdf.busy}
            onPress={() =>
              void pdf.run(
                () => fees.collectionPdf(from, to),
                pdfFileName(['fee-collection', from, to]),
              )
            }
          />
        </Filters>
        {d ? (
          <Text size="sm" testID="collection-total">
            <Text size="sm" color="mutedForeground">{`${plural(d.count, 'receipt')} · `}</Text>
            <Text size="sm" weight="bold" tabular>
              {formatMoney(d.total)}
            </Text>
          </Text>
        ) : null}
      </View>
      {q.isError && !d ? (
        <ErrorState
          title="Couldn't load the report"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <View className="flex-row flex-wrap gap-6">
          <Block
            title="By fee head"
            loading={q.isPending}
            extraLabel="Waiver"
            rows={(d?.by_head ?? []).map((h) => ({
              label: h.name,
              amount: h.total,
              extra: h.waiver,
            }))}
          />
          <Block
            title="By class"
            loading={q.isPending}
            countLabel="Receipts"
            rows={(d?.by_class ?? []).map((c) => ({
              label: `Class ${c.class}`,
              count: c.count,
              amount: c.total,
            }))}
          />
          <Block
            title="By account"
            loading={q.isPending}
            rows={(d?.by_account ?? []).map((a) => ({ label: a.name, amount: a.total }))}
          />
          <Block
            title="By day"
            loading={q.isPending}
            countLabel="Receipts"
            rows={(d?.by_day ?? []).map((x) => ({
              label: formatDay(x.date),
              count: x.count,
              amount: x.total,
            }))}
          />
        </View>
      )}
    </>
  );
}

function Dues() {
  const { fees } = useApi();
  const key = useFinanceKey();
  const pdf = usePdf();
  const [year, setYear] = useState(new Date().getFullYear());
  const [cls, setCls] = useState(0);
  const [section, setSection] = useState('');
  const [upto, setUpto] = useState(new Date().getMonth() + 1);
  const params = { year, class: cls, section: section || undefined, upto_month: upto };
  const q = useQuery({
    queryKey: key('fee-dues', params),
    queryFn: () => fees.dues(params),
    enabled: cls > 0,
  });
  const d = q.data;
  const money = (v: Paisa, cls2?: string) => <Money value={v} className={cls2} />;
  const columns: Column<FeeDuesRow>[] = [
    {
      key: 'roll',
      label: 'Roll',
      className: 'w-20',
      render: (r) => (
        <Text size="sm" tabular>
          {r.roll}
        </Text>
      ),
    },
    {
      key: 'sec',
      label: 'Sec',
      className: 'w-16',
      render: (r) => <Text size="sm">{r.section}</Text>,
    },
    {
      key: 'student',
      label: 'Student',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <View>
          <Text size="sm" weight="medium" numberOfLines={1}>
            {r.name}
          </Text>
          <Text size="xs" color="mutedForeground">
            ID {r.login_id}
          </Text>
        </View>
      ),
    },
    {
      key: 'charge',
      label: 'Charge',
      className: 'w-28',
      align: 'right',
      render: (r) => money(r.charge),
    },
    {
      key: 'waiver',
      label: 'Waiver',
      className: 'w-28',
      align: 'right',
      render: (r) => money(r.waiver),
    },
    { key: 'paid', label: 'Paid', className: 'w-28', align: 'right', render: (r) => money(r.paid) },
    {
      key: 'due',
      label: 'Due',
      className: 'w-28',
      align: 'right',
      render: (r) => <Money value={r.due} weight="semibold" className="text-destructive" />,
    },
  ];
  return (
    <>
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <Filters>
          <YearSelect value={year} onChange={setYear} />
          <ClassSelect value={cls} onChange={setCls} />
          <LabeledSelect
            label="Section"
            value={section}
            onChange={setSection}
            className="w-24"
            options={[
              { value: '', label: 'All' },
              ...SECTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
          <LabeledSelect
            label="Monthly fees up to"
            value={upto}
            onChange={setUpto}
            className="w-28"
            options={MONTHS.slice(1).map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Button
            variant="outline"
            icon={Download}
            label="PDF"
            disabled={!d || pdf.busy}
            onPress={() =>
              void pdf.run(
                () => fees.duesPdf(params),
                pdfFileName(['fee-dues', year, `class-${cls}`, section]),
              )
            }
          />
        </Filters>
        {d ? (
          <Text size="sm" testID="dues-total">
            <Text
              size="sm"
              color="mutedForeground"
            >{`${plural(d.rows.length, 'student')} · Due `}</Text>
            <Text size="sm" weight="bold" tabular>
              {formatMoney(d.total_due)}
            </Text>
          </Text>
        ) : null}
      </View>
      {!cls ? (
        <EmptyState message="Pick a class to list its dues." />
      ) : q.isError && !d ? (
        <ErrorState
          title="Couldn't load the report"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          testID="fee-dues-report"
          rows={d?.rows ?? []}
          columns={columns}
          rowKey={(r) => r.student_id}
          loading={q.isPending}
          empty="No dues. Everyone has paid up to this month."
          renderMobile={(r) => (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text
                  size="sm"
                  weight="medium"
                  numberOfLines={1}
                >{`${r.section}-${r.roll} · ${r.name}`}</Text>
                <Text size="xs" color="mutedForeground" numberOfLines={1}>
                  {`Charge ${formatMoney(r.charge)} · Waiver ${formatMoney(r.waiver)} · Paid ${formatMoney(r.paid)}`}
                </Text>
              </View>
              <Money value={r.due} weight="semibold" className="text-destructive" />
            </View>
          )}
        />
      )}
    </>
  );
}

const TABS = [
  { id: 'collection' as const, label: 'Collection', icon: Banknote },
  { id: 'dues' as const, label: 'Dues', icon: AlertCircle },
];

export function FeeReportsScreen() {
  const [tab, setTab] = useState<Tab>('collection');
  const body: ReactNode = tab === 'collection' ? <Collection /> : <Dues />;
  return (
    <PageLayout title="Fee Reports" description="What was collected and who still owes.">
      <Tabs tabs={TABS} value={tab} onChange={setTab} testID="fee-report-tabs" />
      {body}
    </PageLayout>
  );
}
