import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SectionCard, filterSelectClassName } from '@/components';
import ActionButton from '@/components/ActionButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useAssignedExamTypes,
  useCreateExam,
  useExams,
  useToggleExamVisibility,
  useUpdateExam,
  type Exam,
} from '@/queries/exam.queries';
import { ExamFormDialog, EXAM_CLASSES } from './exam-form-dialog';
import { ExamSessionRail, yearEndGaps } from './exam-session-rail';
import { ExamWorkbenchRow, stickyCell } from './exam-workbench-card';

const CURRENT_YEAR = new Date().getFullYear();

type StatusFilter = 'all' | 'draft' | 'published' | 'year-end';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const columns: { label: string; className?: string }[] = [
  { label: 'Exam', className: cn(stickyCell, 'px-3 sm:px-4') },
  { label: 'Dates' },
  { label: 'Results' },
  { label: 'Routine' },
  { label: 'Actions', className: 'w-px px-3 text-right' },
];

function ExamPDFRoutine() {
  const [searchParams, setSearchParams] = useSearchParams();
  const year = Number(searchParams.get('year')) || CURRENT_YEAR;
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as StatusFilter) || 'all';
  const classFilter = searchParams.get('class') ?? 'all';
  const dialog = searchParams.get('dialog');
  const editId = Number(searchParams.get('edit')) || null;

  const { data: exams = [], isLoading, isError } = useExams();
  const { data: examTypes = [] } = useAssignedExamTypes();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const toggleVisibility = useToggleExamVisibility();

  const updateParams = (apply: (next: URLSearchParams) => void) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        apply(next);
        return next;
      },
      { replace: true },
    );
  };

  const setParam = (key: string, value: string, fallback = '') =>
    updateParams((next) => {
      if (!value || value === fallback) next.delete(key);
      else next.set(key, value);
    });

  const years = useMemo(() => {
    const fromData = exams.map((exam) => exam.exam_year);
    return [...new Set([CURRENT_YEAR, year, ...fromData])]
      .filter((value) => value >= 2000 && value <= 2100)
      .sort((a, b) => b - a);
  }, [exams, year]);

  const yearExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.exam_year === year)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [exams, year],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return yearExams.filter((exam) => {
      if (status === 'draft' && exam.visible) return false;
      if (status === 'published' && !exam.visible) return false;
      if (status === 'year-end' && !exam.is_year_end) return false;
      if (classFilter !== 'all' && !exam.levels.includes(Number(classFilter))) return false;
      if (needle && !exam.exam_name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [yearExams, query, status, classFilter]);

  const filtersActive = Boolean(query.trim()) || status !== 'all' || classFilter !== 'all';
  const clearFilters = () =>
    updateParams((next) => {
      next.delete('q');
      next.delete('status');
      next.delete('class');
    });

  const gaps = yearEndGaps(yearExams);
  const editingExam = editId ? (exams.find((exam) => exam.id === editId) ?? null) : null;
  const formOpen = dialog === 'create' || (dialog === 'edit' && !!editingExam);

  const published = yearExams.filter((exam) => exam.visible).length;
  const withRoutine = yearExams.filter((exam) => exam.routine).length;
  const summary = isLoading
    ? ' '
    : yearExams.length === 0
      ? `No exams in ${year}`
      : [
          plural(yearExams.length, 'exam'),
          `${published.toLocaleString()} published`,
          `${withRoutine.toLocaleString()} with routine PDF`,
        ].join(' · ');

  const openCreate = () =>
    updateParams((next) => {
      next.set('dialog', 'create');
      next.delete('edit');
    });

  const openEdit = (exam: Exam) =>
    updateParams((next) => {
      next.set('dialog', 'edit');
      next.set('edit', String(exam.id));
    });

  const closeForm = () =>
    updateParams((next) => {
      next.delete('dialog');
      next.delete('edit');
    });

  const scrollToExam = (examId: number) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`exam-${examId}`)
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <p>Couldn&apos;t load exams. Try again in a moment.</p>
      ) : yearExams.length === 0 ? (
        <>
          <p>No exams in {year} yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            <Plus /> Create exam
          </Button>
        </>
      ) : (
        <>
          <p>No exams match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Exams</h1>
            <select
              aria-label="Session year"
              value={year}
              onChange={(e) => setParam('year', e.target.value, String(CURRENT_YEAR))}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium')}
            >
              {years.map((value) => (
                <option key={value} value={value}>
                  Session {value}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> Create exam
        </Button>
      </header>

      <ExamSessionRail exams={yearExams} onSelect={scrollToExam} />

      {gaps.length > 0 ? (
        <Alert className="mb-4 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Missing year-end exam</AlertTitle>
          <AlertDescription>
            No year-end exam for class {gaps.join(', ')}. Pass/fail and promotion need one covering
            each class.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            name="q"
            aria-label="Search exams"
            value={query}
            placeholder="Search by name…"
            className="h-9 pl-8"
            onChange={(e) => setParam('q', e.target.value)}
          />
        </div>
        <select
          aria-label="Status"
          className={cn(filterSelectClassName, 'w-auto')}
          value={status}
          onChange={(e) => setParam('status', e.target.value, 'all')}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="year-end">Year end</option>
        </select>
        <select
          aria-label="Class"
          className={cn(filterSelectClassName, 'w-auto')}
          value={classFilter}
          onChange={(e) => setParam('class', e.target.value, 'all')}
        >
          <option value="all">All classes</option>
          {EXAM_CLASSES.map((level) => (
            <option key={level} value={level}>
              Class {level}
            </option>
          ))}
        </select>
      </div>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.label !== 'Actions' ? (
                      col.label
                    ) : filtersActive ? (
                      <ActionButton
                        iconOnly
                        label="Clear filters"
                        icon={<X size={16} />}
                        onClick={clearFilters}
                      />
                    ) : (
                      <span className="sr-only">Actions</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((exam) => (
                  <ExamWorkbenchRow
                    key={exam.id}
                    exam={exam}
                    onEdit={openEdit}
                    onTogglePublish={(item) =>
                      toggleVisibility.mutate({ id: item.id, visible: !item.visible })
                    }
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ExamFormDialog
        open={formOpen}
        onOpenChange={(next) => {
          if (!next) closeForm();
        }}
        exam={editingExam}
        defaultYear={year}
        examTypes={examTypes}
        saving={createExam.isPending || updateExam.isPending}
        onSubmit={async (payload) => {
          if (editingExam) {
            await updateExam.mutateAsync({ id: editingExam.id, payload });
          } else {
            await createExam.mutateAsync(payload);
          }
          closeForm();
        }}
      />
    </div>
  );
}

export default ExamPDFRoutine;
