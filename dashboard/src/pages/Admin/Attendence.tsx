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
import PageHeader from '@/components/PageHeader.js';
import SectionCard from '@/components/SectionCard.js';
import StatsCard from '@/components/StatsCard.js';
import {
  Calendar as CalendarIcon,
  Save,
  RefreshCcw,
  Users,
  CheckCircle2,
  XCircle,
  Filter,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateSMSCount } from '@school/shared-schemas';
import { openBlobInNewTab } from '@school/common-ui/blob';

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

function Attendance() {
  const { confirm, dialog } = useConfirmDialog();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedClass, setSelectedClass] = useState<number | ''>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [visibleDays, setVisibleDays] = useState<number[]>([currentDate.getDate()]);
  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({});
  const { setDirty, resetDirty } = useNavigationStore();
  const { data: smsSettings } = useSmsSettings(selectedSection);

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
  )}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const { data: persistentStats } = useAttendanceStats({
    date: todayIso,
    level: selectedClass === '' ? 0 : selectedClass,
    section: selectedSection,
    year: selectedYear,
  });

  const saveAndSendMutation = useSaveAndSendAttendance();
  const statsToDisplay = persistentStats?.data;
  const [exportingPdf, setExportingPdf] = useState(false);

  const classes = [6, 7, 8, 9, 10];
  const sections = ['A', 'B'];

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

  const realtimeStats = useMemo(() => {
    const todayDay = currentDate.getDate();
    const isToday =
      selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();

    if (!students.length || !isToday) {
      const activePersistentPresent = persistentStats?.data?.present || 0;
      const activePersistentAbsent = persistentStats?.data?.absent || 0;
      const activePersistentRunAwayed = persistentStats?.data?.runAwayed || 0;

      return {
        present: activePersistentPresent,
        absent: activePersistentAbsent,
        runAwayed: activePersistentRunAwayed,
        total: activePersistentPresent + activePersistentAbsent + activePersistentRunAwayed,
      };
    }

    const activeStudents = students.filter((s) => s.available);
    const todayKeys = activeStudents.map((s) => `${s.id}-${todayDay}`);
    const hasAnyData = todayKeys.some((key) => !!attendanceMap[key] || !!localAttendance[key]);

    if (!hasAnyData) {
      return {
        present: 0,
        absent: 0,
        runAwayed: 0,
        total: activeStudents.length,
      };
    }

    let presentCount = 0;
    let absentCount = 0;
    let runAwayedCount = 0;

    activeStudents.forEach((student) => {
      const status = getStatus(student.id, todayDay);
      if (status === 'present') presentCount++;
      else if (status === 'run-awayed') runAwayedCount++;
      else absentCount++;
    });

    return {
      present: presentCount,
      absent: absentCount,
      runAwayed: runAwayedCount,
      total: activeStudents.length,
    };
  }, [
    students,
    localAttendance,
    attendanceMap,
    persistentStats,
    selectedMonth,
    selectedYear,
    currentDate,
  ]);

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
    const hasUnsavedChanges = Object.keys(localAttendance).length > 0;
    setDirty(hasUnsavedChanges);

    // Reset dirty state when component unmounts (optional, but good for cleanliness)
    return () => resetDirty();
  }, [localAttendance, setDirty, resetDirty]);

  const smsEstimate = useMemo(() => {
    if (!smsSettings || !smsSettings.is_active || students.length === 0)
      return { count: 0, cost: 0 };

    const todayDay = currentDate.getDate();
    const isToday =
      selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();
    if (!isToday) return { count: 0, cost: 0 };

    const todayIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

    let totalSegments = 0;
    let messagesToSend = 0;

    // Helper for segment calculation (mirroring backend SMSService)
    const calculateSegments = (text: string) => calculateSMSCount(text).count;

    students.forEach((student) => {
      const status = getStatus(student.id, todayDay);
      // Run Awayed SMS are handled by the Stay Check page, but we include them here if we want to preview total cost
      const shouldSend =
        (status === 'present' && smsSettings.send_to_present) ||
        (status === 'absent' && smsSettings.send_to_absent) ||
        (status === 'run-awayed' && smsSettings.send_to_run_awayed);

      const alreadySent = sentMap[`${student.id}-${todayDay}`];
      if (alreadySent || !student.available) return;

      if (shouldSend) {
        let template = '';
        if (status === 'present') template = smsSettings.present_template;
        else if (status === 'absent') template = smsSettings.absent_template;
        else if (status === 'run-awayed') template = smsSettings.run_awayed_template;

        if (!template) return;

        const formattedDisplayDate = todayIso.split('-').reverse().join('/');

        // Approximation of interpolated message length
        const message = template
          .replace(/{student_name}/g, student.name)
          .replace(/{login_id}/g, student.login_id?.toString() || '')
          .replace(/{date}/g, formattedDisplayDate) // Date length is fixed
          .replace(/{school_name}/g, 'Panchbibi Lal Bihari Govt High School');

        totalSegments += calculateSegments(message);
        messagesToSend++;
      }
    });

    return { count: messagesToSend, cost: totalSegments };
  }, [
    smsSettings,
    students,
    localAttendance,
    attendanceMap,
    sentMap,
    selectedMonth,
    selectedYear,
    currentDate,
    todayIso,
  ]);

  const saveAndSendAttendance = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Please select both class and section');
      return;
    }

    const todayDay = currentDate.getDate();
    const isTodaySelectable =
      selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear();

    if (!isTodaySelectable) {
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

  const handleClassChange = async (newClass: number | '') => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = await confirm({
        title: 'Discard unsaved changes?',
        msg: 'You have unsaved changes. Changing the class will discard them.',
        confirmLabel: 'Discard & Continue',
      });
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedClass(newClass);
    setSelectedSection('');
  };

  const handleSectionChange = async (newSection: string) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = await confirm({
        title: 'Discard unsaved changes?',
        msg: 'You have unsaved changes. Changing the section will discard them.',
        confirmLabel: 'Discard & Continue',
      });
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedSection(newSection);
  };

  const handleMonthChange = async (newMonth: number) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = await confirm({
        title: 'Discard unsaved changes?',
        msg: 'You have unsaved changes. Changing the month will discard them.',
        confirmLabel: 'Discard & Continue',
      });
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedMonth(newMonth);
  };

  const handleYearChange = async (newYear: number) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = await confirm({
        title: 'Discard unsaved changes?',
        msg: 'You have unsaved changes. Changing the year will discard them.',
        confirmLabel: 'Discard & Continue',
      });
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedYear(newYear);
  };

  const toggleVisibleDay = (day: number) => {
    setVisibleDays((prev: number[]) =>
      prev.includes(day)
        ? prev.filter((d: number) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  };

  const selectAllDays = () => {
    setVisibleDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  };

  const resetVisibleDays = () => {
    setVisibleDays([currentDate.getDate()]);
  };

  const exportAttendancePdf = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Select class and section first');
      return;
    }
    if (Object.keys(localAttendance).length > 0) {
      const proceed = await confirm({
        title: 'Unsaved Changes',
        msg: 'You have unsaved attendance changes. Export uses saved data only. Continue?',
        confirmLabel: 'Export Anyway',
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

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Attendance Management"
        description="Monitor and record student attendance across different classes and sections."
        className="mb-0"
      >
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          {smsEstimate.cost > 0 && (
            <div
              className={`self-end rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                smsSettings?.sms_balance < smsEstimate.cost
                  ? 'animate-pulse bg-red-100 text-red-700'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              Est. SMS Cost: {smsEstimate.cost} credits
              {smsSettings?.sms_balance < smsEstimate.cost && ' (Insufficient Balance!)'}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={exportAttendancePdf}
              disabled={exportingPdf || !selectedClass || !selectedSection || !students.length}
              title={
                !selectedClass || !selectedSection
                  ? 'Select class and section to export'
                  : !students.length
                    ? 'No students to export'
                    : 'Export monthly attendance sheet as PDF'
              }
              aria-label="Export attendance sheet as PDF"
              className="border-border bg-card text-foreground hover:bg-muted min-w-[9.5rem] border shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {exportingPdf ? (
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {exportingPdf ? 'Exporting…' : 'Export PDF'}
            </Button>
            <Button
              type="button"
              onClick={saveAndSendAttendance}
              disabled={
                saveAndSendMutation.isPending ||
                !selectedClass ||
                !selectedSection ||
                !(
                  selectedMonth === currentDate.getMonth() &&
                  selectedYear === currentDate.getFullYear()
                ) ||
                !students.length
              }
              className="min-w-[9.5rem] shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:scale-[1.02] active:scale-[0.98]"
            >
              {saveAndSendMutation.isPending ? (
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {saveAndSendMutation.isPending ? 'Saving & Sending…' : 'Save & Send SMS'}
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground/70 flex items-center gap-2 text-sm font-semibold">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Today&apos;s Attendance Overview
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatsCard
            label="Total Students"
            value={realtimeStats.total}
            color="indigo"
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Present"
            value={realtimeStats.present}
            color="emerald"
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Absent"
            value={realtimeStats.absent}
            color="red"
            icon={<XCircle className="h-5 w-5" aria-hidden="true" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Run Away"
            value={realtimeStats.runAwayed}
            color="amber"
            icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="SMS Success"
            value={statsToDisplay?.sms?.successful || 0}
            color="blue"
            icon={<RefreshCcw className="h-5 w-5" aria-hidden="true" />}
            loading={false}
          />
          <StatsCard
            label="SMS Failed"
            value={statsToDisplay?.sms?.failed || 0}
            color="amber"
            icon={<Filter className="h-5 w-5" aria-hidden="true" />}
            loading={false}
          />
          <StatsCard
            label="Pending SMS"
            value={statsToDisplay?.sms?.pending || 0}
            color="violet"
            icon={<Clock className="h-5 w-5" aria-hidden="true" />}
            loading={false}
          />
        </div>
      </div>

      <SectionCard title="Search & Filters" icon={<Filter className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="attendance-month" className="text-sm font-medium">
              Month
            </label>
            <select
              id="attendance-month"
              name="month"
              autoComplete="off"
              className="border-input bg-background focus-visible:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
            >
              {months.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="attendance-year" className="text-sm font-medium">
              Year
            </label>
            <select
              id="attendance-year"
              name="year"
              autoComplete="off"
              className="border-input bg-background focus-visible:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
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

          <div className="space-y-2">
            <label htmlFor="attendance-class" className="text-sm font-medium">
              Class
            </label>
            <select
              id="attendance-class"
              name="class"
              autoComplete="off"
              className="border-input bg-background focus-visible:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
              value={selectedClass}
              onChange={(e) => {
                handleClassChange(e.target.value ? parseInt(e.target.value) : '');
              }}
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="attendance-section" className="text-sm font-medium">
              Section
            </label>
            <select
              id="attendance-section"
              name="section"
              autoComplete="off"
              className="border-input bg-background focus-visible:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
              value={selectedSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={!selectedClass}
            >
              <option value="">Select Section</option>
              {sections.map((s: string) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <label className="text-foreground/80 flex items-center gap-2 text-sm font-semibold">
              <CalendarIcon className="text-primary h-4 w-4" />
              Toggle Visible Days
            </label>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllDays}
                className="h-8 flex-1 text-xs sm:flex-none"
              >
                <Eye className="mr-1.5 h-3 w-3" />
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetVisibleDays}
                className="h-8 flex-1 text-xs sm:flex-none"
              >
                <EyeOff className="mr-1.5 h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
          <div className="max-w-full overflow-hidden">
            <div className="bg-muted/30 border-border/50 scrollbar-thumb-primary/20 flex scrollbar-thin scrollbar-track-transparent flex-nowrap gap-1.5 overflow-x-auto rounded-lg border p-3">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleVisibleDay(day)}
                  aria-label={`Toggle day ${day}`}
                  aria-pressed={visibleDays.includes(day)}
                  className={`focus-visible:ring-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-[color,background-color,border-color,box-shadow,opacity,transform] focus-visible:ring-2 focus-visible:outline-none ${
                    visibleDays.includes(day)
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-input hover:border-primary/50'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={
          selectedClass ? `Attendance: Class ${selectedClass} ${selectedSection}` : 'Student List'
        }
        icon={<Users className="text-primary h-5 w-5" />}
        noPadding
      >
        <div className="border-border bg-muted/20 text-muted-foreground flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-xs">
          <span className="text-foreground/70 font-semibold">Legend</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Present
          </span>
          <span className="inline-flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
            Absent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span className="font-bold text-amber-600">R</span> Run Away
          </span>
          <span className="text-muted-foreground/80 inline-flex items-center gap-1.5">
            <span className="w-3.5 text-center">—</span> Not marked
          </span>
        </div>
        <div className="min-h-[400px] overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-border border-b">
                <th className="text-muted-foreground bg-background border-border/50 sticky left-0 z-20 max-w-[64px] min-w-[64px] border-r px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Sec
                </th>
                <th
                  className="text-muted-foreground bg-background border-border/50 sticky left-0 z-20 max-w-[64px] min-w-[64px] border-r px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                  style={{ left: '64px' }}
                >
                  Roll
                </th>
                {visibleDays.map((day) => (
                  <th
                    key={day}
                    className="text-muted-foreground min-w-[60px] px-2 py-3 text-center text-xs font-semibold tracking-wider uppercase tabular-nums"
                  >
                    {day}
                  </th>
                ))}
                <th
                  className="text-muted-foreground bg-background border-border/50 sticky left-0 z-20 min-w-[150px] border-l px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:min-w-[200px]"
                  style={{ left: '128px' }}
                >
                  Student Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {studentsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="bg-background sticky left-0 z-10 max-w-[64px] min-w-[64px] px-4 py-3">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td
                      className="bg-background sticky left-0 z-10 max-w-[64px] min-w-[64px] px-4 py-3"
                      style={{ left: '64px' }}
                    >
                      <Skeleton className="h-4 w-8" />
                    </td>
                    {visibleDays.map((d) => (
                      <td key={d} className="px-2 py-3">
                        <Skeleton className="mx-auto h-4 w-4" />
                      </td>
                    ))}
                    <td
                      className="bg-background sticky left-0 z-10 min-w-[150px] px-4 py-3 sm:min-w-[200px]"
                      style={{ left: '128px' }}
                    >
                      <Skeleton className="ml-auto h-4 w-40" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleDays.length + 3}
                    className="text-muted-foreground px-4 py-12 text-center"
                  >
                    No students found. Please select a class and section.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-muted/30 transition-colors ${!student.available ? 'bg-muted/20 opacity-60' : ''}`}
                  >
                    <td className="bg-background border-border/50 sticky left-0 z-10 max-w-[64px] min-w-[64px] border-r px-4 py-3 text-sm font-medium">
                      {student.section}
                    </td>
                    <td
                      className="text-muted-foreground bg-background border-border/50 sticky left-0 z-10 max-w-[64px] min-w-[64px] border-r px-4 py-3 text-sm"
                      style={{ left: '64px' }}
                    >
                      {student.roll}
                    </td>
                    {visibleDays.map((day) => {
                      const isToday =
                        day === currentDate.getDate() &&
                        selectedMonth === currentDate.getMonth() &&
                        selectedYear === currentDate.getFullYear();
                      const recorded = getRecordedStatus(student.id, day);
                      const status = recorded || 'absent';
                      return (
                        <td key={day} className="px-2 py-3 text-center">
                          {isToday && recorded !== 'run-awayed' ? (
                            <input
                              type="checkbox"
                              checked={status === 'present'}
                              disabled={!student.available}
                              aria-label={`Mark ${student.name} present on day ${day}`}
                              onChange={(e) =>
                                handleAttendanceChange(student.id, day, e.target.checked)
                              }
                              className="text-primary focus:ring-primary h-5 w-5 cursor-pointer rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          ) : recorded === 'present' ? (
                            <div className="flex items-center justify-center" title="Present">
                              <CheckCircle2
                                className="h-4 w-4 text-emerald-500"
                                aria-hidden="true"
                              />
                            </div>
                          ) : recorded === 'run-awayed' ? (
                            <div
                              className="flex items-center justify-center"
                              title="Run Away"
                              aria-label={`${student.name} run away on day ${day}`}
                            >
                              <AlertTriangle
                                className="h-4 w-4 stroke-[2.75] text-amber-500 drop-shadow-[0_0_3px_rgba(245,158,11,0.55)]"
                                aria-hidden="true"
                              />
                            </div>
                          ) : recorded === 'absent' ? (
                            <div className="flex items-center justify-center" title="Absent">
                              <XCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs" title="Not marked">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="bg-background border-border/50 sticky left-0 z-10 min-w-[150px] border-l px-4 py-3 text-left text-sm font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] sm:min-w-[200px]"
                      style={{ left: '128px' }}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span>{student.name}</span>
                        {!student.available && (
                          <span className="rounded border border-red-100 bg-red-50 px-1 text-[10px] font-bold tracking-tight text-red-500 uppercase">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default Attendance;
