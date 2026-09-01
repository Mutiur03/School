import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader, FilterSelection, FilterField, filterSelectClassName } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Loading from '@/components/Loading';
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
import { ExamWorkbenchCard } from './exam-workbench-card';

const CURRENT_YEAR = new Date().getFullYear();

type StatusFilter = 'all' | 'draft' | 'published' | 'year-end';

function ExamPDFRoutine() {
  const [searchParams, setSearchParams] = useSearchParams();
  const year = Number(searchParams.get('year')) || CURRENT_YEAR;
  const query = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as StatusFilter) || 'all';
  const classFilter = searchParams.get('class') ?? 'all';
  const dialog = searchParams.get('dialog');
  const editId = Number(searchParams.get('edit')) || null;

  const { data: exams = [], isLoading } = useExams();
  const { data: examTypes = [] } = useAssignedExamTypes();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const toggleVisibility = useToggleExamVisibility();

  const setParam = (key: string, value: string, fallback = '') => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

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

  const gaps = yearEndGaps(yearExams);
  const editingExam = editId ? (exams.find((exam) => exam.id === editId) ?? null) : null;
  const formOpen = dialog === 'create' || (dialog === 'edit' && !!editingExam);

  const openCreate = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('dialog', 'create');
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  };

  const openEdit = (exam: Exam) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('dialog', 'edit');
        next.set('edit', String(exam.id));
        return next;
      },
      { replace: true },
    );
  };

  const closeForm = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('dialog');
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  };

  const scrollToExam = (examId: number) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`exam-${examId}`)
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Exam Management"
        description="Run the session calendar: create exams, publish results, attach routines."
      >
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Exam
        </Button>
      </PageHeader>

      <FilterSelection>
        <FilterField label="Session year" htmlFor="exam-year">
          <select
            id="exam-year"
            className={filterSelectClassName}
            value={year}
            onChange={(e) => setParam('year', e.target.value, String(CURRENT_YEAR))}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status" htmlFor="exam-status">
          <select
            id="exam-status"
            className={filterSelectClassName}
            value={status}
            onChange={(e) => setParam('status', e.target.value, 'all')}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="year-end">Year end</option>
          </select>
        </FilterField>
        <FilterField label="Class" htmlFor="exam-class">
          <select
            id="exam-class"
            className={filterSelectClassName}
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
        </FilterField>
        <FilterField label="Search exams" htmlFor="exam-search" wide>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="exam-search"
              name="q"
              value={query}
              placeholder="Search by name…"
              className="h-9 pl-8"
              onChange={(e) => setParam('q', e.target.value)}
            />
          </div>
        </FilterField>
      </FilterSelection>

      <div className="mt-6">
        <ExamSessionRail exams={yearExams} onSelect={scrollToExam} />
      </div>

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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loading />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border rounded-xl border px-6 py-16 text-center">
          <p className="text-foreground text-sm font-medium">
            {yearExams.length === 0 ? `No exams in ${year}` : 'No exams match these filters'}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {yearExams.length === 0
              ? 'Create the first exam for this session.'
              : 'Clear search or status to see the rest of the session.'}
          </p>
          {yearExams.length === 0 ? (
            <Button type="button" className="mt-4" onClick={openCreate}>
              Create Exam
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((exam) => (
            <li key={exam.id}>
              <ExamWorkbenchCard
                exam={exam}
                onEdit={openEdit}
                onTogglePublish={(item) =>
                  toggleVisibility.mutate({ id: item.id, visible: !item.visible })
                }
              />
            </li>
          ))}
        </ul>
      )}

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
