import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import {
  useAttendance,
  useAttendanceOverview,
  useAddAttendance,
  useAttendanceStats,
  useSmsSettings,
  useSendAttendanceSms,
} from "@/queries/attendence.queries.js";
import useNavigationStore from "@/store/navigation.Store";
import PageHeader from "@/components/PageHeader.js";
import SectionCard from "@/components/SectionCard.js";
import StatsCard from "@/components/StatsCard.js";
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
  Send,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateSMSCount } from "@school/shared-schemas";

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

type AttendanceStatus = "present" | "absent" | "run-awayed";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function Attendance() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedClass, setSelectedClass] = useState<number | "">("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [visibleDays, setVisibleDays] = useState<number[]>([
    currentDate.getDate(),
  ]);
  const [localAttendance, setLocalAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const { setDirty, resetDirty } = useNavigationStore();
  const { data: smsSettings } = useSmsSettings(selectedSection);

  const { data: attendanceRecords } = useAttendance({
    month: selectedMonth,
    year: selectedYear,
    level: selectedClass === "" ? undefined : selectedClass,
    section: selectedSection || undefined,
  });
  const { data: studentsData, isLoading: studentsLoading } =
    useAttendanceOverview({
      year: selectedYear,
      level: selectedClass === "" ? undefined : selectedClass,
      section: selectedSection || undefined,
    });

  const todayIso = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  const { data: persistentStats } = useAttendanceStats({
    date: todayIso,
    level: selectedClass === "" ? 0 : selectedClass,
    section: selectedSection,
    year: selectedYear,
  });

  const addAttendanceMutation = useAddAttendance();
  const sendSmsMutation = useSendAttendanceSms();
  const statsToDisplay = persistentStats?.data;

  const classes = [6, 7, 8, 9, 10];
  const sections = ["A", "B"];

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  const { attendanceMap, sentMap } = useMemo(() => {
    const aMap: Record<string, AttendanceStatus> = {};
    const sMap: Record<string, boolean> = {};

    if (!attendanceRecords?.data) return { attendanceMap: aMap, sentMap: sMap };

    attendanceRecords.data.forEach((record: any) => {
      if (
        record.date.startsWith(
          `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`,
        )
      ) {
        const day = parseInt(record.date.split("-")[2]);
        const key = `${record.student_id}-${day}`;
        aMap[key] = record.status as AttendanceStatus;
        sMap[key] = !!record.send_msg;
      }
    });
    return { attendanceMap: aMap, sentMap: sMap };
  }, [attendanceRecords, selectedMonth, selectedYear]);

  const students = (studentsData?.data || []) as StudentOverview[];

  const hasTodayRecords = useMemo(() => {
    const todayDay = currentDate.getDate();
    const isToday =
      selectedMonth === currentDate.getMonth() &&
      selectedYear === currentDate.getFullYear();
    if (!isToday || !attendanceRecords?.data) return false;

    return attendanceRecords.data.some((record: any) => {
      return (
        record.date ===
        `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`
      );
    });
  }, [attendanceRecords, currentDate, selectedMonth, selectedYear]);

  const handleAttendanceChange = (
    studentId: number,
    day: number,
    isPresent: boolean,
  ) => {
    const key = `${studentId}-${day}`;
    // From this page, you can only toggle between present and absent.
    // Run Awayed is set from the Stay Check page.
    const nextStatus: AttendanceStatus = isPresent ? "present" : "absent";
    const currentStatus = attendanceMap[key] || "absent";

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

  const getStatus = (studentId: number, day: number) => {
    const key = `${studentId}-${day}`;
    return localAttendance[key] || attendanceMap[key] || "absent";
  };

  const realtimeStats = useMemo(() => {
    const todayDay = currentDate.getDate();
    const isToday =
      selectedMonth === currentDate.getMonth() &&
      selectedYear === currentDate.getFullYear();

    if (!students.length || !isToday) {
      const activePersistentPresent = persistentStats?.data?.present || 0;
      const activePersistentAbsent = persistentStats?.data?.absent || 0;
      const activePersistentRunAwayed = persistentStats?.data?.runAwayed || 0;

      return {
        present: activePersistentPresent,
        absent: activePersistentAbsent,
        runAwayed: activePersistentRunAwayed,
        total:
          activePersistentPresent +
          activePersistentAbsent +
          activePersistentRunAwayed,
      };
    }

    const activeStudents = students.filter((s) => s.available);
    const todayKeys = activeStudents.map((s) => `${s.id}-${todayDay}`);
    const hasAnyData = todayKeys.some(
      (key) => !!attendanceMap[key] || !!localAttendance[key],
    );

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
      if (status === "present") presentCount++;
      else if (status === "run-awayed") runAwayedCount++;
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
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
      selectedMonth === currentDate.getMonth() &&
      selectedYear === currentDate.getFullYear();
    if (!isToday) return { count: 0, cost: 0 };

    const todayIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

    let totalSegments = 0;
    let messagesToSend = 0;

    // Helper for segment calculation (mirroring backend SMSService)
    const calculateSegments = (text: string) => calculateSMSCount(text).count;

    students.forEach((student) => {
      const status = getStatus(student.id, todayDay);
      // Run Awayed SMS are handled by the Stay Check page, but we include them here if we want to preview total cost
      const shouldSend =
        (status === "present" && smsSettings.send_to_present) ||
        (status === "absent" && smsSettings.send_to_absent) ||
        (status === "run-awayed" && smsSettings.send_to_run_awayed);

      const alreadySent = sentMap[`${student.id}-${todayDay}`];
      if (alreadySent || !student.available) return;

      if (shouldSend) {
        let template = "";
        if (status === "present") template = smsSettings.present_template;
        else if (status === "absent") template = smsSettings.absent_template;
        else if (status === "run-awayed")
          template = smsSettings.run_awayed_template;

        if (!template) return;

        const formattedDisplayDate = todayIso.split("-").reverse().join("/");

        // Approximation of interpolated message length
        const message = template
          .replace(/{student_name}/g, student.name)
          .replace(/{login_id}/g, student.login_id?.toString() || "")
          .replace(/{date}/g, formattedDisplayDate) // Date length is fixed
          .replace(/{school_name}/g, "Panchbibi Lal Bihari Govt High School");

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

  const saveAttendance = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error("Please select both class and section");
      return;
    }

    const todayDay = currentDate.getDate();
    const isTodaySelectable =
      selectedMonth === currentDate.getMonth() &&
      selectedYear === currentDate.getFullYear();

    if (!isTodaySelectable) {
      toast.error("Attendance can only be managed for the current date");
      return;
    }

    const recordsToSave: any[] = [];
    students.forEach((student) => {
      const status = getStatus(student.id, todayDay);
      recordsToSave.push({
        studentId: student.id,
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`,
        status,
      });
    });

    addAttendanceMutation.mutate(recordsToSave, {
      onSuccess: () => {
        setLocalAttendance({});
        resetDirty();
      },
    });
  };

  const handleClassChange = (newClass: number | "") => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = window.confirm(
        "You have unsaved changes. Changing the class will discard them. Proceed?",
      );
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedClass(newClass);
    setSelectedSection("");
  };

  const handleSectionChange = (newSection: string) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = window.confirm(
        "You have unsaved changes. Changing the section will discard them. Proceed?",
      );
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedSection(newSection);
  };

  const handleMonthChange = (newMonth: number) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = window.confirm(
        "You have unsaved changes. Changing the month will discard them. Proceed?",
      );
      if (!proceed) return;
    }
    setLocalAttendance({});
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (newYear: number) => {
    if (Object.keys(localAttendance).length > 0) {
      const proceed = window.confirm(
        "You have unsaved changes. Changing the year will discard them. Proceed?",
      );
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

  const handleSendSms = () => {
    if (!selectedClass || !selectedSection || !selectedYear) return;

    const todayDay = currentDate.getDate();
    const date = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

    sendSmsMutation.mutate({
      date,
      level: selectedClass as number,
      section: selectedSection,
      year: selectedYear,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      <PageHeader
        title="Attendance Management"
        description="Monitor and record student attendance across different classes and sections."
      >
        <div className="flex flex-col items-end gap-2">
          {smsEstimate.cost > 0 && (
            <div
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                smsSettings?.sms_balance < smsEstimate.cost
                  ? "bg-red-100 text-red-700 animate-pulse"
                  : "bg-primary/10 text-primary"
              }`}
            >
              Est. SMS Cost: {smsEstimate.cost} credits
              {smsSettings?.sms_balance < smsEstimate.cost &&
                " (Insufficient Balance!)"}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSendSms}
              disabled={
                sendSmsMutation.isPending ||
                !selectedClass ||
                !selectedSection ||
                !(
                  selectedMonth === currentDate.getMonth() &&
                  selectedYear === currentDate.getFullYear()
                ) ||
                !hasTodayRecords
              }
              className="shadow-sm"
            >
              {sendSmsMutation.isPending ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
            </Button>
            <Button
              onClick={saveAttendance}
              disabled={
                addAttendanceMutation.isPending ||
                !selectedClass ||
                !selectedSection ||
                !(
                  selectedMonth === currentDate.getMonth() &&
                  selectedYear === currentDate.getFullYear()
                ) ||
                (hasTodayRecords &&
                  Object.keys(localAttendance).length === 0) ||
                !students.length
              }
              className="shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {addAttendanceMutation.isPending ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {addAttendanceMutation.isPending
                ? "Saving..."
                : "Save Attendance"}
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" />
            Today's Attendance Overview
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatsCard
            label="Total Students"
            value={realtimeStats.total}
            color="indigo"
            icon={<Users className="w-5 h-5" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Present"
            value={realtimeStats.present}
            color="emerald"
            icon={<CheckCircle2 className="w-5 h-5" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Absent"
            value={realtimeStats.absent}
            color="red"
            icon={<XCircle className="w-5 h-5" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="Running Away"
            value={realtimeStats.runAwayed}
            color="amber"
            icon={<AlertTriangle className="w-5 h-5" />}
            loading={studentsLoading}
          />
          <StatsCard
            label="SMS Success"
            value={statsToDisplay?.sms?.successful || 0}
            color="blue"
            icon={<RefreshCcw className="w-5 h-5" />}
            loading={false}
          />
          <StatsCard
            label="SMS Failed"
            value={statsToDisplay?.sms?.failed || 0}
            color="amber"
            icon={<Filter className="w-5 h-5" />}
            loading={false}
          />
          <StatsCard
            label="Pending SMS"
            value={statsToDisplay?.sms?.pending || 0}
            color="violet"
            icon={<Clock className="w-5 h-5" />}
            loading={false}
          />
        </div>
      </div>

      <SectionCard
        title="Search & Filters"
        icon={<Filter className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Month</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            <label className="text-sm font-medium">Year</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            <label className="text-sm font-medium">Class</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedClass}
              onChange={(e) => {
                handleClassChange(
                  e.target.value ? parseInt(e.target.value) : "",
                );
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
            <label className="text-sm font-medium">Section</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Toggle Visible Days
            </label>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllDays}
                className="flex-1 sm:flex-none text-xs h-8"
              >
                <Eye className="w-3 h-3 mr-1.5" />
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetVisibleDays}
                className="flex-1 sm:flex-none text-xs h-8"
              >
                <EyeOff className="w-3 h-3 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>
          <div className="max-w-full overflow-hidden">
            <div className="flex flex-nowrap overflow-x-auto gap-1.5 p-3 bg-muted/30 rounded-lg border border-border/50 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => (
                  <button
                    key={day}
                    onClick={() => toggleVisibleDay(day)}
                    className={`shrink-0 w-8 h-8 flex items-center justify-center text-xs font-medium rounded-md border transition-all ${
                      visibleDays.includes(day)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-input hover:border-primary/50"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={
          selectedClass
            ? `Attendance: Class ${selectedClass} ${selectedSection}`
            : "Student List"
        }
        icon={<Users className="w-5 h-5 text-primary" />}
        noPadding
      >
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-background z-20 min-w-[64px] max-w-[64px] border-r border-border/50">
                  Sec
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-background z-20 min-w-[64px] max-w-[64px] border-r border-border/50"
                  style={{ left: "64px" }}
                >
                  Roll
                </th>
                {visibleDays.map((day) => (
                  <th
                    key={day}
                    className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[60px]"
                  >
                    {day}
                  </th>
                ))}
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-background z-20 min-w-[150px] sm:min-w-[200px] border-l border-border/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]"
                  style={{ left: "128px" }}
                >
                  Student Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 min-w-[64px] max-w-[64px] sticky left-0 bg-background z-10">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td
                      className="px-4 py-3 min-w-[64px] max-w-[64px] sticky left-0 bg-background z-10"
                      style={{ left: "64px" }}
                    >
                      <Skeleton className="h-4 w-8" />
                    </td>
                    {visibleDays.map((d) => (
                      <td key={d} className="px-2 py-3">
                        <Skeleton className="h-4 w-4 mx-auto" />
                      </td>
                    ))}
                    <td
                      className="px-4 py-3 min-w-[150px] sm:min-w-[200px] sticky left-0 bg-background z-10"
                      style={{ left: "128px" }}
                    >
                      <Skeleton className="h-4 w-40 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleDays.length + 3}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No students found. Please select a class and section.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-muted/30 transition-colors ${!student.available ? "opacity-60 bg-muted/20" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium sticky left-0 bg-background z-10 min-w-[64px] max-w-[64px] border-r border-border/50">
                      {student.section}
                    </td>
                    <td
                      className="px-4 py-3 text-sm text-muted-foreground sticky left-0 bg-background z-10 min-w-[64px] max-w-[64px] border-r border-border/50"
                      style={{ left: "64px" }}
                    >
                      {student.roll}
                    </td>
                    {visibleDays.map((day) => {
                      const isToday =
                        day === currentDate.getDate() &&
                        selectedMonth === currentDate.getMonth() &&
                        selectedYear === currentDate.getFullYear();
                      const status = getStatus(student.id, day);
                      return (
                        <td key={day} className="px-2 py-3 text-center">
                          {isToday ? (
                            status === "run-awayed" ? (
                              <div className="flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={status === "present"}
                                disabled={!student.available}
                                onChange={(e) =>
                                  handleAttendanceChange(
                                    student.id,
                                    day,
                                    e.target.checked,
                                  )
                                }
                                className="rounded border-gray-300 text-primary focus:ring-primary h-5 w-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            )
                          ) : (
                            <div className="flex items-center justify-center">
                              {status === "present" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : status === "run-awayed" ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="px-4 py-3 text-sm font-semibold sticky left-0 bg-background z-10 border-l border-border/50 text-left shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] min-w-[150px] sm:min-w-[200px]"
                      style={{ left: "128px" }}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span>{student.name}</span>
                        {!student.available && (
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight bg-red-50 px-1 rounded border border-red-100">
                            Inactive
                          </span>
                        )}
                        {getStatus(student.id, currentDate.getDate()) ===
                          "run-awayed" &&
                          selectedMonth === currentDate.getMonth() &&
                          selectedYear === currentDate.getFullYear() && (
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight bg-amber-50 px-1 rounded border border-amber-100">
                              Running Away
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
