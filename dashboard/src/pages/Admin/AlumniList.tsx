import axios from 'axios';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, MoreHorizontal, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionCard, Popup, StatusBadge, TablePagination } from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { getFileUrl } from '@/lib/backend';
import { cn } from '@/lib/utils';

// Shape of GET /api/students/alumni (students table rows, password omitted).
interface Alumnus {
  id: number;
  login_id: string;
  name: string;
  father_name?: string | null;
  mother_name?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  batch: string;
  dob?: string | null;
  image?: string | null;
  available: boolean;
  has_stipend?: boolean;
  religion?: string | null;
  village?: string | null;
  post_office?: string | null;
  upazila?: string | null;
  district?: string | null;
}

type SortKey = 'name' | 'batch' | 'district';

const dash = <span className="text-muted-foreground">—</span>;
const address = (a: Alumnus) =>
  [a.village, a.post_office, a.upazila, a.district].filter(Boolean).join(', ');

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

// Student photos are 7:9 passport crops; keep that ratio so heads aren't cut off.
const Avatar = ({ a, size = 'h-9 w-7' }: { a: Alumnus; size?: string }) =>
  a.image ? (
    <img
      src={getFileUrl(a.image)}
      alt=""
      loading="lazy"
      className={`border-border ${size} shrink-0 rounded border object-cover object-top`}
    />
  ) : (
    <div
      className={`bg-muted text-muted-foreground ${size} flex shrink-0 items-center justify-center rounded text-xs font-semibold`}
    >
      {a.name.charAt(0).toUpperCase()}
    </div>
  );

// Student column stays pinned while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit';
const stickyEdge = 'max-xl:shadow-[1px_0_0_var(--border)]';

