import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import {
  useAttendance,
  useAttendanceOverview,
  useAddAttendance,
  useSmsSettings,
  useSendAttendanceSms,
} from "@/queries/attendence.queries.js";
import useNavigationStore from "@/store/navigation.Store";
import PageHeader from "@/components/PageHeader.js";
import SectionCard from "@/components/SectionCard.js";
import StatsCard from "@/components/StatsCard.js";
import {
  Users,
  CheckCircle2,
  Filter,
  Save,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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

// Memoized row component to prevent unnecessary re-renders
const StudentRow = memo(({ 
  student, 
  persistedStatus, 
  currentStatus, 
  onToggle 
}: { 
  student: StudentOverview; 
  persistedStatus: string; 
  currentStatus: string; 
  onToggle: (id: number, checked: boolean) => void;
}) => {
  const isRunAwayed = currentStatus === "run-awayed";
  const isAbsent = persistedStatus === "absent";

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${isRunAwayed ? "bg-amber-50/30" : ""} ${isAbsent ? "opacity-40 grayscale-[0.5]" : ""}`}>
      <td className="px-6 py-4 text-sm font-medium">{student.roll}</td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-center">
          <Checkbox 
            id={`run-away-${student.id}`} 
            checked={isRunAwayed} 
            onCheckedChange={(checked) => !isAbsent && onToggle(student.id, !!checked)}
            disabled={isAbsent}
            className={`h-5 w-5 border-2 transition-all ${isAbsent ? "border-muted opacity-50" : isRunAwayed ? "bg-amber-500 border-amber-600 scale-110 shadow-md" : "border-slate-400 bg-white hover:border-amber-500 hover:scale-110 shadow-sm"}`}
          />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col text-left">
          <span className="text-sm font-semibold">{student.name}</span>
          <div className="flex items-center gap-2">
            {isAbsent && <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0 rounded font-bold uppercase tracking-tight">Initially Absent</span>}
          </div>
        </div>
      </td>
    </tr>
  );
});

StudentRow.displayName = "StudentRow";

function StayCheck() {
  const currentDate = new Date();
  const [selectedClass, setSelectedClass] = useState<number | "">("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [localAttendance, setLocalAttendance] = useState<Record<string, "present" | "absent" | "run-awayed">>({});
  const { setDirty, resetDirty } = useNavigationStore();
  const { data: smsSettings } = useSmsSettings(selectedSection);

  const todayDay = currentDate.getDate();
  const selectedMonth = currentDate.getMonth();
  const selectedYear = currentDate.getFullYear();

  const todayIso = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

  const { data: attendanceRecords, isLoading: recordsLoading } = useAttendance({
    month: selectedMonth,
    year: selectedYear,
    level: selectedClass === "" ? undefined : selectedClass,
    section: selectedSection || undefined,
  });

  const { data: studentsData, isLoading: studentsLoading } = useAttendanceOverview({
    year: selectedYear,
    level: selectedClass === "" ? undefined : selectedClass,
    section: selectedSection || undefined,
  });

  const addAttendanceMutation = useAddAttendance();
  const sendSmsMutation = useSendAttendanceSms();
  const students = (studentsData?.data || []) as StudentOverview[];

  const { attendanceMap, sentMap } = useMemo(() => {
    const aMap: Record<string, "present" | "absent" | "run-awayed"> = {};
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

  const getStatus = useCallback((studentId: number) => {
    return localAttendance[studentId] || attendanceMap[studentId] || "absent";
  }, [localAttendance, attendanceMap]);

  const handleToggleRunAway = useCallback((studentId: number, isChecked: boolean) => {
    const newStatus = isChecked ? "run-awayed" : "present";
    setLocalAttendance((prev) => {
      const currentPersistedStatus = attendanceMap[studentId] || "present";
      if (newStatus === currentPersistedStatus) {
        const { [studentId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [studentId]: newStatus };
    });
  }, [attendanceMap]);

  useEffect(() => {
    const hasUnsavedChanges = Object.keys(localAttendance).length > 0;
    setDirty(hasUnsavedChanges);
    return () => resetDirty();
  }, [localAttendance, setDirty, resetDirty]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let runAwayed = 0;

    students.forEach((s) => {
      const status = getStatus(s.id);
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "run-awayed") runAwayed++;
    });

    return { present, absent, runAwayed, total: students.length };
  }, [students, getStatus]);

  const initiallyPresentCount = useMemo(() => {
    return students.filter(s => attendanceMap[s.id] === "present" || attendanceMap[s.id] === "run-awayed").length;
  }, [students, attendanceMap]);

  const smsEstimateCsv = useMemo(() => {
    if (!smsSettings || !smsSettings.is_active || students.length === 0) return 0;
    let segments = 0;
    students.forEach(s => {
      const status = getStatus(s.id);
      const alreadySent = sentMap[s.id];
      if (alreadySent || !s.available) return;

      if (status === "run-awayed" && smsSettings.send_to_run_awayed) {
        const template = smsSettings.run_awayed_template;
        const formattedDisplayDate = todayIso.split("-").reverse().join("/");
        const message = template
          .replace(/{student_name}/g, s.name)
          .replace(/{login_id}/g, s.login_id?.toString() || "")
          .replace(/{date}/g, formattedDisplayDate)
          .replace(/{school_name}/g, "School");
        segments += calculateSMSCount(message).count;
      }
    });
    return segments;
  }, [smsSettings, students, getStatus, sentMap, todayIso]);

  const saveStayCheck = async () => {
    if (!selectedClass || !selectedSection) {
      toast.error("Please select both class and section");
      return;
    }

    const recordsToSave = students.map((s) => ({
      studentId: s.id,
      date: todayIso,
      status: getStatus(s.id),
    }));

    addAttendanceMutation.mutate(recordsToSave, {
      onSuccess: () => {
        setLocalAttendance({});
        resetDirty();
        toast.success("Stay check updated successfully");
      },
    });
  };

  const handleSendSms = () => {
    if (!selectedClass || !selectedSection) return;
    sendSmsMutation.mutate({
      date: todayIso,
      level: selectedClass as number,
      section: selectedSection,
      year: selectedYear,
    });
  };

  const classes = [6, 7, 8, 9, 10];
  const sections = ["A", "B"];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
      <PageHeader
        title="Stay Check (Run Awayed)"
        description="Daily monitoring for student departures. Check the box if a student has left without permission."
      >
        <div className="flex flex-col items-end gap-2">
          {smsEstimateCsv > 0 && (
            <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${smsSettings?.sms_balance < smsEstimateCsv ? "bg-red-100 text-red-700 animate-pulse" : "bg-primary/10 text-primary"}`}>
              Est. Run Awayed SMS Cost: {smsEstimateCsv} credits
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSendSms} disabled={sendSmsMutation.isPending || !selectedClass || stats.runAwayed === 0}>
              <Send className="w-4 h-4 mr-2" />
              Notify Parents
            </Button>
            <Button onClick={saveStayCheck} disabled={addAttendanceMutation.isPending || !selectedClass}>
              <Save className="w-4 h-4 mr-2" />
              Save Record
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          label="Initially Present" 
          value={initiallyPresentCount} 
          icon={<Users className="w-5 h-5" />} 
          color="indigo" 
          loading={studentsLoading} 
        />
        <StatsCard label="Still Here" value={stats.present} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" loading={studentsLoading} />
        <StatsCard label="Run Awayed" value={stats.runAwayed} icon={<AlertTriangle className="w-5 h-5" />} color="amber" loading={studentsLoading} />
      </div>

      <SectionCard title="Filter Selection" icon={<Filter className="w-5 h-5" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Class</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary shadow-sm"
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value ? parseInt(e.target.value) : ""); setLocalAttendance({}); }}
            >
              <option value="">Select Class</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Section</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary shadow-sm"
              value={selectedSection}
              onChange={(e) => { setSelectedSection(e.target.value); setLocalAttendance({}); }}
              disabled={!selectedClass}
            >
              <option value="">Select Section</option>
              {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Stay Check List" 
        description="Select the checkbox if a student has run away. Students marked absent in the morning are disabled."
        noPadding
      >
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[80px]">Roll</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Run Awayed?</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(studentsLoading || recordsLoading) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={3} className="px-6 py-4"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : students.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground italic">No students found or filters not applied.</td></tr>
              ) : students.map((s) => (
                <StudentRow 
                  key={s.id}
                  student={s}
                  persistedStatus={attendanceMap[s.id] || "absent"}
                  currentStatus={getStatus(s.id)}
                  onToggle={handleToggleRunAway}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default StayCheck;
