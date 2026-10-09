import React, { useDeferredValue, useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popup, SectionCard, TablePagination } from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import {
  useCertificateHistory,
  useCertificates,
  type CertificateRecord,
  type CertificateSortKey as SortKey,
} from '@/queries/certificates.queries';
import { cn } from '@/lib/utils';


const EXAM_LABEL: Record<string, string> = {
  SSC: 'SSC',
  JSC: 'JSC',
  '6': 'Class 6',
  '7': 'Class 7',
  '8': 'Class 8',
};
const COLUMNS: { label: string; sortKey?: SortKey; className?: string }[] = [
  { label: 'Student', sortKey: 'name' },
  { label: 'Exam', sortKey: 'exam' },
  { label: 'Year', sortKey: 'year' },
  { label: 'Mobile', sortKey: 'mobile' },
  { label: 'Last updated', sortKey: 'updated' },
  { label: 'Edits', sortKey: 'edits' },
  { label: 'Actions' },
];

// Edits to these change what the certificate says, so they are flagged for review.
const SENSITIVE = new Set(['gpa', 'dob', 'roll', 'registration_no', 'passing_year', 'exam']);

// Every stored field, in reading order, for the details view.
const DETAILS: [string, string][] = [
  ['student_name_en', 'Name (English)'],
  ['student_name_bn', 'Name (Bangla)'],
  ['father_name_en', "Father's name (English)"],
  ['father_name_bn', "Father's name (Bangla)"],
  ['mother_name_en', "Mother's name (English)"],
  ['mother_name_bn', "Mother's name (Bangla)"],
  ['dob', 'Date of birth'],
  ['gender', 'Gender'],
  ['mobile', 'Mobile'],
  ['exam', 'Exam'],
  ['passing_year', 'Passing year'],
  ['roll', 'Roll'],
  ['registration_no', 'Registration no.'],
  ['gpa', 'GPA'],
];

// Student column stays pinned while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const label = (field: string) => field.replace(/_/g, ' ');
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

