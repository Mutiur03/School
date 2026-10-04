import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import {
  useAttendance,
  useAttendanceOverview,
  useSmsSettings,
  useSaveAndSendAttendance,
} from '@/queries/attendence.queries.js';
import useNavigationStore from '@/store/navigation.Store';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { SectionCard, StatusBadge, filterSelectClassName } from '@/components';
import { Loader2, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { smsCredits, smsDate } from '@/lib/sms';
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

type Status = 'present' | 'absent' | 'run-awayed';

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

function StayCheck() {
  const { confirm, dialog } = useConfirmDialog();
  const currentDate = new Date();
  const [selectedClass, setSelectedClass] = useState<number | ''>(readStoredClass);
  const [selectedSection, setSelectedSection] = useState(() =>
    readStoredClass() ? ATTENDANCE_SECTIONS[0] : '',
  );
  const [localAttendance, setLocalAttendance] = useState<Record<string, Status>>({});
  const { setDirty, resetDirty } = useNavigationStore();
  const { data: smsSettings } = useSmsSettings(selectedSection);

  const todayDay = currentDate.getDate();
  const selectedMonth = currentDate.getMonth();
  const selectedYear = currentDate.getFullYear();
  const todayIso = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

  const { data: attendanceRecords, isLoading: recordsLoading } = useAttendance({
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

  const saveAndSendMutation = useSaveAndSendAttendance();
  const students = useMemo(() => (studentsData?.data || []) as StudentOverview[], [studentsData]);
  const unsavedCount = Object.keys(localAttendance).length;

  const { attendanceMap, sentMap } = useMemo(() => {
    const aMap: Record<string, Status> = {};
    const sMap: Record<string, boolean> = {};

    if (!attendanceRecords?.data) return { attendanceMap: aMap, sentMap: sMap };

    attendanceRecords.data.forEach((record: any) => {
      if (record.date === todayIso) {
        aMap[record.student_id] = record.status;
        sMap[record.student_id] = !!record.send_msg;
      }
    });
    return { attendanceMap: aMap, sentMap: sMap };
  }, [attendanceRecords, todayIso]);

  const morningTaken = students.some((s) => attendanceMap[s.id]);

  const getStatus = useCallback(
    (studentId: number) => {
      return localAttendance[studentId] || attendanceMap[studentId] || 'absent';
    },
    [localAttendance, attendanceMap],
  );

  const handleToggleRunAway = useCallback(
    (studentId: number, isChecked: boolean) => {
      const newStatus = isChecked ? 'run-awayed' : 'present';
      setLocalAttendance((prev) => {
        const currentPersistedStatus = attendanceMap[studentId] || 'present';
        if (newStatus === currentPersistedStatus) {
          const { [studentId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [studentId]: newStatus };
      });
    },
    [attendanceMap],
  );

  // Browser reload/close guard + global "unsaved changes" flag for in-app navigation.
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

  useEffect(() => {
    setDirty(Object.keys(localAttendance).length > 0);
    return () => resetDirty();
  }, [localAttendance, setDirty, resetDirty]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let runAwayed = 0;
    let morningPresent = 0;
    let notMarked = 0;

    students
      .filter((s) => s.available)
      .forEach((s) => {
        // Count only what's actually recorded (or ticked here); no record = not marked, not absent.
        const status = localAttendance[s.id] || attendanceMap[s.id];
        if (!status) notMarked++;
        else if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'run-awayed') runAwayed++;
        if (attendanceMap[s.id] === 'present' || attendanceMap[s.id] === 'run-awayed')
          morningPresent++;
      });

    return { present, absent, runAwayed, morningPresent, notMarked };
  }, [students, localAttendance, attendanceMap]);

  const smsEstimate = useMemo(() => {
    if (!smsSettings || !smsSettings.is_active || students.length === 0) return 0;
    let segments = 0;
    students.forEach((s) => {
      const status = getStatus(s.id);
      const alreadySent = sentMap[s.id];
      if (alreadySent || !s.available || s.has_phone === false) return;

      if (status === 'run-awayed' && smsSettings.send_to_run_awayed) {
        segments += smsCredits(smsSettings.run_awayed_template, {
          student_name: s.name,
          login_id: s.login_id,
          date: smsDate(todayIso),
          class: s.class,
          section: s.section,
          roll: s.roll,
          school_name: smsSettings.school_name,
        });
      }
    });
    return segments;
  }, [smsSettings, students, getStatus, sentMap, todayIso]);

  const lowBalance = smsEstimate > 0 && smsSettings?.sms_balance < smsEstimate;

  const saveAndSendStayCheck = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Please select both class and section');
      return;
    }

    // Only persist rows the user actually changed — avoids mass-overwrite
    // of run-awayed back to present/absent if the map is stale.
    const dirtyIds = Object.keys(localAttendance);
    if (dirtyIds.length === 0) {
      toast.error('No changes to save');
      return;
    }

    const recordsToSave = dirtyIds.map((id) => ({
      studentId: Number(id),
      date: todayIso,
      status: getStatus(Number(id)),
    }));

    saveAndSendMutation.mutate(
      {
        records: recordsToSave,
        date: todayIso,
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
      msg: `You have unsaved changes. Changing the ${what} will discard them.`,
      confirmLabel: 'Discard & continue',
    });
    if (proceed) setLocalAttendance({});
    return proceed;
  };

  const handleClassChange = async (newClass: number | '') => {
    if (!(await okToDiscard('class'))) return;
    setSelectedClass(newClass);
    setSelectedSection(newClass ? ATTENDANCE_SECTIONS[0] : '');
    storeClass(newClass);
  };

  const handleSectionChange = async (newSection: string) => {
    if (await okToDiscard('section')) setSelectedSection(newSection);
  };

  const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');
  const loading = studentsLoading || recordsLoading;

  const saveButton = (
    <Button
      type="button"
      onClick={saveAndSendStayCheck}
      disabled={saveAndSendMutation.isPending || !selectedSection || unsavedCount === 0}
      title={unsavedCount === 0 ? 'Tick a student first' : undefined}
    >
      {saveAndSendMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
      {saveAndSendMutation.isPending ? 'Saving…' : 'Save & send SMS'}
    </Button>
  );

  const smsLine =
    smsEstimate > 0 ? (
      <span
        className={cn(
          'text-xs tabular-nums',
          lowBalance ? 'text-destructive font-medium' : 'text-muted-foreground',
        )}
      >
        ≈ {smsEstimate} SMS credits
        {lowBalance && ` · balance ${smsSettings?.sms_balance} is not enough`}
      </span>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Running away</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Class"
              className={pickerClass}
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value ? parseInt(e.target.value) : '')}
            >
              {!selectedClass && <option value="">Select class</option>}
              {ATTENDANCE_CLASSES.map((c) => (
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
              {ATTENDANCE_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">
              Today, {currentDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {saveButton}
          {unsavedCount === 0 && smsLine}
        </div>
      </header>

      <div className="border-border bg-card mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border px-5 py-4 shadow-sm">
        <Stat label="Present this morning" value={stats.morningPresent} />
        <Stat label="Still here" value={stats.present} dot="bg-emerald-500" />
        <Stat label="Ran away" value={stats.runAwayed} dot="bg-amber-500" />
        <Stat label="Absent" value={stats.absent} dot="bg-red-500" />
        {stats.notMarked > 0 && <Stat label="Not marked yet" value={stats.notMarked} />}
      </div>

      <SectionCard noPadding className="mb-6">
        <div className="border-border border-b px-4 py-3">
          <p className="text-sm font-semibold">
            {selectedClass ? `Class ${selectedClass} ${selectedSection}` : 'No class selected'}
          </p>
          <p className="text-muted-foreground text-sm">
            Tick students who left without permission. Students absent this morning can't be ticked.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider">
                <th className="w-16 px-4 py-2.5">Roll</th>
                <th className="px-4 py-2.5">Student</th>
                <th className="w-28 px-4 py-2.5 text-center">Ran away</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={3} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 || !morningTaken ? (
                <tr>
                  <td colSpan={3} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    {!selectedSection
                      ? 'Pick a class and section.'
                      : students.length === 0
                        ? 'No students in this class.'
                        : "Morning attendance hasn't been saved for this class yet. Take it on the Attendance page first."}
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const ranAway = getStatus(s.id) === 'run-awayed';
                  const absentMorning = (attendanceMap[s.id] || 'absent') === 'absent';
                  const locked = absentMorning || !s.available;
                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        'transition-colors',
                        ranAway
                          ? 'bg-amber-500/10'
                          : 'hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]',
                        locked && 'text-muted-foreground',
                      )}
                    >
                      <td className="px-4 py-2 text-sm tabular-nums">{s.roll}</td>
                      <td className="px-4 py-2">
                        <label
                          htmlFor={`run-away-${s.id}`}
                          className={cn(
                            'flex flex-wrap items-center gap-2',
                            !locked && 'cursor-pointer',
                          )}
                        >
                          <span className="text-sm font-medium">{s.name}</span>
                          {!s.available ? (
                            <StatusBadge status="inactive" />
                          ) : absentMorning ? (
                            <StatusBadge status="rejected" label="Absent this morning" />
                          ) : null}
                        </label>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          id={`run-away-${s.id}`}
                          type="checkbox"
                          checked={ranAway}
                          disabled={locked}
                          onChange={(e) => handleToggleRunAway(s.id, e.target.checked)}
                          aria-label={`${s.name} ran away`}
                          className="h-5 w-5 cursor-pointer align-middle [--cb:var(--color-amber-500)] disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {unsavedCount > 0 && (
        <div
          role="region"
          aria-label="Unsaved changes"
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

export default StayCheck;