function AlumniList() {
  const [search, setSearch] = useState('');
  const [batchFilters, setBatchFilters] = useState<string[]>([]);
  const [districtFilters, setDistrictFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [viewing, setViewing] = useState<Alumnus | null>(null);
  const deferredSearch = useDeferredValue(search);

  const {
    data: alumni = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['students', 'alumni'],
    queryFn: async () => (await axios.get('/api/students/alumni')).data.data as Alumnus[],
  });

  const batches = useMemo(
    () => [...new Set(alumni.map((a) => a.batch))].sort((a, b) => b.localeCompare(a)),
    [alumni],
  );
  const districts = useMemo(
    () => [...new Set(alumni.map((a) => a.district).filter((d): d is string => !!d))].sort(),
    [alumni],
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const rows = alumni.filter(
      (a) =>
        (!q ||
          a.name.toLowerCase().includes(q) ||
          a.father_phone?.includes(q) ||
          a.mother_phone?.includes(q)) &&
        (!batchFilters.length || batchFilters.includes(a.batch)) &&
        (!districtFilters.length || districtFilters.includes(a.district ?? '')),
    );
    if (!sort) return rows; // API order: batch desc, name asc
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((x, y) => dir * (x[sort.key] ?? '').localeCompare(y[sort.key] ?? ''));
  }, [alumni, deferredSearch, batchFilters, districtFilters, sort]);

  const totalPages = Math.ceil(filtered.length / limit);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  const filtersActive = Boolean(search || batchFilters.length || districtFilters.length);
  const clearFilters = () => {
    setSearch('');
    setBatchFilters([]);
    setDistrictFilters([]);
    setPage(1);
  };
  const withReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });
  const ariaSort = (key?: SortKey) =>
    key && sort?.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined;

  const columns: { label: string; node: ReactNode; sortKey?: SortKey; className?: string }[] = [
    {
      label: 'Student',
      sortKey: 'name',
      node: (
        <ColumnHeaderMenu
          label="Student"
          {...sortProps('name')}
          filterInput={{
            value: search,
            onChange: withReset(setSearch),
            placeholder: 'Name or phone…',
          }}
        />
      ),
    },
    {
      label: 'Batch',
      sortKey: 'batch',
      className: 'w-32',
      node: (
        <ColumnHeaderMenu
          label="Batch"
          {...sortProps('batch')}
          options={batches.map((b) => ({ value: b, label: b }))}
          selected={batchFilters}
          onSelectedChange={withReset(setBatchFilters)}
        />
      ),
    },
    { label: 'Phone', node: 'Phone', className: 'w-36' },
    {
      label: 'Address',
      sortKey: 'district',
      node: (
        <ColumnHeaderMenu
          label="Address"
          {...sortProps('district')}
          options={districts.map((d) => ({ value: d, label: d }))}
          selected={districtFilters}
          onSelectedChange={withReset(setDistrictFilters)}
        />
      ),
    },
    { label: 'DOB', node: 'DOB', className: 'w-32' },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      node: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={clearFilters}
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  const summary = isLoading
    ? ' '
    : [
        `${filtersActive ? `${filtered.length.toLocaleString()} of ` : ''}${alumni.length.toLocaleString()} ${alumni.length === 1 ? 'alumnus' : 'alumni'}`,
        batches.length ? `${batches.length} batch${batches.length === 1 ? '' : 'es'}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const details: [string, ReactNode][] = viewing
    ? [
        ['Login ID', viewing.login_id],
        ['Batch', viewing.batch],
        ["Father's name", viewing.father_name],
        ["Mother's name", viewing.mother_name],
        ["Father's phone", viewing.father_phone],
        ["Mother's phone", viewing.mother_phone],
        ['Date of birth', viewing.dob?.slice(0, 10)],
        ['Religion', viewing.religion],
        ['Stipend', viewing.has_stipend == null ? null : viewing.has_stipend ? 'Yes' : 'No'],
        ['Address', address(viewing)],
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Alumni List</h1>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
      </header>

      <SectionCard noPadding className="mb-6">
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    aria-sort={ariaSort(col.sortKey)}
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.label === 'Student' && cn(stickyCell, stickyEdge, 'px-3 sm:px-4'),
                      col.className,
                    )}
                  >
                    {col.node}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((a) => {
                  const phone = a.father_phone || a.mother_phone;
                  return (
                    // Opaque row colour so the pinned cell hides columns scrolling beneath it.
                    <tr
                      key={a.id}
                      className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                    >
                      <td className={cn(stickyCell, stickyEdge, 'px-3 py-2 sm:px-4')}>
                        <div className="flex max-w-[11rem] items-center gap-3 sm:max-w-none">
                          <Avatar a={a} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewing(a)}
                                className="focus-visible:ring-ring truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                              >
                                {a.name}
                              </button>
                              {!a.available && (
                                <StatusBadge status="inactive" className="shrink-0" />
                              )}
                            </div>
                            {a.father_name && (
                              <p className="text-muted-foreground truncate text-xs">
                                {a.father_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm tabular-nums">{a.batch}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                        {phone || dash}
                      </td>
                      <td className="max-w-xs px-4 py-2 text-sm">
                        <span className="line-clamp-2">{address(a) || dash}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                        {a.dob?.slice(0, 10) || dash}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {/* modal={false}: menu items open dialogs; a modal menu would leave pointer-events locked */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <ActionButton
                              iconOnly
                              label="More actions"
                              icon={<MoreHorizontal size={16} />}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="truncate normal-case tracking-normal">
                              {a.name}
                            </DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => setViewing(a)}>
                              <Eye /> View details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
                      {error ? (
                        <>
                          <p>Failed to load alumni list.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                          >
                            <RotateCw /> Retry
                          </Button>
                        </>
                      ) : (
                        <>
                          <p>
                            {filtersActive ? 'No alumni match these filters.' : 'No alumni yet.'}
                          </p>
                          {filtersActive && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              <X /> Clear filters
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          limit={limit}
          loading={isLoading}
          totalFiltered={isLoading ? undefined : filtered.length}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </SectionCard>

      <Popup
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewing(null)}
        size="lg"
        aria-labelledby="alumnus-title"
      >
        {viewing && (
          <>
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <h2 id="alumnus-title" className="text-base font-semibold">
                Alumnus details
              </h2>
              <CloseButton onClick={() => setViewing(null)} />
            </div>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-4">
                <Avatar a={viewing} size="h-[4.5rem] w-14" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{viewing.name}</p>
                  {!viewing.available && <StatusBadge status="inactive" className="mt-1" />}
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label} className={label === 'Address' ? 'sm:col-span-2' : undefined}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="wrap-break-word">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="border-border flex justify-end border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Popup>
    </div>
  );
}

export default AlumniList;
