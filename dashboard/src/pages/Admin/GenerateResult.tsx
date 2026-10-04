import { useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  GraduationCap,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ActionButton,
  Popup,
  SectionCard,
  TablePagination,
  filterSelectClassName,
} from '@/components';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import { useStudents, type StudentSortKey } from '@/queries/students.queries';
import { useExams } from '@/queries/exam.queries';
import {
  useUpdatePromotionStatus,
  useGeneratePromotionRoll,
  usePromotionPreview,
  useGraduationPreview,
  useGraduateClass10,
  useOverrideEnrollmentStatus,
  usePromotionYearStats,
  usePromotionPassRules,
  useSavePromotionPassRules,
  PROMOTION_PASS_CLASSES,
  ENROLLMENT_STATUS_OPTIONS,
  type EnrollmentStatus,
  type PromotionPreview,
  type GraduationPreview,
  type PromotionPassRule,
} from '@/queries/promotion.queries';
import {
  CloseButton,
  PromotionPreviewDialog,
  thClass,
  theadRowClass,
} from '@/pages/Admin/PromotionPreviewDialog';
import { GraduationPreviewDialog } from '@/pages/Admin/GraduationPreviewDialog';
import { yearEndGaps } from '@/pages/Admin/exam-session-rail';
import { openBlobInNewTab } from '@school/common-ui/blob';
import type { Student } from '@/types/students';

const PAGE_SIZE_KEY = 'promotionReviewPageSize';
const YEAR_KEY = 'generateResultYear';
const FILTERS_KEY = 'generateResultFilters';
const GROUPS = ['Science', 'Humanities', 'Commerce'];

type Filters = { levels: string[]; sections: string[]; groups: string[] };
const NO_FILTERS: Filters = { levels: [], sections: [], groups: [] };

// sessionStorage can throw (private mode, blocked storage); the page works without it.
const readStore = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

// Merit + Student columns stay pinned while the table scrolls sideways.
const stickyCell = 'sticky z-[1] bg-inherit';
const stickyEdge = 'shadow-[1px_0_0_var(--border)]';

function StatusBadge({ status }: { status?: string }) {
  if (status === 'Graduated') {
    return (
      <Badge
        variant="outline"
        className="border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300"
      >
        Graduated
      </Badge>
    );
  }
  return <Badge variant="secondary">{status || '—'}</Badge>;
}

