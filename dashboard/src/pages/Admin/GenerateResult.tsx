import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  Users,
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  Trophy,
  GraduationCap,
  ClipboardCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  PageHeader,
  SectionCard,
  FilterSelection,
  FilterField,
  filterSelectClassName,
  TablePagination,
} from '@/components';
import Loading from '@/components/Loading';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import { useStudents } from '@/queries/students.queries';
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
import { PromotionPreviewDialog } from '@/pages/Admin/PromotionPreviewDialog';
import { GraduationPreviewDialog } from '@/pages/Admin/GraduationPreviewDialog';
import { yearEndGaps } from '@/pages/Admin/exam-session-rail';
import { openBlobInNewTab } from '@school/common-ui/blob';
import type { Student } from '@/types/students';

const PAGE_SIZE_KEY = 'promotionReviewPageSize';

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
  if (status === 'Graduated') {
    return (
      <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-800">
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
  if (student.status === 'Graduated') {
    return <StatusBadge status={student.status} />;
  }

  const value = ENROLLMENT_STATUS_OPTIONS.includes(student.status as EnrollmentStatus)
    ? (student.status as EnrollmentStatus)
    : 'Pending';

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={`Override status for ${student.name || 'student'}`}
      className={cn(filterSelectClassName, 'h-8 min-w-[6.5rem] px-2 text-xs')}
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

function ReadinessItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <li className="flex gap-3 text-sm">
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', ok ? 'text-emerald-600' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs">{detail}</span>
      </span>
    </li>
  );
}

function meritBadgeClass(merit?: number) {
  if (merit === 1) return 'bg-amber-500 text-white';
  if (merit === 2) return 'bg-zinc-400 text-white';
  if (merit === 3) return 'bg-amber-700 text-white';
  return 'bg-muted text-muted-foreground';
}

