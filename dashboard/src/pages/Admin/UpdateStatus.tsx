import { useDeferredValue, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { SectionCard, filterSelectClassName, TablePagination } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { cn } from '@/lib/utils';
import { useStudents } from '@/queries/students.queries';
import type { Student } from '@/types/students';

type EnrollmentStatus = 'Passed' | 'Failed' | 'Pending';

const STATUS_OPTIONS: EnrollmentStatus[] = ['Passed', 'Failed', 'Pending'];
const CLASSES = [6, 7, 8, 9, 10];
const SECTIONS = ['A', 'B', 'C', 'D'];
const GROUPS = ['Science', 'Humanities', 'Commerce'];

// Pinned Roll + Name columns; opaque backgrounds hide what scrolls under them.
const stickyRoll = 'sticky left-0 z-[1] w-16 min-w-16 bg-inherit';
const stickyName =
  'sticky left-16 z-[1] min-w-[10rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[14rem]';

function StatusBadge({ status }: { status?: string }) {
  if (status === 'Passed') {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
        Passed
      </Badge>
    );
  }
  if (status === 'Failed') {
    return (
      <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700">
        Failed
      </Badge>
    );
  }
  if (status === 'Pending') {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800">
        Pending
      </Badge>
    );
  }
  return <Badge variant="secondary">{status || 'Not set'}</Badge>;
}

function UpdateStatus() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [classSection, setClassSection] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState<{ key: 'name' | 'roll'; order: SortOrder } | null>(null);

  const classNum = selectedClass ? Number(selectedClass) : NaN;

  const {
    data: studentsResponse,
    isLoading,
    isFetching,
    error,
  } = useStudents(
    {
      year,
      page,
      limit,
      level: selectedClass ? classNum : undefined,
      section: classSection || undefined,
      group: classNum >= 9 && group ? group : undefined,
      search: deferredSearch.trim() || undefined,
      searchBy: 'name',
      sort: sort?.key,
      order: sort?.order,
    },
    { enabled: !!selectedClass && !Number.isNaN(classNum) },
  );

  const students = studentsResponse?.data ?? [];
  const meta = studentsResponse?.meta;
  const totalPages = meta?.totalPages ?? 0;
  const totalFiltered = meta?.filtered ?? 0;
  const listLoading = isLoading || isFetching;

  const handleStatusChange = async (student: Student, newStatus: EnrollmentStatus) => {
    if (!student.enrollment_id) {
      toast.error('Missing enrollment id for this student.');
      return;
    }
    if (newStatus === student.status) return;

    setUpdatingId(student.enrollment_id);
    try {
      await axios.put('/api/promotion/updateStatus', {
        id: student.enrollment_id,
        status: newStatus,
      });
      toast.success(`${student.name}: ${newStatus}`);
      await queryClient.invalidateQueries({ queryKey: ['students', year] });
      await queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    } catch {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const sortProps = (key: 'name' | 'roll') => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => {
      setSort(order ? { key, order } : null);
      setPage(1);
    },
  });

  const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');

  const summary = !selectedClass
    ? `Pick a class to adjust pass / fail for ${year}`
    : isLoading
      ? ' '
      : error
        ? `Could not load students for ${year}`
        : `Class ${selectedClass}${classSection ? ` ${classSection}` : ''} · ${year} · ${totalFiltered.toLocaleString()} ${totalFiltered === 1 ? 'student' : 'students'}`;

  const columns = [
    {
      label: 'Roll',
      className: cn(stickyRoll, 'px-3'),
      header: <ColumnHeaderMenu label="Roll" {...sortProps('roll')} />,
    },
    {
      label: 'Name',
      className: cn(stickyName, 'px-3'),
      header: (
        <ColumnHeaderMenu
          label="Name"
          {...sortProps('name')}
          filterInput={{
            value: search,
            onChange: (v) => {
              setSearch(v);
              setPage(1);
            },
            placeholder: 'Student name…',
          }}
        />
      ),
    },
    { label: 'Status', className: 'w-32 px-4', header: 'Status' },
    {
      label: 'Override',
      className: 'w-44 px-4',
      header: search ? (
        <span className="inline-flex items-center gap-1">
          Override
          <ActionButton
            iconOnly
            label="Clear filters"
            icon={<X size={16} />}
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
          />
        </span>
      ) : (
        'Override'
      ),
    },
  ];

  const emptyMessage = !selectedClass
    ? `Select a class to view and override pass/fail status for ${year}.`
    : error
      ? `Could not load students for ${year}.`
      : 'No students match these filters.';

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Override Pass / Fail</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
              className={cn(pickerClass, 'tabular-nums')}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={currentYear - i}>
                  {currentYear - i}
                </option>
              ))}
            </select>
            <select
              aria-label="Class"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setClassSection('');
                setGroup('');
                setPage(1);
              }}
              className={pickerClass}
            >
              {!selectedClass && <option value="">Select class</option>}
              {CLASSES.map((num) => (
                <option key={num} value={String(num)}>
                  Class {num}
                </option>
              ))}
            </select>
            <select
              aria-label="Section"
              value={classSection}
              onChange={(e) => {
                setClassSection(e.target.value);
                setPage(1);
              }}
              className={pickerClass}
              disabled={!selectedClass}
            >
              <option value="">All sections</option>
              {SECTIONS.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
            {classNum >= 9 && (
              <select
                aria-label="Group"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setPage(1);
                }}
                className={pickerClass}
              >
                <option value="">All groups</option>
                {GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <SectionCard noPadding>
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div
          className={cn(
            'overflow-x-auto overscroll-x-contain transition-opacity',
            listLoading && students.length > 0 && 'opacity-50',
          )}
        >
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      'text-foreground/70 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {selectedClass && listLoading && students.length === 0 ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : !selectedClass || error || students.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={cn(
                      'px-4 py-12 text-center text-sm',
                      error && selectedClass ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const updating = updatingId === student.enrollment_id;
                  return (
                    <tr
                      key={student.enrollment_id}
                      className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                    >
                      <td className={cn(stickyRoll, 'px-3 py-2 text-sm tabular-nums')}>
                        {student.roll ?? '—'}
                      </td>
                      <td className={cn(stickyName, 'px-3 py-2')}>
                        <span className="block truncate text-sm font-medium">
                          {student.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={(student.status as EnrollmentStatus) || 'Pending'}
                            disabled={updating}
                            onChange={(e) =>
                              void handleStatusChange(student, e.target.value as EnrollmentStatus)
                            }
                            className={cn(filterSelectClassName, 'h-8 w-32')}
                            aria-label={`Change status for ${student.name || 'student'}`}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          {updating && (
                            <Loader2
                              className="text-muted-foreground h-4 w-4 animate-spin"
                              aria-label="Saving"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedClass && !error && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            loading={listLoading}
            totalFiltered={totalFiltered}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </SectionCard>
    </div>
  );
}

export default UpdateStatus;