function StatusOverrideSelect({
  student,
  disabled,
  onChange,
}: {
  student: Student;
  disabled?: boolean;
  onChange: (student: Student, status: EnrollmentStatus) => void;
}) {
  if (student.status === 'Graduated') return <StatusBadge status={student.status} />;
  const value = ENROLLMENT_STATUS_OPTIONS.includes(student.status as EnrollmentStatus)
    ? (student.status as EnrollmentStatus)
    : 'Pending';

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={`Override status for ${student.name || 'student'}`}
      className={cn(
        filterSelectClassName,
        'h-8 w-auto min-w-[6.5rem] text-xs',
        value === 'Passed' && 'text-emerald-700 dark:text-emerald-400',
        value === 'Failed' && 'text-red-700 dark:text-red-400',
        value === 'Pending' && 'text-amber-800 dark:text-amber-300',
      )}
      onChange={(e) => onChange(student, e.target.value as EnrollmentStatus)}
    >
      {ENROLLMENT_STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function meritBadgeClass(merit?: number) {
  if (merit === 1) return 'bg-amber-500 text-white';
  if (merit === 2) return 'bg-zinc-400 text-white';
  if (merit === 3) return 'bg-amber-700 text-white';
  return 'bg-muted text-foreground/80';
}

function Step({
  n,
  title,
  icon,
  done,
  detail,
  children,
}: {
  n: number;
  title: string;
  icon: ReactNode;
  done: boolean;
  detail: ReactNode;
  children: ReactNode;
}) {
  const Check = done ? CheckCircle2 : Circle;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {n} · {title}
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                done ? 'text-emerald-600' : 'text-muted-foreground',
              )}
              aria-label={done ? 'Done' : 'Not done'}
            />
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const GenerateResult = () => {
  const currentYear = new Date().getFullYear();
  const { confirm, dialog } = useConfirmDialog();
  const [year, setYear] = useState<number>(() => {
    const y = Number(readStore(YEAR_KEY));
    return y >= currentYear - 4 && y <= currentYear ? y : currentYear;
  });
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      return { ...NO_FILTERS, ...JSON.parse(readStore(FILTERS_KEY) || '{}') };
    } catch {
      return NO_FILTERS;
    }
  });
  const [sort, setSort] = useState<{ key: StudentSortKey; order: SortOrder } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PromotionPreview | null>(null);
  const [graduationOpen, setGraduationOpen] = useState(false);
  const [graduationData, setGraduationData] = useState<GraduationPreview | null>(null);
  const [overridingId, setOverridingId] = useState<number | null>(null);
  const [rulesDraft, setRulesDraft] = useState<PromotionPassRule[] | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(() => {
    const n = Number(readStore(PAGE_SIZE_KEY));
    return [25, 50, 100, 200].includes(n) ? n : 50;
  });

  const { data: exams = [] } = useExams();
  const yearExams = useMemo(() => exams.filter((exam) => exam.exam_year === year), [exams, year]);
  const gaps = useMemo(() => yearEndGaps(yearExams), [yearExams]);
  const yearEndReady = gaps.length === 0;

  const { data: yearStats } = usePromotionYearStats(year);
  const { data: passRules = [] } = usePromotionPassRules(year);
  const { mutate: savePassRules, isPending: isSavingPassRules } = useSavePromotionPassRules();

  // Saved rules per class; a class with no saved rule is strict (0 fails allowed).
  const savedRules = useMemo<PromotionPassRule[]>(
    () =>
      PROMOTION_PASS_CLASSES.map((cls) => ({
        class: cls,
        max_failed: passRules.find((r) => r.class === cls)?.max_failed ?? 0,
      })),
    [passRules],
  );
  const passRulesByClass = useMemo(
    () => Object.fromEntries(savedRules.map((r) => [r.class, r.max_failed])),
    [savedRules],
  );
  const passRulesSummary = savedRules.map((r) => `${r.class}: ${r.max_failed}`).join(' · ');

  const {
    data: studentsResponse,
    isLoading: studentsLoading,
    isFetching: studentsFetching,
    error: studentsError,
  } = useStudents(
    {
      year,
      page,
      limit,
      levels: filters.levels.map(Number),
      sections: filters.sections,
      groups: filters.groups,
      sort: sort?.key,
      order: sort?.order,
    },
    { keepPreviousPage: true },
  );

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdatePromotionStatus();
  const { mutate: fetchPreview, isPending: isPreviewLoading } = usePromotionPreview();
  const { mutate: fetchGraduationPreview, isPending: isGraduationPreviewLoading } =
    useGraduationPreview();
  const { mutate: generateRoll, isPending: isGeneratingRoll } = useGeneratePromotionRoll();
  const { mutate: graduateClass10, isPending: isGraduating } = useGraduateClass10();
  const { mutate: overrideStatus } = useOverrideEnrollmentStatus();

  const students = useMemo(() => studentsResponse?.data ?? [], [studentsResponse]);
  const meta = studentsResponse?.meta;
  const totalFiltered = meta?.filtered ?? 0;
  const promoteBusy = isPreviewLoading || isGeneratingRoll;
  const graduationBusy = isGraduationPreviewLoading || isGraduating;

  // Default order is merit within the page; a header sort hands ordering to the server.
  const rows = useMemo(
    () =>
      sort
        ? students
        : [...students].sort(
            (a, b) =>
              (a.final_merit || 9999) - (b.final_merit || 9999) ||
              a.class - b.class ||
              (a.section || '').localeCompare(b.section || '') ||
              (Number(a.roll) || 0) - (Number(b.roll) || 0),
          ),
    [students, sort],
  );

  const promo = yearStats?.promotion;
  const class10 = yearStats?.class10;
  const meritAssigned = yearStats?.merit_assigned ?? false;
  const nextYearTotal = yearStats?.next_year_enrollments ?? 0;
  const class10Graduated = (class10?.graduated ?? 0) > 0;

  const handleYearChange = (value: string) => {
    setYear(Number(value));
    setPage(1);
    writeStore(YEAR_KEY, value);
  };

  const updateFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    writeStore(FILTERS_KEY, JSON.stringify(next));
  };
  const filtersActive = filters.levels.length + filters.sections.length + filters.groups.length > 0;

  const sortProps = (key: StudentSortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => {
      setSort(order ? { key, order } : null);
      setPage(1);
    },
  });

  const blockIfNotReady = () => {
    if (yearEndReady) return false;
    toast.error(`Missing year-end exams for class ${gaps.join(', ')}`);
    return true;
  };

  const handleGenerateResult = async () => {
    if (blockIfNotReady()) return;
    const ok = await confirm({
      title: 'Generate pass/fail?',
      msg: `Recalculate pass/fail for all students in ${year} from year-end marks.\n\nAllowed failed subjects by class — ${passRulesSummary}.\n\nManual overrides may be overwritten.`,
      confirmLabel: 'Generate',
    });
    if (ok) updateStatus(year);
  };

  const handleOpenPreview = () => {
    if (blockIfNotReady()) return;
    setPreviewOpen(true);
    setPreviewData(null);
    fetchPreview(year, {
      onSuccess: (data) => {
        if (data.summary.total === 0) {
          toast.error(`No students in classes 6–9 for ${year}.`);
          setPreviewOpen(false);
          return;
        }
        setPreviewData(data);
      },
      onError: () => setPreviewOpen(false),
    });
  };

  const handleConfirmPromote = () => {
    generateRoll(year, {
      onSuccess: () => {
        setPreviewOpen(false);
        setPreviewData(null);
      },
    });
  };

  const handleOpenGraduationPreview = () => {
    if (blockIfNotReady()) return;
    setGraduationOpen(true);
    setGraduationData(null);
    fetchGraduationPreview(year, {
      onSuccess: (data) => {
        if (data.summary.total === 0) {
          toast.error(`No active class-10 students for ${year}.`);
          setGraduationOpen(false);
          return;
        }
        setGraduationData(data);
      },
      onError: () => setGraduationOpen(false),
    });
  };

  const handleConfirmGraduation = () => {
    graduateClass10(year, {
      onSuccess: () => {
        setGraduationOpen(false);
        setGraduationData(null);
      },
    });
  };

  const handleStatusOverride = (student: Student, status: EnrollmentStatus) => {
    if (!student.enrollment_id || student.status === status) return;
    setOverridingId(student.enrollment_id);
    overrideStatus(
      { enrollmentId: student.enrollment_id, status },
      {
        onSuccess: () => toast.success(`${student.name}: ${status}`),
        onSettled: () => setOverridingId(null),
      },
    );
  };

  const handleSaveRules = () => {
    if (!rulesDraft) return;
    savePassRules({ year, rules: rulesDraft }, { onSuccess: () => setRulesDraft(null) });
  };

  const downloadPdf = async (url: string, error: string) => {
    try {
      const response = await axios.get(url, { responseType: 'blob' });
      openBlobInNewTab(new Blob([response.data], { type: 'application/pdf' }));
    } catch {
      toast.error(error);
    }
  };
  const downloadSessionMarksheet = (studentId: number) =>
    downloadPdf(`/api/marks/${studentId}/${year}/download`, 'Failed to download session marksheet');
  const downloadAllMarksheetPDF = () =>
    downloadPdf(`/api/marks/all/${year}`, 'Failed to download all marksheets');

  const summary = promo
    ? `${promo.total.toLocaleString()} in classes 6–9 · ${promo.passed} passed · ${promo.failed} failed · ${promo.pending} pending · promotes into ${year + 1}`
    : `Promotes into ${year + 1}`;

  const classOptions = (meta?.availableClasses ?? [6, 7, 8, 9, 10]).map((c) => ({
    value: String(c),
    label: `Class ${c}`,
  }));
  const sectionOptions = (meta?.availableSections ?? ['A', 'B', 'C', 'D']).map((s) => ({
    value: s,
    label: `Section ${s}`,
  }));

  const colCount = 10;
  const showSkeleton = studentsLoading && students.length === 0;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <PromotionPreviewDialog
        open={previewOpen}
        preview={previewData}
        loading={isPreviewLoading}
        committing={isGeneratingRoll}
        onOpenChange={setPreviewOpen}
        onConfirm={handleConfirmPromote}
      />
      <GraduationPreviewDialog
        open={graduationOpen}
        preview={graduationData}
        loading={isGraduationPreviewLoading}
        committing={isGraduating}
        onOpenChange={setGraduationOpen}
        onConfirm={handleConfirmGraduation}
      />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Year-End Promotion</h1>
            <select
              aria-label="Session year"
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium')}
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>
                  Session {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadAllMarksheetPDF()}
          disabled={totalFiltered === 0}
        >
          <Download /> All session PDFs
        </Button>
      </header>

      {!yearEndReady && (
        <Alert className="mb-6 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Missing year-end exam</AlertTitle>
          <AlertDescription>
            No year-end exam for class {gaps.join(', ')}. Pass/fail and promotion need one covering
            each class — create them in Exam Management.
          </AlertDescription>
        </Alert>
      )}

      <div className="border-border bg-card divide-border mb-6 grid divide-y rounded-xl border shadow-sm lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <Step
          n={1}
          title="Pass / fail"
          icon={<RefreshCw className="h-5 w-5 text-blue-600" />}
          done={(promo?.passed ?? 0) + (promo?.failed ?? 0) > 0}
          detail={
            <>
              Allowed failed subjects by class — {passRulesSummary}. Override single students in the
              table.
            </>
          }
        >
          <Button
            type="button"
            size="sm"
            onClick={() => void handleGenerateResult()}
            disabled={isUpdatingStatus || !yearEndReady}
          >
            <RefreshCw className={cn(isUpdatingStatus && 'animate-spin')} />
            Generate pass/fail
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRulesDraft(savedRules)}
          >
            <SlidersHorizontal /> Pass rules
          </Button>
        </Step>

        <Step
          n={2}
          title="Merit & promotion"
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          done={meritAssigned}
          detail={
            <>
              Classes 6–9 → {year + 1}.{' '}
              {nextYearTotal === 0
                ? 'No enrollments there yet — safe to promote.'
                : `${nextYearTotal} enrollment${nextYearTotal === 1 ? '' : 's'} exist — re-running replaces them.`}
            </>
          }
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleOpenPreview}
            disabled={promoteBusy || !yearEndReady}
          >
            {promoteBusy ? <RefreshCw className="animate-spin" /> : <Trophy />}
            Review & promote
          </Button>
        </Step>

        <Step
          n={3}
          title="Class 10 graduation"
          icon={<GraduationCap className="h-5 w-5 text-sky-600" />}
          done={class10Graduated || class10?.total === 0}
          detail={
            !class10
              ? 'Graduate passed SSC students to alumni; retain failed students in class 10.'
              : class10.total === 0
                ? 'No active class-10 students for this year.'
                : class10Graduated
                  ? `${class10.graduated} graduated · ${class10.passed} pending · ${class10.failed} failed`
                  : `${class10.total} active · ${class10.passed} passed · ${class10.failed} failed`
          }
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleOpenGraduationPreview}
            disabled={graduationBusy || !yearEndReady}
          >
            {graduationBusy ? <RefreshCw className="animate-spin" /> : <GraduationCap />}
            Review & graduate
          </Button>
        </Step>
      </div>

      <SectionCard noPadding>
        <div
          className={cn(
            'overflow-x-auto',
            studentsFetching && !studentsLoading && 'opacity-60 transition-opacity',
          )}
        >
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead>
              <tr className={theadRowClass}>
                <th className={cn(thClass, stickyCell, 'left-0 w-14 px-3 text-center')}>Merit</th>
                <th className={cn(thClass, stickyCell, stickyEdge, 'left-14 px-4')}>
                  <ColumnHeaderMenu label="Student" {...sortProps('name')} />
                </th>
                <th className={cn(thClass, 'px-4')}>
                  <ColumnHeaderMenu
                    label="Class"
                    {...sortProps('class')}
                    options={classOptions}
                    selected={filters.levels}
                    onSelectedChange={(levels) => updateFilters({ levels })}
                  />
                </th>
                <th className={cn(thClass, 'px-4')}>
                  <ColumnHeaderMenu
                    label="Sec"
                    {...sortProps('section')}
                    options={sectionOptions}
                    selected={filters.sections}
                    onSelectedChange={(sections) => updateFilters({ sections })}
                  />
                </th>
                <th className={cn(thClass, 'px-4')}>
                  <ColumnHeaderMenu
                    label="Group"
                    {...sortProps('group')}
                    options={GROUPS.map((g) => ({ value: g, label: g }))}
                    selected={filters.groups}
                    onSelectedChange={(groups) => updateFilters({ groups })}
                  />
                </th>
                <th className={cn(thClass, 'px-4')}>
                  <ColumnHeaderMenu label="Roll" {...sortProps('roll')} />
                </th>
                <th className={cn(thClass, 'px-4')}>Status</th>
                <th className={cn(thClass, 'px-4 text-center')} title="Failed subjects / allowed">
                  Fails
                </th>
                <th className={cn(thClass, 'px-4 text-center')}>Next sec · roll</th>
                <th className={cn(thClass, 'px-3 text-right')}>
                  {filtersActive ? (
                    <ActionButton
                      iconOnly
                      label="Clear filters"
                      icon={<X size={16} />}
                      onClick={() => updateFilters(NO_FILTERS)}
                    />
                  ) : (
                    <span className="sr-only">Actions</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {showSkeleton ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={colCount} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="text-muted-foreground py-16 text-center text-sm"
                  >
                    {studentsError
                      ? 'Could not load students.'
                      : 'No students match these filters.'}
                  </td>
                </tr>
              ) : (
                rows.map((student) => (
                  <tr
                    key={student.enrollment_id ?? student.id}
                    className="bg-card text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'left-0 w-14 px-3 py-2 text-center')}>
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                          meritBadgeClass(student.final_merit),
                        )}
                      >
                        {student.final_merit || '—'}
                      </span>
                    </td>
                    <td className={cn(stickyCell, stickyEdge, 'left-14 px-4 py-2')}>
                      <span className="block max-w-[12rem] truncate font-medium uppercase sm:max-w-[16rem]">
                        {student.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{student.class}</td>
                    <td className="px-4 py-2">{student.section || '—'}</td>
                    <td className="px-4 py-2">
                      {student.group || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{student.roll || '—'}</td>
                    <td className="px-4 py-2">
                      <StatusOverrideSelect
                        student={student}
                        disabled={overridingId === student.enrollment_id}
                        onChange={handleStatusOverride}
                      />
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-center text-xs tabular-nums">
                      {student.fail_count != null
                        ? `${student.fail_count}/${passRulesByClass[student.class] ?? 0}`
                        : '—'}
                    </td>
                    <td className="text-primary px-4 py-2 text-center font-semibold tabular-nums">
                      {student.next_year_section || student.next_year_roll
                        ? `${student.next_year_section || '—'} · ${student.next_year_roll || '—'}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <ActionButton
                            iconOnly
                            label="More actions"
                            icon={<MoreHorizontal size={16} />}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="truncate normal-case tracking-normal">
                            {student.name}
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onSelect={() => void downloadSessionMarksheet(student.id)}
                          >
                            <FileText /> Session marksheet PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={meta?.totalPages ?? 0}
          limit={limit}
          loading={studentsFetching}
          totalFiltered={meta ? totalFiltered : undefined}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
            writeStore(PAGE_SIZE_KEY, String(next));
          }}
        />
      </SectionCard>

      <Popup
        open={rulesDraft !== null}
        onOpenChange={(o) => !o && setRulesDraft(null)}
        size="md"
        aria-labelledby="pass-rules-title"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 id="pass-rules-title" className="text-base font-semibold">
            Pass rules · {year}
          </h2>
          <CloseButton onClick={() => setRulesDraft(null)} />
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
          <p className="text-muted-foreground text-sm">
            Allowed failed subjects per class. 0 = strict (any failed subject fails). A student
            passes when failed subjects ≤ this limit.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rulesDraft?.map((rule) => (
              <label
                key={rule.class}
                className="border-border flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm"
              >
                <span className="font-medium">Class {rule.class}</span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={rule.max_failed}
                  onChange={(e) => {
                    const max_failed = Math.max(
                      0,
                      Math.min(15, Number.parseInt(e.target.value, 10) || 0),
                    );
                    setRulesDraft(
                      (prev) =>
                        prev?.map((r) => (r.class === rule.class ? { ...r, max_failed } : r)) ??
                        null,
                    );
                  }}
                  className="border-input bg-background h-8 w-14 rounded-md border px-2 text-center text-sm tabular-nums"
                  aria-label={`Allowed failed subjects for class ${rule.class}`}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={() => setRulesDraft(null)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveRules} disabled={isSavingPassRules}>
            {isSavingPassRules ? 'Saving…' : 'Save rules'}
          </Button>
        </div>
      </Popup>
    </div>
  );
};

export default GenerateResult;
