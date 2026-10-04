import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/useAuth';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { SectionCard, Popup, ActionButton, filterSelectClassName } from '@/components';
import { ColumnHeaderMenu } from '@/components/ColumnHeaderMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Download, FileText, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExams } from '@/queries/exam.queries';
import {
  useClassMarks,
  useMarksheetGenerationStatus,
  isMarksheetGenComplete,
  hasStaleBundles,
  type StudentMarkResponse,
} from '@/queries/marks.queries';
import { MarksheetGenProgress } from '@/components/MarksheetGenProgress';
import { BundleStalePreview } from '@/components/BundleStalePreview';
import { downloadBlob, openBlobInNewTab } from '@school/common-ui/blob';

interface TeacherLevel {
  id: number;
  class_name: number;
  section: string;
  year: number;
}

interface UserWithLevels {
  role: string;
  levels?: TeacherLevel[];
}

interface ViewMarksFilters {
  year: string;
  exam: string;
  className: string;
  section: string;
  group: string;
}

const VIEW_MARKS_STORAGE_KEY = 'viewMarks.filters';

const loadViewMarksFilters = (): ViewMarksFilters | null => {
  try {
    const raw = localStorage.getItem(VIEW_MARKS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ViewMarksFilters>;
    return {
      year: parsed.year ?? String(new Date().getFullYear()),
      exam: parsed.exam ?? '',
      className: parsed.className ?? '',
      section: parsed.section ?? '',
      group: parsed.group ?? '',
    };
  } catch {
    return null;
  }
};

const saveViewMarksFilters = (filters: ViewMarksFilters) => {
  try {
    localStorage.setItem(VIEW_MARKS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* storage unavailable: just don't remember */
  }
};

// Pinned Roll + Student columns; opaque backgrounds hide the subject columns scrolling under them.
const stickyRoll = 'sticky left-0 z-[1] w-16 min-w-16 bg-inherit';
const stickyName =
  'sticky left-16 z-[1] min-w-[10rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[14rem]';
const theadRow =
  'border-border [&>th]:bg-muted text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]';

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

let cachedInitialFilters: ViewMarksFilters | undefined;

const getInitialViewMarksFilters = (): ViewMarksFilters => {
  if (!cachedInitialFilters) {
    cachedInitialFilters = loadViewMarksFilters() ?? {
      year: new Date().getFullYear().toString(),
      exam: '',
      className: '',
      section: '',
      group: '',
    };
  }
  return cachedInitialFilters;
};

const ViewMarks = () => {
  const { user } = useAuth();
  const [className, setClassName] = useState(() => getInitialViewMarksFilters().className);
  const [year, setYear] = useState(() => getInitialViewMarksFilters().year);
  const [exam, setExam] = useState(() => getInitialViewMarksFilters().exam);
  const [section, setSection] = useState(() => getInitialViewMarksFilters().section);
  const [group, setGroup] = useState(() => getInitialViewMarksFilters().group);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentMarkResponse | null>(null);

  // Queries
  const { data: exams = [], isLoading: examsLoading } = useExams();
  const { data: marksData = [], isLoading: marksLoading } = useClassMarks(
    className,
    Number(year),
    exam,
  );

  // Derived data from exams
  const { examList, classList } = useMemo(() => {
    const currentYearExams = exams.filter((e) => e.exam_year === Number(year));
    return {
      examList: Array.from(new Set(currentYearExams.map((e) => e.exam_name))),
      classList: currentYearExams.reduce((acc: Record<string, number[]>, e) => {
        acc[e.exam_name] = e.levels || [];
        return acc;
      }, {}),
    };
  }, [exams, year]);

  const selectedExamId = useMemo(() => {
    if (!exam || !year) return undefined;
    return exams.find((e) => e.exam_name === exam && e.exam_year === Number(year))?.id;
  }, [exams, exam, year]);

  const { data: genStatus } = useMarksheetGenerationStatus(selectedExamId);
  const downloadProgressToastRef = useRef<string | null>(null);

  useEffect(() => {
    const toastId = downloadProgressToastRef.current;
    if (!toastId || !genStatus || genStatus.total === 0) return;
    if (!isMarksheetGenComplete(genStatus)) {
      const studentBusy = genStatus.pending + genStatus.generating > 0;
      const bundleBusy = genStatus.bundles.pending + genStatus.bundles.generating > 0;
      const label =
        bundleBusy && !studentBusy
          ? `Generating class bundles… ${genStatus.bundles.done}/${genStatus.bundles.total}`
          : `Generating marksheets… ${genStatus.done}/${genStatus.total}`;
      toast.loading(label, { id: toastId });
    }
  }, [genStatus]);

  // Derived filter options from marks data
  const { subjects, availableSections, availableGroups } = useMemo(() => {
    const subjectPriority = new Map<string, number>();
    const sections = new Set<string>();
    const groups = new Set<string>();

    marksData.forEach((student) => {
      student.marks?.forEach((mark) => {
        const prev = subjectPriority.get(mark.subject);
        const p = mark.priority ?? 999;
        if (prev === undefined || p < prev) {
          subjectPriority.set(mark.subject, p);
        }
      });
      if (student.section) sections.add(student.section);
      if (student.group) groups.add(student.group);
    });

    return {
      subjects: [...subjectPriority.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name),
      availableSections: Array.from(sections).sort(),
      availableGroups: Array.from(groups).sort(),
    };
  }, [marksData]);

  useEffect(() => {
    saveViewMarksFilters({ year, exam, className, section, group });
  }, [year, exam, className, section, group]);

  // Handle teacher assignments
  useEffect(() => {
    if (
      user?.role === 'teacher' &&
      (user as UserWithLevels).levels &&
      ((user as UserWithLevels).levels?.length ?? 0) > 0
    ) {
      const assignmentsInYear = (user as UserWithLevels).levels?.filter(
        (l: TeacherLevel) => l.year === Number(year),
      );
      if (assignmentsInYear && assignmentsInYear.length === 1 && !className) {
        const assignment = assignmentsInYear[0];
        setClassName(assignment.class_name.toString());
        setSection(assignment.section);
      }
    }
  }, [user, year, className]);

  const handleExamChange = (selectedExam: string) => {
    setExam(selectedExam);
    setClassName('');
    setSection('');
    setGroup('');
  };

  const handleClassChange = (selectedClass: string) => {
    setClassName(selectedClass);
    setSection('');
    setGroup('');
  };

  const downloadMarksheet = async (id: number) => {
    const loadingToast = toast.loading('Generating transcript...');
    downloadProgressToastRef.current = loadingToast;

    // Create new window immediately to bypass popup blockers
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(
        'Loading marksheet... If this takes too long, please check for errors.',
      );
    }

    try {
      const response = await axios.get(`/api/marks/${id}/${year}/${exam}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      openBlobInNewTab(blob, newWindow ?? undefined);
    } catch {
      if (newWindow) newWindow.close();
      toast.error('Failed to download marksheet');
    } finally {
      downloadProgressToastRef.current = null;
      toast.dismiss(loadingToast);
    }
  };

  const downloadAllExamPDFs = async () => {
    if (!className || !year || !exam) {
      toast.error('Please select Class, Year and Exam');
      return;
    }
    const loadingToast = toast.loading('Generating transcript...');
    downloadProgressToastRef.current = loadingToast;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(
        'Loading marksheet... If this takes too long, please check for errors.',
      );
    }

    try {
      const response = await axios.get(
        `/api/marks/class-exam/${className}/${year}/${exam}/download`,
        {
          responseType: 'blob',
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          params: section ? { section } : undefined,
        },
      );
      const blob = response.data as Blob;
      if (blob.type.includes('json')) {
        const { data } = JSON.parse(await blob.text()) as {
          data?: { url?: string };
        };
        const url = data?.url;
        if (!url) throw new Error('Missing download URL');
        if (newWindow) newWindow.location.href = url;
        else window.open(url, '_blank');
      } else {
        openBlobInNewTab(new Blob([blob], { type: 'application/pdf' }), newWindow ?? undefined);
      }
    } catch {
      if (newWindow) newWindow.close();
      toast.error('Failed to download marksheet');
    } finally {
      downloadProgressToastRef.current = null;
      toast.dismiss(loadingToast);
    }
  };

  const downloadSummaryPDF = async () => {
    if (!className || !year || !exam) {
      toast.error('Please select Class, Year and Exam');
      return;
    }
    const loadingToast = toast.loading('Generating summary PDF...');
    try {
      const response = await axios.get(
        `/api/marks/class-exam/${className}/${year}/${exam}/summary.pdf`,
        {
          responseType: 'blob',
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          params: section ? { section } : undefined,
        },
      );
      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${className}${section || 'All'}_Summary_${exam}_${year}.pdf`;
      downloadBlob(new Blob([response.data], { type: 'application/pdf' }), filename);
    } catch {
      toast.error('Failed to download summary PDF');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const isTeacher = user?.role === 'teacher' && Boolean((user as UserWithLevels).levels);
  const teacherLevels = (user as UserWithLevels | null)?.levels ?? [];

  const classOptions = (classList[exam] || []).filter((cls) => {
    if (user?.role === 'admin') return true;
    if (isTeacher) {
      return teacherLevels.some((l) => l.class_name === Number(cls) && l.year === Number(year));
    }
    return false;
  });
  const sectionOptions = availableSections.filter((sec) => {
    if (user?.role === 'admin') return true;
    if (isTeacher) {
      return teacherLevels.some(
        (l) => l.class_name === Number(className) && l.section === sec && l.year === Number(year),
      );
    }
    return false;
  });

  // Students in the picked section/group; only those with at least one entered mark are listed.
  const scoped = marksData.filter(
    (student) =>
      (!section || (student.section || '') === section) &&
      (!group || (student.group || '') === group),
  );
  const withMarks = scoped
    .filter((student) => student.marks?.some((m) => m.marks !== null && m.marks !== undefined))
    .sort((a, b) => {
      const secCmp = (a.section || '').localeCompare(b.section || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (secCmp !== 0) return secCmp;
      const rollA = Number(a.roll) || 0;
      const rollB = Number(b.roll) || 0;
      if (rollA !== rollB) return rollA - rollB;
      return (a.name || '').localeCompare(b.name || '');
    });
  const query = searchQuery.trim().toLowerCase();
  const filteredData = query
    ? withMarks.filter(
        (s) => (s.name || '').toLowerCase().includes(query) || String(s.roll).includes(query),
      )
    : withMarks;
  const noMarksCount = scoped.length - withMarks.length;

  const showSection = !section;
  const colSpan = subjects.length + 3;
  const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');
  const ready = Boolean(className && exam);

  const summary = !ready
    ? 'Pick an exam and class to see results.'
    : marksLoading
      ? 'Loading results…'
      : [
          `${exam} ${year} · Class ${className}${section ? ` ${section}` : ''}${group ? ` · ${group}` : ''}`,
          `${withMarks.length.toLocaleString()} students with marks`,
          noMarksCount > 0 ? `${noMarksCount.toLocaleString()} with none entered` : null,
          `${subjects.length} subjects`,
        ]
          .filter(Boolean)
          .join(' · ');

  const emptyMessage = !ready
    ? 'Pick an exam and class to see results.'
    : examsLoading
      ? 'Refreshing exams…'
      : query
        ? `No students match "${searchQuery}".`
        : 'No marks found for these filters.';

  const detailMarks = (selectedStudent?.marks ?? [])
    .slice()
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  const detailBreakdown = detailMarks.some(
    (mark) => mark.subject_info?.marking_scheme === 'BREAKDOWN',
  );
  const part = (mark: (typeof detailMarks)[number], value: number | null) =>
    mark.subject_info?.marking_scheme === 'BREAKDOWN' ? (value ?? '—') : '—';

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Class results</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Year"
              className={cn(pickerClass, 'tabular-nums')}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Exam"
              className={pickerClass}
              value={exam}
              onChange={(e) => handleExamChange(e.target.value)}
            >
              <option value="">Select exam</option>
              {examList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Class"
              className={pickerClass}
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!exam}
            >
              <option value="">Select class</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  Class {cls}
                </option>
              ))}
            </select>
            <select
              aria-label="Section"
              className={pickerClass}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={!className || availableSections.length === 0}
            >
              <option value="">All sections</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
            <select
              aria-label="Group"
              className={pickerClass}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={!className || availableGroups.length === 0}
            >
              <option value="">All groups</option>
              {availableGroups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        </div>
        {ready && withMarks.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={downloadSummaryPDF}>
              <FileText />
              {section ? `Section ${section} summary` : 'Summary PDF'}
            </Button>
            <Button type="button" onClick={downloadAllExamPDFs}>
              <Download />
              {section ? `Section ${section} marksheets` : 'All marksheets'}
            </Button>
          </div>
        )}
      </header>

      {exam && genStatus && !isMarksheetGenComplete(genStatus) && (
        <div className="mb-6">
          <MarksheetGenProgress status={genStatus} />
        </div>
      )}
      {ready && genStatus && hasStaleBundles(genStatus) && isMarksheetGenComplete(genStatus) && (
        <BundleStalePreview
          items={genStatus.bundles.staleItems}
          classNum={className}
          sectionFilter={section || undefined}
          variant="block"
          className="mb-6"
        />
      )}

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll the subject columns sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={theadRow}>
                <th className={cn(stickyRoll, 'px-3 py-2.5')}>Roll</th>
                <th className={cn(stickyName, 'px-3 py-2')}>
                  <ColumnHeaderMenu
                    label="Student"
                    filterInput={{
                      value: searchQuery,
                      onChange: setSearchQuery,
                      placeholder: 'Name or roll…',
                    }}
                  />
                </th>
                {subjects.map((subject) => (
                  <th
                    key={subject}
                    className="min-w-24 whitespace-nowrap px-3 py-2.5 text-center normal-case tracking-normal"
                  >
                    {subject}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {marksLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={colSpan} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="text-muted-foreground px-4 py-12 text-center text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredData.map((data) => {
                  const marksMap: Record<string, number | null> = {};
                  data.marks?.forEach((subject) => {
                    marksMap[subject.subject] = subject.marks;
                  });
                  return (
                    <tr
                      key={data.student_id}
                      className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                    >
                      <td className={cn(stickyRoll, 'px-3 py-2 text-sm tabular-nums')}>
                        {showSection ? `${data.section || '—'}-${data.roll}` : data.roll}
                      </td>
                      <td className={cn(stickyName, 'px-3 py-2')}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(data)}
                          className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                        >
                          {data.name}
                        </button>
                      </td>
                      {subjects.map((subject) => (
                        <td key={subject} className="px-3 py-2 text-center text-sm tabular-nums">
                          {marksMap[subject] ?? (
                            <span className="text-muted-foreground" aria-label="Not entered">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <ActionButton
                            iconOnly
                            label="Details"
                            variant="emerald"
                            icon={<Info size={16} className="text-green-600" />}
                            onClick={() => setSelectedStudent(data)}
                          />
                          <ActionButton
                            iconOnly
                            label="Exam PDF"
                            icon={<Download size={16} className="text-primary" />}
                            onClick={() => downloadMarksheet(data.student_id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {selectedStudent && (
        <Popup
          open
          onOpenChange={(o) => !o && setSelectedStudent(null)}
          size="2xl"
          aria-labelledby="marks-details-title"
        >
          <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 id="marks-details-title" className="truncate text-base font-semibold">
                {selectedStudent.name}
              </h2>
              <p className="text-muted-foreground text-sm tabular-nums">
                Class {selectedStudent.class}
                {selectedStudent.section ? ` · Section ${selectedStudent.section}` : ''} · Roll{' '}
                {selectedStudent.roll}
                {selectedStudent.group ? ` · ${selectedStudent.group}` : ''} · {exam} {year}
              </p>
            </div>
            <CloseButton onClick={() => setSelectedStudent(null)} />
          </div>

          <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className="px-3 py-2.5">Subject</th>
                    {detailBreakdown && (
                      <>
                        <th className="px-3 py-2.5 text-center">CQ</th>
                        <th className="px-3 py-2.5 text-center">MCQ</th>
                        <th className="px-3 py-2.5 text-center">Prac</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {detailMarks.length > 0 ? (
                    detailMarks.map((mark) => (
                      <tr key={mark.subject_id}>
                        <td className="px-3 py-2 font-medium">{mark.subject}</td>
                        {detailBreakdown && (
                          <>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {part(mark, mark.cq_marks)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {part(mark, mark.mcq_marks)}
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {part(mark, mark.practical_marks)}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-center font-semibold tabular-nums">
                          {mark.marks ?? <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={detailBreakdown ? 5 : 2}
                        className="text-muted-foreground px-3 py-8 text-center"
                      >
                        No marks recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">— = not entered</p>
          </div>

          <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setSelectedStudent(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                downloadMarksheet(selectedStudent.student_id);
                setSelectedStudent(null);
              }}
            >
              <Download /> Download exam PDF
            </Button>
          </div>
        </Popup>
      )}
    </div>
  );
};

export default ViewMarks;
