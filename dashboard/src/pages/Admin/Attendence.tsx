import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import {
  useAttendance,
  useAttendanceOverview,
  useAttendanceStats,
  useSmsSettings,
  useSaveAndSendAttendance,
  downloadAttendanceSheet,
} from '@/queries/attendence.queries.js';
import useNavigationStore from '@/store/navigation.Store';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { SectionCard, StatusBadge, filterSelectClassName } from '@/components';
import { AlertTriangle, Check, FileDown, Loader2, Send, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { smsCredits, smsDate } from '@/lib/sms';
import { openBlobInNewTab } from '@school/common-ui/blob';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_CLASSES,
  ATTENDANCE_SECTIONS,
  readStoredClass,
  storeClass,
} from '@/lib/attendanceClass';

interface StudentOverview {
  id: number;
  name: string;
  image: string | null;
  class: number;
  section: string;
  roll: number;
  enrollment_id: number;
  login_id: number;
  available: boolean;
  has_phone?: boolean;
}

type AttendanceStatus = 'present' | 'absent' | 'run-awayed';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const classes = ATTENDANCE_CLASSES;
const sections = ATTENDANCE_SECTIONS;

// Pinned Roll + Student columns; opaque backgrounds hide the day columns scrolling under them.
const stickyRoll = 'sticky left-0 z-[1] w-14 min-w-14 bg-inherit';
const stickyName =
  'sticky left-14 z-[1] min-w-[10rem] bg-inherit shadow-[1px_0_0_var(--border)] sm:min-w-[14rem]';
const todayTint = 'bg-[color-mix(in_oklab,var(--primary)_5%,transparent)]';

const StatusIcon = ({ status }: { status: AttendanceStatus | null }) =>
  status === 'present' ? (
    <Check
      className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
      aria-label="Present"
    />
  ) : status === 'absent' ? (
    <X className="mx-auto h-4 w-4 text-red-500 dark:text-red-400" aria-label="Absent" />
  ) : status === 'run-awayed' ? (
    <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" aria-label="Ran away" />
  ) : (
    <span className="text-muted-foreground text-sm" aria-label="Not marked">
      —
    </span>
  );

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