const GenerateResult = () => {
  const currentYear = new Date().getFullYear();
  const { confirm, dialog } = useConfirmDialog();
  const [year, setYear] = useState<number>(currentYear);
  const [classSection, setClassSection] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PromotionPreview | null>(null);
  const [graduationOpen, setGraduationOpen] = useState(false);
  const [graduationData, setGraduationData] = useState<GraduationPreview | null>(null);
  const [overridingId, setOverridingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(() => {
    const stored = sessionStorage.getItem(PAGE_SIZE_KEY);
    const n = stored ? Number(stored) : 50;
    return [25, 50, 100, 200].includes(n) ? n : 50;
  });

  const { data: exams = [] } = useExams();
  const yearExams = useMemo(() => exams.filter((exam) => exam.exam_year === year), [exams, year]);
  const gaps = useMemo(() => yearEndGaps(yearExams), [yearExams]);

  const { data: yearStats } = usePromotionYearStats(year);
  const { data: passRules = [] } = usePromotionPassRules(year);
  const [localPassRules, setLocalPassRules] = useState<PromotionPassRule[]>(() =>
    PROMOTION_PASS_CLASSES.map((cls) => ({ class: cls, max_failed: 0 })),
  );
  const { mutateAsync: savePassRules, isPending: isSavingPassRules } = useSavePromotionPassRules();

  useEffect(() => {
    if (passRules.length > 0) {
      setLocalPassRules(passRules);
    }
  }, [passRules]);

  const passRulesByClass = useMemo(
    () => Object.fromEntries(localPassRules.map((r) => [r.class, r.max_failed])),
    [localPassRules],
  );

  const passRulesDirty = useMemo(() => {
    if (passRules.length === 0) return false;
    return localPassRules.some((rule) => {
      const saved = passRules.find((r) => r.class === rule.class);
      return (saved?.max_failed ?? 0) !== rule.max_failed;
    });
  }, [localPassRules, passRules]);

  const passRulesSummary = useMemo(
    () =>
      localPassRules
        .map(
          (r) => `Class ${r.class}: ${r.max_failed} fail${r.max_failed === 1 ? '' : 's'} allowed`,
        )
        .join(' · '),
    [localPassRules],
  );

  const {
    data: studentsResponse,
    isLoading: studentsLoading,
    isFetching: studentsFetching,
    error: studentsError,
  } = useStudents({
    year,
    page,
    limit,
    level: selectedClass ? Number(selectedClass) : undefined,
    section: classSection || undefined,
    group: Number(selectedClass) >= 9 && group ? group : undefined,
  });

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdatePromotionStatus();
  const { mutate: fetchPreview, isPending: isPreviewLoading } = usePromotionPreview();
  const { mutate: fetchGraduationPreview, isPending: isGraduationPreviewLoading } =
    useGraduationPreview();
  const { mutate: generateRoll, isPending: isGeneratingRoll } = useGeneratePromotionRoll();
  const { mutate: graduateClass10, isPending: isGraduating } = useGraduateClass10();
  const { mutate: overrideStatus } = useOverrideEnrollmentStatus();

  const students = studentsResponse?.data ?? [];
  const meta = studentsResponse?.meta;
  const totalPages = meta?.totalPages ?? 0;
  const totalFiltered = meta?.filtered ?? 0;
  const listLoading = studentsLoading || studentsFetching;
  const loading = listLoading || isUpdatingStatus || isGeneratingRoll || isGraduating;
  const promoteBusy = isPreviewLoading || isGeneratingRoll;
  const graduationBusy = isGraduationPreviewLoading || isGraduating;

  useEffect(() => {
    const storedYear = sessionStorage.getItem('generateResultYear');
    const storedClass = sessionStorage.getItem('generateResultClass');
    const storedSection = sessionStorage.getItem('generateResultSection');
    const storedGroup = sessionStorage.getItem('generateResultGroup');

    if (storedYear) {
      const y = Number(storedYear);
      setYear(y >= currentYear - 1 && y <= currentYear ? y : currentYear);
    }
    if (storedClass) setSelectedClass(storedClass);
    if (storedSection) setClassSection(storedSection);
    if (storedGroup) setGroup(storedGroup);
  }, []);

  const handleYearChange = (value: string) => {
    setYear(Number(value));
    setPage(1);
    sessionStorage.setItem('generateResultYear', value);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setGroup('');
    setClassSection('');
    setPage(1);
    sessionStorage.setItem('generateResultClass', value);
  };

  const handleSectionChange = (value: string) => {
    setClassSection(value);
    setPage(1);
    sessionStorage.setItem('generateResultSection', value);
  };

  const handleGroupChange = (value: string) => {
    setGroup(value);
    setPage(1);
    sessionStorage.setItem('generateResultGroup', value);
  };

  const statusSummary = yearStats?.promotion ?? { passed: 0, failed: 0, pending: 0, total: 0 };
  const class10Summary = yearStats?.class10 ?? { passed: 0, failed: 0, graduated: 0, total: 0 };
  const meritAssigned = yearStats?.merit_assigned ?? false;
  const nextYearTotal = yearStats?.next_year_enrollments ?? 0;
  const class10Graduated = class10Summary.graduated > 0;

  const yearEndReady = gaps.length === 0;

  const handlePassRuleChange = (cls: number, raw: string) => {
    const max_failed = Math.max(0, Math.min(15, Number.parseInt(raw, 10) || 0));
    setLocalPassRules((prev) =>
      prev.map((rule) => (rule.class === cls ? { ...rule, max_failed } : rule)),
    );
  };

  const persistPassRules = async (silent = false) => {
    if (!passRulesDirty) return;
    await savePassRules({ year, rules: localPassRules, silent });
  };

  const handleGenerateResult = async () => {
    if (!yearEndReady) {
      toast.error(`Missing year-end exams for class ${gaps.join(', ')}`);
      return;
    }
    try {
      await persistPassRules(true);
    } catch {
      return;
    }
    const ok = await confirm({
      title: 'Generate pass/fail?',
      msg: `Recalculate pass/fail for all students in ${year} from year-end marks.\n\nAllowed failed subjects: ${passRulesSummary}.\n\nManual overrides may be overwritten.`,
      confirmLabel: 'Generate',
    });
    if (!ok) return;
    updateStatus(year);
  };

  const handleOpenPreview = () => {
    if (!yearEndReady) {
      toast.error(`Missing year-end exams for class ${gaps.join(', ')}`);
      return;
    }
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
    if (!yearEndReady) {
      toast.error(`Missing year-end exams for class ${gaps.join(', ')}`);
      return;
    }
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

  const filteredStudents = useMemo(() => {
    return [...students].sort(
      (a, b) =>
        (a.final_merit || 9999) - (b.final_merit || 9999) ||
        a.class - b.class ||
        (a.section || '').localeCompare(b.section || '') ||
        (Number(a.roll) || 0) - (Number(b.roll) || 0),
    );
  }, [students]);

  const downloadSessionMarksheet = async (studentId: number) => {
    try {
      const response = await axios.get(`/api/marks/${studentId}/${year}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob);
    } catch {
      toast.error('Failed to download session marksheet');
    }
  };

  const downloadAllMarksheetPDF = async () => {
    try {
      const response = await axios.get(`/api/marks/all/${year}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob);
    } catch {
      toast.error('Failed to download all marksheets');
    }
  };

  const renderStudentRow = (student: Student, compact?: boolean) => (
    <>
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          meritBadgeClass(student.final_merit),
        )}
      >
        {student.final_merit || '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold uppercase', compact ? 'text-sm' : '')}>
          {student.name || 'N/A'}
        </p>
        {!compact && (
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            Class {student.class} · Roll {student.roll || 'N/A'} · Sec {student.section || 'N/A'}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
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
      <PageHeader
        title="Year-End Promotion"
        description="Pass/fail, promote classes 6–9, then graduate class 10 — all from year-end marks."
      />

      <SectionCard title="Academic year" icon={<Calendar className="h-5 w-5" />}>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="promotion-year">Session year</Label>
          <select
            id="promotion-year"
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className={filterSelectClassName}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={currentYear - i}>
                {currentYear - i}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Promotion creates enrollments for <strong>{year + 1}</strong>.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Readiness"
        icon={<ClipboardCheck className="h-5 w-5 text-sky-600" />}
        description={`Checks for ${year} before you promote`}
      >
        <ul className="space-y-3">
          <ReadinessItem
            ok={yearEndReady}
            label="Year-end exams"
            detail={
              yearEndReady
                ? 'Every active class has a year-end exam.'
                : `Missing for class ${gaps.join(', ')} — create them in Exam Management.`
            }
          />
          <ReadinessItem
            ok={statusSummary.failed + statusSummary.passed > 0}
            label="Pass / fail (classes 6–9)"
            detail={`${statusSummary.passed} passed · ${statusSummary.failed} failed · ${statusSummary.pending} pending`}
          />
          <ReadinessItem
            ok={meritAssigned}
            label="Merit & next-year rolls"
            detail={
              meritAssigned
                ? 'Merit ranks assigned — review the list below.'
                : 'Run Step 2 after pass/fail to assign merit and rolls.'
            }
          />
          <ReadinessItem
            ok={nextYearTotal === 0 || meritAssigned}
            label={`Next year (${year + 1})`}
            detail={
              nextYearTotal === 0
                ? 'No enrollments yet — safe to promote.'
                : `${nextYearTotal} enrollment${nextYearTotal === 1 ? '' : 's'} exist — re-running will replace them.`
            }
          />
          <ReadinessItem
            ok={class10Graduated || class10Summary.total === 0}
            label="Class 10 graduation"
            detail={
              class10Summary.total === 0
                ? 'No active class-10 students for this year.'
                : class10Graduated
                  ? `${class10Summary.graduated} graduated · ${class10Summary.passed} pending · ${class10Summary.failed} failed`
                  : `${class10Summary.total} active · ${class10Summary.passed} passed · ${class10Summary.failed} failed — run Step 3 after pass/fail`
            }
          />
        </ul>
      </SectionCard>

      {gaps.length > 0 ? (
        <Alert className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-50 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Missing year-end exam</AlertTitle>
          <AlertDescription>
            No year-end exam for class {gaps.join(', ')}. Pass/fail and promotion need one covering
            each class.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          title="Step 1 · Pass / Fail"
          icon={<RefreshCw className="h-5 w-5 text-blue-600" />}
          description="Set how many failed subjects still count as pass, then generate from year-end marks."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Allowed failed subjects (per class)</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {localPassRules.map((rule) => (
                  <label
                    key={rule.class}
                    className="border-border flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm"
                  >
                    <span className="text-muted-foreground text-xs font-medium">
                      Class {rule.class}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={rule.max_failed}
                      onChange={(e) => handlePassRuleChange(rule.class, e.target.value)}
                      className="border-input bg-background h-8 w-14 rounded-md border px-2 text-center text-sm tabular-nums"
                      aria-label={`Allowed failed subjects for class ${rule.class}`}
                    />
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                0 = strict (any failed subject fails). A student passes when failed subjects ≤ this
                limit.
              </p>
              {passRulesDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingPassRules}
                  onClick={() => void persistPassRules(false)}
                  className="h-8"
                >
                  {isSavingPassRules ? 'Saving…' : 'Save rules'}
                </Button>
              ) : null}
            </div>
            <Button
              onClick={() => void handleGenerateResult()}
              disabled={isUpdatingStatus || isSavingPassRules || !yearEndReady}
              className="h-11 w-full font-bold"
            >
              {isUpdatingStatus ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generate pass/fail
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Override individual statuses in the review table below if needed.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Step 2 · Merit & promotion"
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          description="Preview merit ranks and next-year rolls for classes 6–9, then confirm."
        >
          <div className="space-y-4">
            <Button
              onClick={handleOpenPreview}
              disabled={promoteBusy || !yearEndReady}
              variant="secondary"
              className="border-border h-11 w-full border font-bold"
            >
              {promoteBusy ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="mr-2 h-4 w-4" />
              )}
              Review & promote
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Opens a preview of merit, sections, and rolls before anything is saved.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Step 3 · Class 10"
          icon={<GraduationCap className="h-5 w-5 text-sky-600" />}
          description="Graduate passed SSC students to alumni; retain failed students in class 10."
        >
          <div className="space-y-4">
            <Button
              onClick={handleOpenGraduationPreview}
              disabled={graduationBusy || !yearEndReady}
              variant="secondary"
              className="border-border h-11 w-full border font-bold"
            >
              {graduationBusy ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="mr-2 h-4 w-4" />
              )}
              Review & graduate
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Sets SSC batch, marks inactive, and appears in Alumni list.
            </p>
          </div>
        </SectionCard>
      </div>

      <FilterSelection>
        <FilterField label="Class" htmlFor="promotion-class">
          <select
            id="promotion-class"
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className={filterSelectClassName}
          >
            <option value="">All classes</option>
            {[6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={String(num)}>
                Class {num}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Section" htmlFor="promotion-section">
          <select
            id="promotion-section"
            value={classSection}
            onChange={(e) => handleSectionChange(e.target.value)}
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

        <FilterField label="Group" htmlFor="promotion-group">
          <select
            id="promotion-group"
            value={group}
            onChange={(e) => handleGroupChange(e.target.value)}
            className={filterSelectClassName}
            disabled={!selectedClass || Number(selectedClass) < 9}
          >
            <option value="">All groups</option>
            {['Science', 'Humanities', 'Commerce'].map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterSelection>

      {totalFiltered > students.length ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Use the pager below — {totalFiltered.toLocaleString()} students match these filters.
          </AlertDescription>
        </Alert>
      ) : null}

      <SectionCard
        noPadding
        title="Review"
        icon={<FileSpreadsheet className="text-primary h-5 w-5" />}
        description={
          studentsError
            ? 'Failed to load students'
            : `${totalFiltered.toLocaleString()} match · page ${page} of ${Math.max(totalPages, 1)}`
        }
        headerAction={
          filteredStudents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadAllMarksheetPDF}
              className="border-primary/20 bg-primary/5 text-primary hover:bg-primary h-8 w-full gap-1.5 px-3 font-medium shadow-none hover:text-white sm:w-auto"
            >
              <Download className="h-3.5 w-3.5" />
              All session PDFs
            </Button>
          )
        }
      >
        <div className={cn('lg:hidden', listLoading && students.length > 0 && 'opacity-50')}>
          {loading && students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loading />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-muted-foreground px-4 py-16 text-center italic">
              {studentsError ? 'Could not load students.' : 'No students match these filters.'}
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {filteredStudents.map((student) => (
                <li key={student.enrollment_id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">{renderStudentRow(student, true)}</div>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground text-xs font-medium">Pass / fail</span>
                    <StatusOverrideSelect
                      student={student}
                      disabled={overridingId === student.enrollment_id}
                      onChange={handleStatusOverride}
                    />
                  </label>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="bg-primary/5 min-w-0 rounded-md px-2 py-1.5">
                      <dt className="text-muted-foreground">Next roll</dt>
                      <dd className="text-primary font-semibold tabular-nums">
                        {student.next_year_roll || '—'}
                      </dd>
                    </div>
                    <div className="bg-primary/5 min-w-0 rounded-md px-2 py-1.5">
                      <dt className="text-muted-foreground">Next sec</dt>
                      <dd className="text-primary font-semibold">
                        {student.next_year_section || '—'}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full"
                    onClick={() => downloadSessionMarksheet(student.id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Session PDF
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={cn(
            'hidden min-h-[300px] max-w-full overflow-x-auto overscroll-x-contain lg:block',
            listLoading && students.length > 0 && 'opacity-50',
          )}
        >
          <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/50 border-border">
                <th className="bg-muted/50 sticky left-0 z-30 w-14 min-w-14 border-r border-b px-3 py-4 text-center font-bold">
                  Merit
                </th>
                <th className="bg-muted/50 sticky left-14 z-30 min-w-44 border-r border-b px-3 py-4 font-bold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]">
                  Student
                </th>
                <th className="w-32 border-b px-4 py-4 text-center font-bold">Status</th>
                <th className="w-20 border-b px-4 py-4 text-center font-bold">Fails</th>
                <th className="w-16 border-b px-4 py-4 text-center font-bold">Roll</th>
                <th className="w-16 border-b px-4 py-4 text-center font-bold">Sec</th>
                <th className="bg-primary/5 w-24 border-b px-4 py-4 text-center font-bold">
                  Next roll
                </th>
                <th className="bg-primary/5 w-24 border-b px-4 py-4 text-center font-bold">
                  Next sec
                </th>
                <th className="w-28 border-b px-4 py-4 text-center font-bold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-muted-foreground py-20 text-center italic">
                    {studentsError
                      ? 'Could not load students.'
                      : 'No students match these filters.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.enrollment_id} className="hover:bg-muted/30 border-border/50">
                    <td className="bg-card sticky left-0 z-10 border-r px-3 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                          meritBadgeClass(student.final_merit),
                        )}
                      >
                        {student.final_merit || '—'}
                      </span>
                    </td>
                    <td className="bg-card sticky left-14 z-10 min-w-44 border-r px-3 py-3 font-medium shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]">
                      <span className="block truncate uppercase">{student.name || 'N/A'}</span>
                      <span className="text-muted-foreground text-xs">Class {student.class}</span>
                    </td>
                    <td className="border-r px-2 py-3 text-center">
                      <StatusOverrideSelect
                        student={student}
                        disabled={overridingId === student.enrollment_id}
                        onChange={handleStatusOverride}
                      />
                    </td>
                    <td className="text-muted-foreground border-r px-4 py-3 text-center text-xs tabular-nums">
                      {student.fail_count != null
                        ? `${student.fail_count}/${passRulesByClass[student.class] ?? 0}`
                        : '—'}
                    </td>
                    <td className="border-r px-4 py-3 text-center tabular-nums">{student.roll}</td>
                    <td className="border-r px-4 py-3 text-center">{student.section}</td>
                    <td className="text-primary bg-primary/5 border-r px-4 py-3 text-center font-semibold tabular-nums">
                      {student.next_year_roll || '—'}
                    </td>
                    <td className="text-primary bg-primary/5 border-r px-4 py-3 text-center font-semibold">
                      {student.next_year_section || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 px-2"
                        onClick={() => downloadSessionMarksheet(student.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 0 ? (
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
              sessionStorage.setItem(PAGE_SIZE_KEY, String(next));
            }}
          />
        ) : null}
      </SectionCard>
    </div>
  );
};

export default GenerateResult;
