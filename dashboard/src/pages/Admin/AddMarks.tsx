import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/useAuth';
import { toast } from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import { SectionCard, filterSelectClassName } from '@/components';
import { ColumnHeaderMenu } from '@/components/ColumnHeaderMenu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import useNavigationStore from '@/store/navigation.Store';
import { readStoredClass, storeClass } from '@/lib/attendanceClass';
import { cn } from '@/lib/utils';
import { useSubjects } from '@/queries/subject.queries';
import { useExams } from '@/queries/exam.queries';
import {
  useMarksStudents,
  useClassMarks,
  useAddMarksMutation,
  type Student,
  type MarksData,
  type SubjectMark,
} from '@/queries/marks.queries';

type MarkField = 'cq_marks' | 'mcq_marks' | 'practical_marks' | 'marks';

// Pinned Roll + Student columns; opaque backgrounds hide the mark columns scrolling under them.
const stickyRoll = 'sticky left-0 z-[1] w-16 min-w-16 bg-inherit';
const stickyName =
  'sticky left-16 z-[1] min-w-[10rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[14rem]';
const groups = ['Science', 'Humanities', 'Commerce'];
const currentYear = new Date().getFullYear();

const isSet = (v: number | null | undefined) => v !== null && v !== undefined;

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

/** Digits-only cell input. Enter / ↓ / ↑ move down and up the same column. */
const MarkInput = ({
  value,
  max,
  disabled,
  label,
  col,
  onChange,
}: {
  value: number | null | undefined;
  max: number;
  disabled?: boolean;
  label: string;
  col: MarkField;
  onChange: (value: string) => void;
}) => (
  <input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    autoComplete="off"
    aria-label={label}
    data-col={col}
    value={isSet(value) ? String(value) : ''}
    disabled={disabled}
    placeholder={disabled ? '—' : `/${max}`}
    onFocus={(e) => e.target.select()}
    onChange={(e) => {
      const raw = e.target.value;
      if (raw === '') return onChange('');
      const digits = raw.replace(/\D/g, '');
      if (digits !== '') onChange(digits);
    }}
    onKeyDown={(e) => {
      const step = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      // Next enabled input in the same column (skips group-mismatch / disabled cells).
      const column = Array.from(
        e.currentTarget
          .closest('table')
          ?.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]:not(:disabled)`) ?? [],
      );
      column[column.indexOf(e.currentTarget) + step]?.focus();
    }}
    className="border-border bg-card focus-visible:ring-ring pointer-coarse:h-10 disabled:text-muted-foreground h-8 w-16 rounded-md border px-2 text-center text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-transparent"
  />
);

const AddMarks = () => {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const { setDirty, resetDirty } = useNavigationStore();

  const [year, setYear] = useState(currentYear);
  const [examName, setExamName] = useState('');
  const [level, setLevel] = useState('');
  const [group, setGroup] = useState('');
  const [section, setSection] = useState('');
  const [specific, setSpecific] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const EMPTY_ARRAY = useRef<never[]>([]).current;

  const { data: subjects = EMPTY_ARRAY, isLoading: isLoadingSubjects } = useSubjects();
  const { data: exams = EMPTY_ARRAY, isLoading: isLoadingExams } = useExams();
  const addMarksMutation = useAddMarksMutation();

  const [marksData, setMarksData] = useState<MarksData>({});
  const [dirtyStudentIds, setDirtyStudentIds] = useState<Set<number>>(new Set());

  const { data: students = EMPTY_ARRAY, isLoading: isLoadingStudents } = useMarksStudents(
    year,
    level,
  );
  const {
    data: existingMarks = EMPTY_ARRAY,
    isLoading: isLoadingMarks,
    refetch: refetchMarks,
  } = useClassMarks(level, year, examName);

  const isTeacher = user?.role === 'teacher';
  const teacherLevels =
    (
      user as {
        levels?: { class_name: number; section: string; year: number }[];
      } | null
    )?.levels ?? [];

  const subjectsForClass = useMemo(() => {
    return subjects
      .filter((s) => s.class.toString() === level)
      .filter((s) => s.subject_type !== 'main')
      .filter((s) => {
        if (!group) return true;
        return !s.group || s.group === '' || s.group === group;
      });
  }, [subjects, level, group]);

  const selectedSubject = useMemo(() => {
    return subjectsForClass.find((s) => s.id === Number(specific));
  }, [subjectsForClass, specific]);

  const examList = useMemo(
    () => exams.filter((e) => e.exam_year === Number(year)).map((e) => e.exam_name),
    [exams, year],
  );
  const classListMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    exams
      .filter((e) => e.exam_year === Number(year))
      .forEach((e) => {
        if (!map[e.exam_name]) map[e.exam_name] = e.levels || [];
      });
    return map;
  }, [exams, year]);

  const classOptions = useMemo(
    () =>
      (classListMap[examName] || [])
        .slice()
        .sort((a, b) => a - b)
        .filter((cls) => {
          if (user?.role === 'admin') return true;
          if (isTeacher) {
            return teacherLevels.some(
              (l) => l.class_name === Number(cls) && l.year === Number(year),
            );
          }
          return false;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classListMap, examName, user, year],
  );

  const sections = useMemo(
    () =>
      Array.from(new Set(students.map((s) => s.section)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .filter((sec) => {
          if (user?.role === 'admin') return true;
          if (isTeacher) {
            return teacherLevels.some(
              (l) => l.class_name === Number(level) && l.section === sec && l.year === Number(year),
            );
          }
          return false;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, user, level, year],
  );

  // A teacher with exactly one class this year gets it picked for them.
  useEffect(() => {
    if (!isTeacher || !examName) return;
    const assignmentsInYear = teacherLevels.filter((l) => l.year === Number(year));
    if (assignmentsInYear.length === 1) {
      setLevel(assignmentsInYear[0].class_name.toString());
      setSection(assignmentsInYear[0].section);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year, examName]);

  useEffect(() => {
    if (specific && !subjectsForClass.some((sub) => sub.id == Number(specific))) {
      setSpecific(0);
    }
  }, [subjectsForClass, specific]);

  useEffect(() => {
    if (selectedSubject && selectedSubject.group && selectedSubject.group !== '') {
      setGroup(selectedSubject.group);
    }
  }, [selectedSubject]);

  // Saved marks as the starting point; null = not entered (never assumed 0).
  const initialMarks = useMemo(() => {
    const initialData: MarksData = {};
    existingMarks.forEach((student) => {
      initialData[student.student_id] = {
        subjectMarks: subjectsForClass.map((subject) => {
          const existingMark = (student.marks || []).find((mark) => mark.subject_id === subject.id);
          return {
            subjectId: subject.id,
            cq_marks: existingMark?.cq_marks ?? null,
            mcq_marks: existingMark?.mcq_marks ?? null,
            practical_marks: existingMark?.practical_marks ?? null,
            marks: existingMark?.marks ?? null,
          };
        }),
      };
    });
    return initialData;
  }, [existingMarks, subjectsForClass]);

  useEffect(() => {
    setMarksData(initialMarks);
    setDirtyStudentIds(new Set());
  }, [initialMarks]);

  const unsavedCount = dirtyStudentIds.size;

  // Browser reload/close guard + in-app navigation guard.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedCount]);

  useEffect(() => {
    setDirty(unsavedCount > 0);
    return () => resetDirty();
  }, [unsavedCount, setDirty, resetDirty]);

  const handleMarksChange = useCallback(
    (studentId: number, subjectId: number, markType: MarkField, value: string) => {
      const subject = subjectsForClass.find((s) => s.id === subjectId);
      let maxMark = 100;
      if (subject) {
        if (markType === 'cq_marks') maxMark = subject.cq_mark || 0;
        else if (markType === 'mcq_marks') maxMark = subject.mcq_mark || 0;
        else if (markType === 'practical_marks') maxMark = subject.practical_mark || 0;
        else if (markType === 'marks') maxMark = subject.full_mark || 100;
      }

      // Parse and validate: empty = null, non-numeric = reject, clamp to [0, maxMark]
      let validatedMarks: number | null;
      if (value === '') {
        validatedMarks = null;
      } else {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) return;
        validatedMarks = Math.min(Math.max(0, parsed), maxMark);
      }

      setMarksData((prev) => {
        const currentStudent = prev[studentId] || { subjectMarks: [] };
        const currentSubjectIndex = currentStudent.subjectMarks.findIndex(
          (m) => m.subjectId === subjectId,
        );
        let updatedSubjectMarks: SubjectMark[];
        if (currentSubjectIndex >= 0) {
          updatedSubjectMarks = [...currentStudent.subjectMarks];
          const updatedMark = {
            ...updatedSubjectMarks[currentSubjectIndex],
            [markType]: validatedMarks,
          };
          if (subject && subject.marking_scheme === 'BREAKDOWN' && markType !== 'marks') {
            const cq = updatedMark.cq_marks;
            const mcq = updatedMark.mcq_marks;
            const prac = updatedMark.practical_marks;
            updatedMark.marks =
              !isSet(cq) && !isSet(mcq) && !isSet(prac)
                ? null
                : (Number(cq) || 0) + (Number(mcq) || 0) + (Number(prac) || 0);
          }
          updatedSubjectMarks[currentSubjectIndex] = updatedMark;
        } else {
          const newMark: SubjectMark = {
            subjectId,
            cq_marks: markType === 'cq_marks' ? validatedMarks : null,
            mcq_marks: markType === 'mcq_marks' ? validatedMarks : null,
            practical_marks: markType === 'practical_marks' ? validatedMarks : null,
            marks: markType === 'marks' ? validatedMarks : null,
          };
          if (subject && subject.marking_scheme === 'BREAKDOWN' && markType !== 'marks') {
            newMark.marks = isSet(validatedMarks) ? validatedMarks : null;
          }
          updatedSubjectMarks = [...currentStudent.subjectMarks, newMark];
        }
        return { ...prev, [studentId]: { ...currentStudent, subjectMarks: updatedSubjectMarks } };
      });
      setDirtyStudentIds((prev) => new Set(prev).add(studentId));
    },
    [subjectsForClass],
  );

  // Class/group/section scope (what the counts describe); search only narrows the rows shown.
  const scopedStudents = useMemo(
    () =>
      students
        .filter((s: Student) => (group ? s.group === group : true))
        .filter((s: Student) => !section || s.section === section)
        .sort((a: Student, b: Student) => {
          const secCmp = a.section.localeCompare(b.section, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
          if (secCmp !== 0) return secCmp;
          const rollA = Number(a.roll) || 0;
          const rollB = Number(b.roll) || 0;
          if (rollA !== rollB) return rollA - rollB;
          return a.name.localeCompare(b.name);
        }),
    [students, group, section],
  );

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scopedStudents;
    return scopedStudents.filter(
      (s) => s.name.toLowerCase().includes(query) || s.roll.toString().includes(query),
    );
  }, [scopedStudents, searchQuery]);

  const groupMismatch = (student: Student) =>
    Boolean(
      selectedSubject?.group &&
      selectedSubject.group !== '' &&
      selectedSubject.group !== student.group,
    );
  const markFor = (studentId: number) =>
    selectedSubject
      ? marksData[studentId]?.subjectMarks?.find((m) => m.subjectId === selectedSubject.id)
      : undefined;

  // Real counts only: a student with no mark is "not entered", never 0.
  const counts = useMemo(() => {
    const eligible = scopedStudents.filter((s) => !groupMismatch(s));
    const entered = eligible.filter((s) => isSet(markFor(s.student_id)?.marks)).length;
    return { eligible: eligible.length, entered, notEntered: eligible.length - entered };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedStudents, selectedSubject, marksData]);

  const onSubmit = () => {
    if (!selectedSubject) return;
    const submissionData = students
      .filter((student) => dirtyStudentIds.has(student.student_id))
      .map((student) => {
        const existingMark = markFor(student.student_id);
        return {
          studentId: student.student_id,
          subjectMarks: [
            {
              subjectId: selectedSubject.id,
              cq_marks: existingMark?.cq_marks ?? null,
              mcq_marks: existingMark?.mcq_marks ?? null,
              practical_marks: existingMark?.practical_marks ?? null,
              marks: existingMark?.marks ?? null,
            },
          ],
        };
      });

    if (submissionData.length === 0) {
      toast.error('No mark changes to save');
      return;
    }

    addMarksMutation.mutate(
      { students: submissionData, examName, year },
      {
        onSuccess: () => {
          setDirtyStudentIds(new Set());
          refetchMarks();
        },
      },
    );
  };

  const discard = () => {
    setMarksData(initialMarks);
    setDirtyStudentIds(new Set());
  };

  /** Asks before throwing away unsaved marks; resolves true when it's fine to continue. */
  const okToDiscard = async (what: string) => {
    if (unsavedCount === 0) return true;
    const proceed = await confirm({
      title: 'Discard unsaved changes?',
      msg: `You have unsaved marks. Changing the ${what} will discard them.`,
      confirmLabel: 'Discard & continue',
    });
    if (proceed) discard();
    return proceed;
  };

  const handleYearChange = async (value: number) => {
    if (!(await okToDiscard('year'))) return;
    setYear(value);
    setExamName('');
    setLevel('');
    setGroup('');
    setSection('');
    setSpecific(0);
  };

  const handleExamChange = async (value: string) => {
    if (!(await okToDiscard('exam'))) return;
    setExamName(value);
    // Pre-pick the class remembered from Attendance when this exam has it.
    const stored = String(readStoredClass());
    setLevel(classListMap[value]?.map(String).includes(stored) ? stored : '');
    setGroup('');
    setSection('');
    setSpecific(0);
  };

  const handleClassChange = async (value: string) => {
    if (!(await okToDiscard('class'))) return;
    setLevel(value);
    setGroup('');
    setSection('');
    setSpecific(0);
    if (value) storeClass(Number(value));
  };

  const handleGroupChange = async (value: string) => {
    if (await okToDiscard('group')) setGroup(value);
  };

  const handleSectionChange = async (value: string) => {
    if (await okToDiscard('section')) setSection(value);
  };

  const handleSubjectChange = async (value: number) => {
    if (await okToDiscard('subject')) setSpecific(value);
  };

  const isLoading = isLoadingSubjects || isLoadingExams || isLoadingStudents || isLoadingMarks;
  const isBreakdown = selectedSubject?.marking_scheme === 'BREAKDOWN';
  const subjectConfigured = Boolean(
    selectedSubject &&
    selectedSubject.full_mark > 0 &&
    (selectedSubject.marking_scheme === 'TOTAL' ||
      (selectedSubject.cq_mark || 0) > 0 ||
      (selectedSubject.mcq_mark || 0) > 0 ||
      (selectedSubject.practical_mark || 0) > 0),
  );
  const canSave = !addMarksMutation.isPending && subjectConfigured && unsavedCount > 0;

  const markColumns: { field: MarkField; label: string; max: number }[] = !selectedSubject
    ? []
    : isBreakdown
      ? [
          { field: 'cq_marks', label: 'CQ', max: selectedSubject.cq_mark || 0 },
          { field: 'mcq_marks', label: 'MCQ', max: selectedSubject.mcq_mark || 0 },
          { field: 'practical_marks', label: 'Prac', max: selectedSubject.practical_mark || 0 },
        ]
      : [{ field: 'marks', label: 'Marks', max: selectedSubject.full_mark || 0 }];
  // Breakdown subjects add a read-only Total column.
  const colSpan = markColumns.length + (isBreakdown ? 1 : 0) + 3;
  const showSection = !section;
  const subjectId = selectedSubject?.id ?? 0;

  const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');

  const summary = !examName
    ? 'Pick an exam, class and subject to enter marks.'
    : !level
      ? `${examName} ${year} · pick a class`
      : [
          `Class ${level}${section ? ` ${section}` : ''}${group ? ` · ${group}` : ''}`,
          `${scopedStudents.length.toLocaleString()} students`,
          selectedSubject
            ? `${selectedSubject.name} · full mark ${selectedSubject.full_mark || 0}`
            : 'pick a subject',
        ].join(' · ');

  const saveButton = (
    <Button
      type="button"
      onClick={onSubmit}
      disabled={!canSave}
      title={
        !selectedSubject
          ? 'Pick a subject to enter marks'
          : !subjectConfigured
            ? 'This subject has no mark limits set'
            : undefined
      }
    >
      {addMarksMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
      {addMarksMutation.isPending ? 'Saving…' : 'Save marks'}
    </Button>
  );

  const emptyMessage = !examName
    ? 'Pick an exam to start.'
    : !level
      ? 'Pick a class to see its students.'
      : students.length === 0
        ? 'No students found for this class.'
        : !selectedSubject
          ? 'Pick a subject to enter marks.'
          : filteredStudents.length === 0
            ? `No students match${searchQuery ? ` "${searchQuery}"` : ' these filters'}.`
            : null;

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      {dialog}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Marks entry</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Year"
              className={cn(pickerClass, 'tabular-nums')}
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={isLoadingExams}
            >
              {Array.from({ length: 10 }, (_, i) => 2020 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Exam"
              className={pickerClass}
              value={examName}
              onChange={(e) => handleExamChange(e.target.value)}
              disabled={isLoadingExams}
            >
              <option value="">Select exam</option>
              {examList.map((exam) => (
                <option key={exam} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
            <select
              aria-label="Class"
              className={pickerClass}
              value={level}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!examName}
            >
              <option value="">Select class</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  Class {cls}
                </option>
              ))}
            </select>
            {Number(level) >= 9 && (
              <select
                aria-label="Group"
                className={pickerClass}
                value={group}
                onChange={(e) => handleGroupChange(e.target.value)}
              >
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Section"
              className={pickerClass}
              value={section}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={!level}
            >
              <option value="">All sections</option>
              {sections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
            <select
              aria-label="Subject"
              className={pickerClass}
              value={specific}
              onChange={(e) => handleSubjectChange(Number(e.target.value))}
              disabled={!level}
            >
              <option value={0}>Select subject</option>
              {subjectsForClass.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {unsavedCount === 0 && saveButton}
      </header>

      {selectedSubject && scopedStudents.length > 0 && (
        <div className="border-border bg-card mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-5 py-4 shadow-sm">
          <Stat label="Students" value={counts.eligible} />
          <Stat label="Entered" value={counts.entered} dot="bg-emerald-500" />
          <Stat label="Not entered" value={counts.notEntered} dot="bg-amber-500" />
        </div>
      )}

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll the mark columns sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-border [&>th]:bg-muted text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
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
                {markColumns.map((c) => (
                  <th key={c.field} className="w-20 min-w-20 px-2 py-2.5 text-center tabular-nums">
                    {c.label} <span className="font-normal normal-case">/{c.max}</span>
                  </th>
                ))}
                {isBreakdown && (
                  <th className="w-20 min-w-20 px-2 py-2.5 text-center tabular-nums">
                    Total{' '}
                    <span className="font-normal normal-case">/{selectedSubject?.full_mark}</span>
                  </th>
                )}
                <th aria-hidden className="w-full p-0" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading && Boolean(level) ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={colSpan} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : emptyMessage ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="text-muted-foreground px-4 py-12 text-center text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const mark = markFor(student.student_id);
                  const mismatch = groupMismatch(student);
                  const dirty = dirtyStudentIds.has(student.student_id);
                  return (
                    <tr
                      key={student.student_id}
                      className={cn(
                        'transition-colors',
                        dirty
                          ? 'bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]'
                          : 'bg-card hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]',
                        mismatch && 'text-muted-foreground',
                      )}
                    >
                      <td className={cn(stickyRoll, 'px-3 py-2 text-sm tabular-nums')}>
                        {showSection ? `${student.section}-${student.roll}` : student.roll}
                      </td>
                      <td className={cn(stickyName, 'px-3 py-2')}>
                        <span className="block truncate text-sm font-medium">{student.name}</span>
                      </td>
                      {mismatch ? (
                        <td
                          colSpan={markColumns.length + (isBreakdown ? 1 : 0)}
                          className="px-2 py-2 text-center text-xs"
                        >
                          Not for {student.group || 'this'} group
                        </td>
                      ) : (
                        <>
                          {markColumns.map((c) => (
                            <td key={c.field} className="px-2 py-1.5 text-center">
                              <MarkInput
                                value={mark?.[c.field]}
                                max={c.max}
                                disabled={!c.max}
                                label={`${student.name} ${c.label}`}
                                col={c.field}
                                onChange={(v) =>
                                  handleMarksChange(student.student_id, subjectId, c.field, v)
                                }
                              />
                            </td>
                          ))}
                          {isBreakdown && (
                            <td className="px-2 py-2 text-center text-sm font-semibold tabular-nums">
                              {isSet(mark?.marks) ? (
                                mark?.marks
                              ) : (
                                <span className="text-muted-foreground font-normal">—</span>
                              )}
                            </td>
                          )}
                        </>
                      )}
                      <td aria-hidden className="p-0" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {selectedSubject && filteredStudents.length > 0 && (
          <p className="border-border text-muted-foreground border-t px-4 py-2.5 text-xs">
            Enter or ↓ moves to the next student, ↑ to the previous. Marks above the limit are
            capped. Empty = not entered.
          </p>
        )}
      </SectionCard>

      {unsavedCount > 0 && <div aria-hidden className="min-h-6 flex-1" />}
      {unsavedCount > 0 && (
        <div
          role="region"
          aria-label="Unsaved marks"
          className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
        >
          <p className="text-sm font-medium tabular-nums">
            {unsavedCount} unsaved {unsavedCount === 1 ? 'student' : 'students'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={discard}>
              Discard
            </Button>
            {saveButton}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddMarks;