function CertificateHistory({
  record,
  onClose,
}: {
  record: CertificateRecord;
  onClose: () => void;
}) {
  const { data: revisions, isLoading } = useCertificateHistory(record.id);

  return (
    <Popup open onOpenChange={(o) => !o && onClose()} size="xl" aria-labelledby="cert-history-title">
      <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id="cert-history-title" className="truncate text-base font-semibold">
            {record.data.student_name_en}
          </h2>
          <p className="text-muted-foreground text-xs">
            Created {when(record.created_at)}
            {record.created_ip && ` · ${record.created_ip}`}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
        <section aria-label="Details">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Details
            </h3>
            <a
              href={`/api/certificates/${record.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="text-primary text-xs font-medium hover:underline"
            >
              Open certificate PDF
            </a>
          </div>
          <dl className="border-border grid gap-x-6 gap-y-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
            {DETAILS.filter(([key]) => record.data[key] != null && record.data[key] !== '').map(
              ([key, name]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{name}</dt>
                  <dd className="break-words font-medium">
                    {key === 'exam'
                      ? (EXAM_LABEL[String(record.data[key])] ?? record.data[key])
                      : record.data[key]}
                  </dd>
                </div>
              ),
            )}
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Last updated</dt>
              <dd className="font-medium">{when(record.updated_at)}</dd>
            </div>
          </dl>
        </section>
        <h3 className="text-muted-foreground pt-1 text-xs font-semibold uppercase tracking-wider">
          History
        </h3>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {revisions?.length === 0 && (
          <p className="text-muted-foreground text-sm">Not edited since it was created.</p>
        )}
        {revisions?.map((r) => (
          <div key={r.id} className="border-border space-y-2 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">
              Edited by student · {when(r.created_at)}
              {r.ip && ` · ${r.ip}`}
            </p>
            {r.changes.length === 0 && (
              <p className="text-muted-foreground text-sm">Saved again with no changes.</p>
            )}
            <ul className="space-y-1 text-sm">
              {r.changes.map((c) => (
                <li key={c.field} className="flex flex-wrap items-center gap-x-2">
                  <span className="text-muted-foreground capitalize">{label(c.field)}</span>
                  <span className="text-red-600 line-through">{String(c.from ?? '—')}</span>
                  <span aria-hidden>→</span>
                  <span className="font-medium text-emerald-700">{String(c.to ?? '—')}</span>
                  {SENSITIVE.has(c.field) && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                      Review
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Popup>
  );
}

export default function Certificates() {
  const [nameFilter, setNameFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [examFilters, setExamFilters] = useState<string[]>([]);
  const [yearFilters, setYearFilters] = useState<string[]>([]);
  const [editFilters, setEditFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>({
    key: 'updated',
    order: 'desc',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState<CertificateRecord | null>(null);

  const filtersActive = Boolean(
    nameFilter || mobileFilter || examFilters.length || yearFilters.length || editFilters.length,
  );
  const clearFilters = () => {
    setNameFilter('');
    setMobileFilter('');
    setExamFilters([]);
    setYearFilters([]);
    setEditFilters([]);
    setPage(1);
  };
  // Any filter/sort change returns to the first page.
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  // Text filters are sent after typing settles, not on every keystroke.
  const name = useDeferredValue(nameFilter.trim());
  const mobile = useDeferredValue(mobileFilter.trim());
  const { data, isLoading, isError, refetch } = useCertificates({
    page,
    limit,
    sort: sort?.key,
    order: sort?.order,
    name: name || undefined,
    mobile: mobile || undefined,
    exam: examFilters,
    year: yearFilters,
    // Both boxes ticked means no filter.
    edits: editFilters.length === 1 ? (editFilters[0] as 'edited' | 'never') : undefined,
  });
  const rows = data?.items ?? [];
  const meta = data?.meta;

  const examOptions = (meta?.exams ?? []).map((v) => ({ value: v, label: EXAM_LABEL[v] ?? v }));
  const yearOptions = (meta?.years ?? []).map((v) => ({ value: String(v), label: String(v) }));

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => {
      setSort(order ? { key, order } : null);
      setPage(1);
    },
  });
  const columnHeaders: Record<string, React.ReactNode> = {
    Student: (
      <ColumnHeaderMenu
        label="Student"
        {...sortProps('name')}
        filterInput={{
          value: nameFilter,
          onChange: withReset(setNameFilter),
          placeholder: 'Student name…',
        }}
      />
    ),
    Exam: (
      <ColumnHeaderMenu
        label="Exam"
        {...sortProps('exam')}
        options={examOptions}
        selected={examFilters}
        onSelectedChange={withReset(setExamFilters)}
      />
    ),
    Year: (
      <ColumnHeaderMenu
        label="Year"
        {...sortProps('year')}
        options={yearOptions}
        selected={yearFilters}
        onSelectedChange={withReset(setYearFilters)}
      />
    ),
    Mobile: (
      <ColumnHeaderMenu
        label="Mobile"
        {...sortProps('mobile')}
        filterInput={{
          value: mobileFilter,
          onChange: withReset(setMobileFilter),
          placeholder: 'Mobile number',
        }}
      />
    ),
    'Last updated': <ColumnHeaderMenu label="Last updated" {...sortProps('updated')} />,
    Edits: (
      <ColumnHeaderMenu
        label="Edits"
        {...sortProps('edits')}
        options={[
          { value: 'edited', label: 'Edited' },
          { value: 'never', label: 'Never edited' },
        ]}
        selected={editFilters}
        onSelectedChange={withReset(setEditFilters)}
        align="end"
      />
    ),
    Actions: filtersActive ? (
      <ActionButton iconOnly label="Clear filters" icon={<X size={16} />} onClick={clearFilters} />
    ) : (
      <span className="sr-only">Actions</span>
    ),
  };

  const summary = meta
    ? [
        `${filtersActive ? `${meta.total.toLocaleString()} of ` : ''}${plural(meta.totalAll, 'certificate')}`,
        `${meta.editedCount.toLocaleString()} edited`,
      ].join(' · ')
    : ' ';

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <>
          <p>Couldn't load certificates. Try again in a moment.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw /> Retry
          </Button>
        </>
      ) : filtersActive ? (
        <>
          <p>No certificates match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <p>No certificates have been generated yet.</p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
      </header>

      <SectionCard noPadding className="mb-6">
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    aria-sort={
                      sort && col.sortKey === sort.key
                        ? sort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.label === 'Student' && cn(stickyCell, 'px-3 sm:px-4'),
                      col.label === 'Actions' && 'px-3 text-right',
                    )}
                  >
                    {columnHeaders[col.label] ?? col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={COLUMNS.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  // Opaque row colours so the pinned Student cell hides what scrolls under it.
                  <tr
                    key={r.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                      <div className="flex max-w-[11rem] items-center gap-3 sm:max-w-none">
                        <div className="bg-muted text-muted-foreground flex h-9 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold">
                          {String(r.data.student_name_en).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setOpen(r)}
                            className="focus-visible:ring-ring truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                          >
                            {r.data.student_name_en}
                          </button>
                          {r.data.father_name_en && (
                            <p className="text-muted-foreground truncate text-xs">
                              {r.data.father_name_en}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {EXAM_LABEL[String(r.data.exam)] ?? r.data.exam}
                    </td>
                    <td className="px-4 py-2 text-sm tabular-nums">{r.data.passing_year}</td>
                    <td className="px-4 py-2 text-sm tabular-nums">{r.data.mobile}</td>
                    <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm">
                      {when(r.updated_at)}
                    </td>
                    <td className="px-4 py-2 text-sm tabular-nums">
                      {r.edits > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                          {r.edits}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <ActionButton action="view" iconOnly onClick={() => setOpen(r)} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={meta?.totalPages ?? 0}
          limit={limit}
          loading={isLoading}
          totalFiltered={meta?.total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </SectionCard>

      {open && <CertificateHistory record={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
