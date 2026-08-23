import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/useAuth';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Loading from '@/components/Loading';
import { PageHeader, SectionCard } from '@/components';
import {
  Search,
  Download,
  Info,
  Calendar,
  GraduationCap,
  Users,
  Layers,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  localStorage.setItem(VIEW_MARKS_STORAGE_KEY, JSON.stringify(filters));
};

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
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
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

  const downloadMarksheet = async (id: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
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

  const showStudentDetails = (student: StudentMarkResponse) => {
    setSelectedStudent(student);
    setShowDetailsPopup(true);
  };

  const closeDetailsPopup = () => {
    setShowDetailsPopup(false);
    setSelectedStudent(null);
  };

  const filteredData = marksData
    .filter((student) => {
      if (!student.marks || student.marks.length === 0) return false;
      const hasAnyMarks = student.marks.some((m) => m.marks !== null && m.marks !== undefined);
      if (!hasAnyMarks) return false;
      const sectionMatch = !section || (student.section || '') === section;
      const groupMatch = !group || (student.group || '') === group;
      return sectionMatch && groupMatch;
    })
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Class Results"
        description={
          className
            ? `Viewing marks for Class ${className}, ${exam} (${year})`
            : 'Analyze and manage student academic performance.'
        }
      />

      <SectionCard title="Filter Results" icon={<Search className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Calendar className="h-3 w-3" /> Year
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() - i}>
                  {new Date().getFullYear() - i}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <FileSpreadsheet className="h-3 w-3" /> Exam
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none dark:bg-zinc-900"
              value={exam}
              onChange={(e) => handleExamChange(e.target.value)}
            >
              <option value="">Select Exam</option>
              {examList.map((exam, index) => (
                <option key={index} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <GraduationCap className="h-3 w-3" /> Class
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none disabled:opacity-50 dark:bg-zinc-900"
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!exam}
            >
              <option value="">Select Class</option>
              {(classList[exam] || [])
                .filter((cls) => {
                  if (user?.role === 'admin') return true;
                  if (user?.role === 'teacher' && (user as UserWithLevels).levels) {
                    return (user as UserWithLevels).levels?.some(
                      (l: TeacherLevel) => l.class_name === Number(cls) && l.year === Number(year),
                    );
                  }
                  return false;
                })
                .map((cls, index) => (
                  <option key={index} value={cls}>
                    {`Class ${cls}`}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Users className="h-3 w-3" /> Section
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none disabled:opacity-50 dark:bg-zinc-900"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={!className || availableSections.length === 0}
            >
              <option value="">All Sections</option>
              {availableSections
                .filter((sec) => {
                  if (user?.role === 'admin') return true;
                  if (user?.role === 'teacher' && (user as UserWithLevels).levels) {
                    return (user as UserWithLevels).levels?.some(
                      (l: TeacherLevel) =>
                        l.class_name === Number(className) &&
                        l.section === sec &&
                        l.year === Number(year),
                    );
                  }
                  return false;
                })
                .map((sec, index) => (
                  <option key={index} value={sec}>
                    {sec}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Layers className="h-3 w-3" /> Group
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-primary flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none disabled:opacity-50 dark:bg-zinc-900"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={!className || availableGroups.length === 0}
            >
              <option value="">All Groups</option>
              {availableGroups.map((grp, index) => (
                <option key={index} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {exam && genStatus && !isMarksheetGenComplete(genStatus) && (
        <MarksheetGenProgress status={genStatus} />
      )}

      <SectionCard
        noPadding
        title="Student Marks"
        icon={<FileSpreadsheet className="text-primary h-5 w-5" />}
        description={`Showing ${filteredData.length} records`}
        headerAction={
          className &&
          exam &&
          filteredData.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              {genStatus && hasStaleBundles(genStatus) && isMarksheetGenComplete(genStatus) && (
                <BundleStalePreview
                  items={genStatus.bundles.staleItems}
                  classNum={className}
                  sectionFilter={section || undefined}
                  variant="block"
                  className="w-full text-left"
                />
              )}
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  size="sm"
                  onClick={downloadAllExamPDFs}
                  className="bg-primary hover:bg-primary/90 h-9 w-full shrink-0 gap-2 px-4 text-white transition-[color,background-color,border-color,box-shadow,opacity,transform] sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {section ? `Download Section ${section} PDFs` : 'Download All Exam PDFs'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadSummaryPDF}
                  className="h-9 w-full shrink-0 gap-2 px-4 sm:w-auto"
                >
                  <FileText className="h-4 w-4" />
                  {section ? `Download Section ${section} Summary` : 'Download Summary PDF'}
                </Button>
              </div>
            </div>
          )
        }
      >
        {/* Mobile cards */}
        <div className="lg:hidden">
          {marksLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loading />
              <p className="text-muted-foreground animate-pulse text-sm font-medium">
                Loading results…
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-16 text-center opacity-50">
              <Search className="mb-2 h-10 w-10" />
              <p className="text-base font-medium">
                {className && exam
                  ? examsLoading
                    ? 'Refreshing exams…'
                    : 'No marks found matching these filters.'
                  : 'Please select Class and Exam to view results.'}
              </p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {filteredData.map((data) => {
                const marksMap: { [key: string]: number | null } = {};
                data.marks?.forEach((subject) => {
                  marksMap[subject.subject] = subject.marks;
                });
                return (
                  <li key={data.student_id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate font-semibold uppercase">
                          {data.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                          Sec {data.section || '—'} · Roll {data.roll}
                        </p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
                      {subjects.map((subject) => (
                        <div
                          key={`${data.student_id}-m-${subject}`}
                          className="bg-muted/40 min-w-0 rounded-md px-2 py-1.5"
                        >
                          <dt className="text-muted-foreground truncate">{subject}</dt>
                          <dd className="font-semibold tabular-nums">{marksMap[subject] ?? '—'}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1 gap-1.5 border-green-500/20 bg-green-500/10 px-3 text-green-600 shadow-none sm:flex-none"
                        onClick={() => showStudentDetails(data)}
                      >
                        <Info className="h-3.5 w-3.5" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-primary/10 text-primary hover:bg-primary border-primary/20 h-8 flex-1 gap-1.5 px-3 shadow-none hover:text-white sm:flex-none"
                        onClick={(e) => downloadMarksheet(data.student_id, e)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Exam PDF
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Desktop table — no multi-col sticky (breaks on narrow viewports) */}
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] lg:block">
          <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-border">
                <th className="bg-muted sticky left-0 z-30 w-16 min-w-16 border-r border-b px-3 py-3 text-center text-xs font-bold tracking-wider text-gray-900 uppercase dark:text-gray-100">
                  Sec
                </th>
                <th className="bg-muted sticky left-16 z-30 w-16 min-w-16 border-r border-b px-3 py-3 text-center text-xs font-bold tracking-wider text-gray-900 uppercase dark:text-gray-100">
                  Roll
                </th>
                <th className="bg-muted sticky left-32 z-30 min-w-48 border-r border-b px-4 py-3 text-xs font-bold tracking-wider text-gray-900 uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] dark:text-gray-100">
                  Student Name
                </th>
                {subjects.map((subject) => (
                  <th
                    key={subject}
                    className="bg-muted min-w-28 border-b px-4 py-3 text-center text-xs font-semibold tracking-wider whitespace-nowrap text-gray-900 uppercase dark:text-gray-100"
                  >
                    {subject}
                  </th>
                ))}
                <th className="bg-muted min-w-44 border-b px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-900 uppercase dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {marksLoading ? (
                <tr>
                  <td colSpan={subjects.length + 4} className="py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loading />
                      <p className="text-muted-foreground animate-pulse font-medium">
                        Loading results…
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={subjects.length + 4}
                    className="text-muted-foreground py-20 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <Search className="mb-2 h-10 w-10" />
                      <p className="text-lg font-medium">
                        {className && exam
                          ? examsLoading
                            ? 'Refreshing exams…'
                            : 'No marks found matching these filters.'
                          : 'Please select Class and Exam to view results.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((data) => {
                  const marksMap: { [key: string]: number | null } = {};
                  data.marks?.forEach((subject) => {
                    marksMap[subject.subject] = subject.marks;
                  });

                  return (
                    <tr
                      key={data.student_id}
                      className="hover:bg-muted/30 group border-border border-b transition-colors"
                    >
                      <td className="bg-card sticky left-0 z-10 w-16 min-w-16 border-r px-3 py-3 text-center font-medium uppercase">
                        {data.section || '—'}
                      </td>
                      <td className="bg-card sticky left-16 z-10 w-16 min-w-16 border-r px-3 py-3 text-center font-medium tabular-nums">
                        {data.roll}
                      </td>
                      <td className="group-hover:text-primary bg-card sticky left-32 z-10 min-w-48 border-r px-4 py-3 font-bold text-gray-800 uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] transition-colors dark:text-gray-200">
                        {data.name}
                      </td>
                      {subjects.map((subject) => (
                        <td
                          key={`${data.student_id}-${subject}`}
                          className="min-w-28 px-4 py-3 text-center font-medium tabular-nums"
                        >
                          {marksMap[subject] ?? '—'}
                        </td>
                      ))}
                      <td className="min-w-44 px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-green-500/20 bg-green-500/10 px-3 text-green-600 shadow-none transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-green-500 hover:text-white"
                            onClick={() => showStudentDetails(data)}
                          >
                            <Info className="h-3.5 w-3.5" />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-primary/10 text-primary hover:bg-primary border-primary/20 h-8 gap-1.5 px-3 shadow-none transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:text-white"
                            onClick={(e) => downloadMarksheet(data.student_id, e)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Exam PDF
                          </Button>
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

      <AnimatePresence>
        {showDetailsPopup && selectedStudent && (
          <div className="bg-background/80 fixed inset-0 z-100 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-border flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
            >
              <div className="bg-muted/20 flex items-center justify-between border-b p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <GraduationCap className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Detailed Marks</h3>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                      {selectedStudent.name} | Roll: {selectedStudent.roll}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDetailsPopup}
                  className="hover:bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-8 overflow-y-auto p-6">
                <div>
                  <h4 className="text-primary mb-4 flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                    <Info className="h-4 w-4" /> Student Snapshot
                  </h4>
                  <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                    {[
                      { label: 'Class', value: selectedStudent.class, icon: GraduationCap },
                      { label: 'Roll', value: selectedStudent.roll, icon: Users },
                      { label: 'Section', value: selectedStudent.section || 'N/A', icon: Layers },
                      { label: 'Group', value: selectedStudent.group || 'N/A', icon: Info },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="bg-muted/30 border-border/50 flex items-center gap-3 rounded-xl border p-3"
                      >
                        <item.icon className="text-muted-foreground h-4 w-4" />
                        <div>
                          <p className="text-muted-foreground/70 text-[10px] font-bold uppercase">
                            {item.label}
                          </p>
                          <p className="text-sm font-bold tracking-tight">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-primary mb-4 flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                    <FileSpreadsheet className="h-4 w-4" /> Performance Metrics
                  </h4>
                  <div className="border-border overflow-hidden rounded-xl border shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          {(() => {
                            const showBreakdown = selectedStudent.marks?.some(
                              (mark) => mark.subject_info?.marking_scheme === 'BREAKDOWN',
                            );
                            return (
                              <tr className="bg-muted/50 border-border border-b">
                                <th className="px-4 py-3 font-bold text-gray-900 italic dark:text-gray-100">
                                  Subject
                                </th>
                                {showBreakdown && (
                                  <>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                                      CQ
                                    </th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                                      MCQ
                                    </th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                                      PRC
                                    </th>
                                  </>
                                )}
                                <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                                  Total
                                </th>
                                {/* <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Status</th> */}
                              </tr>
                            );
                          })()}
                        </thead>
                        <tbody className="divide-border divide-y">
                          {Array.isArray(selectedStudent.marks) &&
                          selectedStudent.marks.length > 0 ? (
                            (() => {
                              const showBreakdownTable = selectedStudent.marks?.some(
                                (mark) => mark.subject_info?.marking_scheme === 'BREAKDOWN',
                              );
                              return selectedStudent.marks
                                .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
                                .map((mark, index) => {
                                  // const percentage = mark.subject_info?.full_mark && mark.marks !== null
                                  //   ? (mark.marks / mark.subject_info.full_mark) * 100
                                  //   : 0;

                                  return (
                                    <tr key={index} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-3 text-xs font-bold tracking-tight uppercase">
                                        {mark.subject}
                                      </td>
                                      {showBreakdownTable && (
                                        <>
                                          <td className="px-4 py-3 text-center font-medium tabular-nums">
                                            {mark.subject_info?.marking_scheme === 'BREAKDOWN'
                                              ? (mark.cq_marks ?? '-')
                                              : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-medium tabular-nums">
                                            {mark.subject_info?.marking_scheme === 'BREAKDOWN'
                                              ? (mark.mcq_marks ?? '-')
                                              : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-center font-medium tabular-nums">
                                            {mark.subject_info?.marking_scheme === 'BREAKDOWN'
                                              ? (mark.practical_marks ?? '-')
                                              : '-'}
                                          </td>
                                        </>
                                      )}
                                      <td className="text-primary px-4 py-3 text-center font-bold tabular-nums">
                                        {mark.marks ?? '-'}
                                      </td>
                                      {/* <td className="px-4 py-3 text-center">
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          percentage >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                          percentage >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                          percentage >= 40 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        }`}
                                      >
                                        {percentage >= 33 ? "Passed" : "Failed"}
                                      </span>
                                    </td> */}
                                    </tr>
                                  );
                                });
                            })()
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="text-muted-foreground px-4 py-8 text-center italic opacity-50"
                              >
                                No records available
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/10 flex justify-end gap-3 border-t p-6">
                <Button variant="outline" onClick={closeDetailsPopup}>
                  Close
                </Button>
                <Button
                  onClick={(e) => {
                    downloadMarksheet(selectedStudent.student_id, e);
                    closeDetailsPopup();
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download Official Transcript
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ViewMarks;