function Attendance() {
  const { confirm, dialog } = useConfirmDialog();
  const currentDate = new Date();
  const todayDay = currentDate.getDate();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedClass, setSelectedClass] = useState<number | ''>(readStoredClass);
  // A class always comes with a section: the list API returns nothing for "all sections".
  const [selectedSection, setSelectedSection] = useState(() =>
    readStoredClass() ? sections[0] : '',
  );
  const [visibleDays, setVisibleDays] = useState<number[]>([todayDay]);
  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({});
  const { setDirty, resetDirty } = useNavigationStore();
  const { data: smsSettings } = useSmsSettings(selectedSection);

  const isCurrentMonth =
    selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();

  const { data: attendanceRecords } = useAttendance({
    month: selectedMonth,
    year: selectedYear,
    level: selectedClass === '' ? undefined : selectedClass,
    section: selectedSection || undefined,
  });
  const { data: studentsData, isLoading: studentsLoading } = useAttendanceOverview({
    year: selectedYear,
    level: selectedClass === '' ? undefined : selectedClass,
    section: selectedSection || undefined,
  });

  const todayIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(todayDay).padStart(2, '0')}`;

  const { data: persistentStats } = useAttendanceStats({
    date: todayIso,
    level: selectedClass === '' ? 0 : selectedClass,
    section: selectedSection,
    year: selectedYear,
  });

  const saveAndSendMutation = useSaveAndSendAttendance();
  const statsToDisplay = persistentStats?.data;
  const [exportingPdf, setExportingPdf] = useState(false);

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  const { attendanceMap, sentMap } = useMemo(() => {
    const aMap: Record<string, AttendanceStatus> = {};
    const sMap: Record<string, boolean> = {};

    if (!attendanceRecords?.data) return { attendanceMap: aMap, sentMap: sMap };

    attendanceRecords.data.forEach((record: any) => {
      if (record.date.startsWith(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`)) {
        const day = parseInt(record.date.split('-')[2]);
        const key = `${record.student_id}-${day}`;
        aMap[key] = record.status as AttendanceStatus;
        sMap[key] = !!record.send_msg;
      }
    });
    return { attendanceMap: aMap, sentMap: sMap };
  }, [attendanceRecords, selectedMonth, selectedYear]);

  const students = (studentsData?.data || []) as StudentOverview[];
  const unsavedCount = Object.keys(localAttendance).length;

  const handleAttendanceChange = (studentId: number, day: number, isPresent: boolean) => {
    const key = `${studentId}-${day}`;
    // From this page, you can only toggle between present and absent.
    // Run Awayed is set from the Stay Check page.
    const nextStatus: AttendanceStatus = isPresent ? 'present' : 'absent';
    const currentStatus = attendanceMap[key] || 'absent';

    setLocalAttendance((prev) => {
      if (nextStatus === currentStatus) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: nextStatus,
      };
    });
  };

  const getRecordedStatus = (studentId: number, day: number): AttendanceStatus | null => {
    const key = `${studentId}-${day}`;
    return localAttendance[key] || attendanceMap[key] || null;
  };

  /** Today edit default = absent when unmarked. */
  const getStatus = (studentId: number, day: number): AttendanceStatus => {
    return getRecordedStatus(studentId, day) || 'absent';
  };

  // Students whose today box can be ticked (active, not marked run-away by Stay Check).
  const markable = students.filter(
    (s) => s.available && getRecordedStatus(s.id, todayDay) !== 'run-awayed',
  );
  const markedPresent = markable.filter((s) => getStatus(s.id, todayDay) === 'present').length;
  const setAllToday = (present: boolean) =>
    markable.forEach((s) => handleAttendanceChange(s.id, todayDay, present));

  const realtimeStats = useMemo(() => {
    if (!students.length || !isCurrentMonth) {
      const activePersistentPresent = persistentStats?.data?.present || 0;
      const activePersistentAbsent = persistentStats?.data?.absent || 0;
      const activePersistentRunAwayed = persistentStats?.data?.runAwayed || 0;

      return {
        present: activePersistentPresent,
        absent: activePersistentAbsent,
        runAwayed: activePersistentRunAwayed,
        notMarked: 0,
        total: activePersistentPresent + activePersistentAbsent + activePersistentRunAwayed,
      };
    }

    // Count only what's recorded (or ticked here). No record = not marked, never assumed absent.
    let presentCount = 0;
    let absentCount = 0;
    let runAwayedCount = 0;
    let notMarked = 0;
    const activeStudents = students.filter((s) => s.available);

    activeStudents.forEach((student) => {
      const status = getRecordedStatus(student.id, todayDay);
      if (!status) notMarked++;
      else if (status === 'present') presentCount++;
      else if (status === 'run-awayed') runAwayedCount++;
      else absentCount++;
    });

    return {
      present: presentCount,
      absent: absentCount,
      runAwayed: runAwayedCount,
      notMarked,
      total: activeStudents.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, localAttendance, attendanceMap, persistentStats, isCurrentMonth, todayDay]);

  // 1. Browser navigation guard (Reload/Close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(localAttendance).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [localAttendance]);

  // Sync with global navigation store
  useEffect(() => {
    setDirty(Object.keys(localAttendance).length > 0);
    return () => resetDirty();
  }, [localAttendance, setDirty, resetDirty]);

  const smsEstimate = useMemo(() => {
    if (!smsSettings || !smsSettings.is_active || students.length === 0 || !isCurrentMonth)
      return { count: 0, cost: 0 };

    let totalSegments = 0;
    let messagesToSend = 0;
    const formattedDisplayDate = smsDate(todayIso);

    students.forEach((student) => {
      const status = getStatus(student.id, todayDay);
      const shouldSend =
        (status === 'present' && smsSettings.send_to_present) ||
        (status === 'absent' && smsSettings.send_to_absent) ||
        (status === 'run-awayed' && smsSettings.send_to_run_awayed);

      const alreadySent = sentMap[`${student.id}-${todayDay}`];
      // Server only texts active students with a father's phone (has_phone false = skipped).
      if (alreadySent || !student.available || !shouldSend || student.has_phone === false) return;

      const template =
        status === 'present'
          ? smsSettings.present_template
          : status === 'absent'
            ? smsSettings.absent_template
            : smsSettings.run_awayed_template;
      if (!template) return;

      totalSegments += smsCredits(template, {
        student_name: student.name,
        login_id: student.login_id,
        date: formattedDisplayDate,
        class: student.class,
        section: student.section,
        roll: student.roll,
        school_name: smsSettings.school_name,
      });
      messagesToSend++;
    });

    return { count: messagesToSend, cost: totalSegments };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsSettings, students, localAttendance, attendanceMap, sentMap, isCurrentMonth, todayIso]);

  const lowBalance = smsEstimate.cost > 0 && smsSettings?.sms_balance < smsEstimate.cost;

  const saveAndSendAttendance = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Please select both class and section');
      return;
    }
    if (!isCurrentMonth) {
      toast.error('Attendance can only be managed for the current date');
      return;
    }

    const date = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    // Never overwrite Stay-Check "run-awayed" with morning present/absent.
    const recordsToSave = students.map((student) => {
      const recorded = getRecordedStatus(student.id, todayDay);
      const status = recorded === 'run-awayed' ? 'run-awayed' : getStatus(student.id, todayDay);
      return {
        studentId: student.id,
        date,
        status,
      };
    });

    saveAndSendMutation.mutate(
      {
        records: recordsToSave,
        date,
        level: selectedClass as number,
        section: selectedSection,
        year: selectedYear,
      },
      {
        onSuccess: () => {
          setLocalAttendance({});
          resetDirty();
        },
      },
    );
  };

  /** Asks before throwing away unsaved ticks; resolves true when it's fine to continue. */
  const okToDiscard = async (what: string) => {
    if (unsavedCount === 0) return true;
    const proceed = await confirm({
      title: 'Discard unsaved changes?',
      msg: `You have unsaved attendance. Changing the ${what} will discard it.`,
      confirmLabel: 'Discard & continue',
    });
    if (proceed) setLocalAttendance({});
    return proceed;
  };

  const handleClassChange = async (newClass: number | '') => {
    if (!(await okToDiscard('class'))) return;
    setSelectedClass(newClass);
    setSelectedSection(newClass ? sections[0] : '');
    storeClass(newClass);
  };

  const handleSectionChange = async (newSection: string) => {
    if (await okToDiscard('section')) setSelectedSection(newSection);
  };

  const handleMonthChange = async (newMonth: number) => {
    if (await okToDiscard('month')) setSelectedMonth(newMonth);
  };

  const handleYearChange = async (newYear: number) => {
    if (await okToDiscard('year')) setSelectedYear(newYear);
  };

  const toggleVisibleDay = (day: number) => {
    setVisibleDays((prev: number[]) =>
      prev.includes(day)
        ? prev.filter((d: number) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  };

  const exportAttendancePdf = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Select class and section first');
      return;
    }
    if (unsavedCount > 0) {
      const proceed = await confirm({
        title: 'Unsaved changes',
        msg: 'You have unsaved attendance changes. Export uses saved data only. Continue?',
        confirmLabel: 'Export anyway',
        variant: 'default',
      });
      if (!proceed) return;
    }

    const loadingToast = toast.loading('Generating attendance sheet…');
    setExportingPdf(true);
    const preview = window.open('', '_blank');
    if (preview) {
      preview.document.write(
        'Preparing attendance sheet… If this takes too long, check for errors.',
      );
    }

    try {
      const blob = await downloadAttendanceSheet({
        year: selectedYear,
        monthIndex: selectedMonth,
        level: selectedClass as number,
        section: selectedSection,
      });
      openBlobInNewTab(blob, preview ?? undefined);
      toast.success('Attendance sheet ready', { id: loadingToast });
    } catch (error: any) {
      if (preview) preview.close();
      toast.error(
        error?.response?.data?.message || error?.message || 'Failed to export attendance sheet',
        { id: loadingToast },
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const canSave =
    !saveAndSendMutation.isPending &&
    Boolean(selectedClass) &&
    Boolean(selectedSection) &&
    isCurrentMonth &&
    students.length > 0;
  const saveHint =
    !selectedClass || !selectedSection
      ? 'Select a class and section to take attendance'
      : !isCurrentMonth
        ? 'Attendance can only be taken for today'
        : undefined;

  const classLabel = selectedClass
    ? `Class ${selectedClass}${selectedSection ? ` ${selectedSection}` : ''}`
    : 'No class selected';
  const activeCount = students.filter((s) => s.available).length;
  const showSection = !selectedSection;

  const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');

  const saveButton = (
    <Button type="button" onClick={saveAndSendAttendance} disabled={!canSave} title={saveHint}>
      {saveAndSendMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
      {saveAndSendMutation.isPending ? 'Saving…' : 'Save & send SMS'}
    </Button>
  );

  const smsLine =
    smsEstimate.cost > 0 ? (
      <span
        className={cn(
          'text-xs tabular-nums',
          lowBalance ? 'text-destructive font-medium' : 'text-muted-foreground',
        )}
      >
        ≈ {smsEstimate.cost} SMS credits
        {lowBalance && ` · balance ${smsSettings?.sms_balance} is not enough`}
      </span>
    ) : null;

  const todayHeader = (
    <label className="inline-flex flex-col items-center gap-1">
      <span className="text-primary">{todayDay}</span>
      <input
        type="checkbox"
        aria-label="Mark everyone present today"
        title="Mark everyone present"
        disabled={markable.length === 0}
        checked={markable.length > 0 && markedPresent === markable.length}
        ref={(el) => {
          if (el) el.indeterminate = markedPresent > 0 && markedPresent < markable.length;
        }}
        onChange={(e) => setAllToday(e.target.checked)}
        className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Attendance</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Class"
              className={pickerClass}
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value ? parseInt(e.target.value) : '')}
            >
              {!selectedClass && <option value="">Select class</option>}
              {classes.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Section"
              className={pickerClass}
              value={selectedSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={!selectedClass}
            >
              {!selectedSection && <option value="">Section</option>}
              {sections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
            <select
              aria-label="Month"
              className={pickerClass}
              value={selectedMonth}
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
            >
              {months.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              className={cn(pickerClass, 'tabular-nums')}
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
            >
              {[
                currentDate.getFullYear() - 1,
                currentDate.getFullYear(),
                currentDate.getFullYear() + 1,
              ].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportAttendancePdf}
              disabled={exportingPdf || !selectedClass || !selectedSection || !students.length}
              title={
                !selectedClass || !selectedSection
                  ? 'Select a class and section to export'
                  : 'Monthly attendance sheet (PDF)'
              }
            >
              {exportingPdf ? <Loader2 className="animate-spin" /> : <FileDown />}
              Export PDF
            </Button>
            {saveButton}
          </div>
          {unsavedCount === 0 && smsLine}
        </div>
      </header>

      {/* Today at a glance */}
      <div className="border-border bg-card mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-5 py-4 shadow-sm">
        <p className="text-muted-foreground w-full text-xs font-semibold uppercase tracking-wider sm:w-auto">
          Today
        </p>
        <Stat label="Students" value={realtimeStats.total} />
        <Stat label="Present" value={realtimeStats.present} dot="bg-emerald-500" />
        <Stat label="Absent" value={realtimeStats.absent} dot="bg-red-500" />
        <Stat label="Ran away" value={realtimeStats.runAwayed} dot="bg-amber-500" />
        {realtimeStats.notMarked > 0 && (
          <Stat label="Not marked yet" value={realtimeStats.notMarked} />
        )}
        <div className="border-border text-muted-foreground text-sm sm:ml-auto sm:border-l sm:pl-8">
          <p className="text-xs font-medium">SMS</p>
          <p className="mt-0.5 tabular-nums">
            <span className="text-foreground font-semibold">
              {(statsToDisplay?.sms?.successful || 0).toLocaleString()}
            </span>{' '}
            sent
            {(statsToDisplay?.sms?.failed || 0) > 0 && (
              <span className="text-destructive"> · {statsToDisplay.sms.failed} failed</span>
            )}
            {(statsToDisplay?.sms?.pending || 0) > 0 && (
              <span> · {statsToDisplay.sms.pending} pending</span>
            )}
          </p>
        </div>
      </div>

      <SectionCard noPadding className="mb-6">
        {/* Card header: what's shown + which days */}
        <div className="border-border flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center">
          <p className="shrink-0 text-sm font-semibold">
            {classLabel}
            <span className="text-muted-foreground font-normal">
              {' '}
              · {activeCount.toLocaleString()} students · {months[selectedMonth]} {selectedYear}
            </span>
          </p>
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:justify-end">
            <div
              role="group"
              aria-label="Visible days"
              className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:pb-0"
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const on = visibleDays.includes(day);
                const isToday = isCurrentMonth && day === todayDay;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleVisibleDay(day)}
                    aria-pressed={on}
                    aria-label={`Show day ${day}`}
                    className={cn(
                      'focus-visible:ring-ring pointer-coarse:h-10 pointer-coarse:min-w-10 h-7 min-w-7 shrink-0 rounded-md text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2',
                      on
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      isToday && !on && 'ring-primary/40 text-foreground ring-1 ring-inset',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVisibleDays([todayDay])}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVisibleDays(Array.from({ length: daysInMonth }, (_, i) => i + 1))}
              >
                All
              </Button>
            </div>
          </div>
        </div>

        {/* One table for every screen: narrow screens scroll the day columns sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider">
                <th className={cn(stickyRoll, 'px-3 py-2.5')}>Roll</th>
                <th className={cn(stickyName, 'px-3 py-2.5')}>Student</th>
                {visibleDays.map((day) => {
                  const isToday = isCurrentMonth && day === todayDay;
                  return (
                    <th
                      key={day}
                      className={cn(
                        'w-12 min-w-12 px-1 py-2 text-center tabular-nums',
                        isToday && todayTint,
                      )}
                    >
                      {isToday ? todayHeader : day}
                    </th>
                  );
                })}
                <th aria-hidden className="w-full p-0" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {studentsLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={visibleDays.length + 3} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleDays.length + 3}
                    className="text-muted-foreground px-4 py-12 text-center text-sm"
                  >
                    {selectedClass
                      ? 'No students in this class.'
                      : 'Pick a class and section to take attendance.'}
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className={cn(
                      'bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]',
                      !student.available && 'text-muted-foreground',
                    )}
                  >
                    <td className={cn(stickyRoll, 'px-3 py-2 text-sm tabular-nums')}>
                      {showSection ? `${student.section}-${student.roll}` : student.roll}
                    </td>
                    <td className={cn(stickyName, 'px-3 py-2')}>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{student.name}</span>
                        {!student.available && (
                          <StatusBadge status="inactive" className="shrink-0" />
                        )}
                      </div>
                    </td>
                    {visibleDays.map((day) => {
                      const isToday = isCurrentMonth && day === todayDay;
                      const recorded = getRecordedStatus(student.id, day);
                      return (
                        <td key={day} className={cn('px-1 py-2 text-center', isToday && todayTint)}>
                          {isToday && recorded !== 'run-awayed' ? (
                            <input
                              type="checkbox"
                              checked={recorded === 'present'}
                              disabled={!student.available}
                              aria-label={`${student.name} present today`}
                              onChange={(e) =>
                                handleAttendanceChange(student.id, day, e.target.checked)
                              }
                              className="h-5 w-5 cursor-pointer align-middle disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          ) : (
                            <StatusIcon status={recorded} />
                          )}
                        </td>
                      );
                    })}
                    <td aria-hidden className="p-0" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Present
          </span>
          <span className="inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5 text-red-500" aria-hidden /> Absent
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden /> Ran away (set from
            Running Away)
          </span>
          <span>— Not marked</span>
        </div>
      </SectionCard>

      {unsavedCount > 0 && (
        <div
          role="region"
          aria-label="Unsaved attendance"
          className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2 shadow-lg"
        >
          <div>
            <p className="text-sm font-medium tabular-nums">
              {unsavedCount} unsaved {unsavedCount === 1 ? 'change' : 'changes'}
            </p>
            {smsLine}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setLocalAttendance({})}>
              Discard
            </Button>
            {saveButton}
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;
