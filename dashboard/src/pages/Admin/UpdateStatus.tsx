import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  FilterSelection,
  FilterField,
  filterSelectClassName,
  TablePagination,
} from '@/components';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStudents } from '@/queries/students.queries';
import type { Student } from '@/types/students';

type EnrollmentStatus = 'Passed' | 'Failed' | 'Pending';

const STATUS_OPTIONS: EnrollmentStatus[] = ['Passed', 'Failed', 'Pending'];

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
  return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Override Pass / Fail"
        description="Adjust individual student results after running year-end pass/fail. Changes apply to the selected enrollment only."
      />

      <FilterSelection>
        <FilterField label="Year" htmlFor="override-year">
          <select
            id="override-year"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPage(1);
            }}
            className={filterSelectClassName}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={currentYear - i}>
                {currentYear - i}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Class" htmlFor="override-class">
          <select
            id="override-class"
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setClassSection('');
              setGroup('');
              setPage(1);
            }}
            className={filterSelectClassName}
          >
            <option value="">Select class…</option>
            {[6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={String(num)}>
                Class {num}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Section" htmlFor="override-section">
          <select
            id="override-section"
            value={classSection}
            onChange={(e) => {
              setClassSection(e.target.value);
              setPage(1);
            }}
            className={filterSelectClassName}
            disabled={!selectedClass}
          >
            <option value="">All sections</option>
            {['A', 'B', 'C', 'D'].map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </FilterField>
        {classNum >= 9 && (
          <FilterField label="Group" htmlFor="override-group">
            <select
              id="override-group"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setPage(1);
              }}
              className={filterSelectClassName}
            >
              <option value="">All groups</option>
              {['Science', 'Humanities', 'Commerce'].map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </FilterField>
        )}
      </FilterSelection>

      {!selectedClass ? (
        <SectionCard>
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
            Select a class to view and override pass/fail status for {year}.
          </p>
        </SectionCard>
      ) : listLoading && students.length === 0 ? (
        <SectionCard>
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading students…
          </div>
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <p className="text-destructive px-4 py-8 text-center text-sm">
            Could not load students for {year}.
          </p>
        </SectionCard>
      ) : students.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            No students match these filters.
          </p>
        </SectionCard>
      ) : (
        <SectionCard
          title={`Class ${selectedClass} · ${year}`}
          icon={<Users size={20} />}
          description={`${totalFiltered.toLocaleString()} match · page ${page} of ${Math.max(totalPages, 1)}`}
          noPadding
        >
          <div className={cn('hidden overflow-x-auto lg:block', listLoading && 'opacity-50')}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold tracking-wider uppercase">
                    Name
                  </th>
                  <th className="p-3 text-left text-xs font-semibold tracking-wider uppercase">
                    Roll
                  </th>
                  <th className="p-3 text-left text-xs font-semibold tracking-wider uppercase">
                    Status
                  </th>
                  <th className="p-3 text-left text-xs font-semibold tracking-wider uppercase">
                    Override
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.enrollment_id} className="border-border border-b">
                    <td className="p-3 font-medium">{student.name || 'N/A'}</td>
                    <td className="text-muted-foreground p-3 tabular-nums">{student.roll}</td>
                    <td className="p-3">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="p-3">
                      <select
                        value={(student.status as EnrollmentStatus) || 'Pending'}
                        disabled={updatingId === student.enrollment_id}
                        onChange={(e) =>
                          void handleStatusChange(student, e.target.value as EnrollmentStatus)
                        }
                        className={filterSelectClassName}
                        aria-label={`Change status for ${student.name || 'student'}`}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={cn('space-y-3 p-4 lg:hidden', listLoading && 'opacity-50')}>
            {students.map((student) => (
              <li
                key={student.enrollment_id}
                className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold wrap-break-word">{student.name || 'N/A'}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      Roll {student.roll}
                    </p>
                  </div>
                  <StatusBadge status={student.status} />
                </div>
                <label className="block space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">Override status</span>
                  <select
                    value={(student.status as EnrollmentStatus) || 'Pending'}
                    disabled={updatingId === student.enrollment_id}
                    onChange={(e) =>
                      void handleStatusChange(student, e.target.value as EnrollmentStatus)
                    }
                    className={filterSelectClassName}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>

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
        </SectionCard>
      )}
    </div>
  );
}

export default UpdateStatus;
