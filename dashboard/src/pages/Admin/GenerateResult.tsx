import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { 
  Download, 
  Search, 
  Users, 
  Calendar, 
  GraduationCap, 
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionCard } from "@/components";
import Loading from "@/components/Loading";
import { motion } from "framer-motion";
import { useStudents } from "@/queries/students.queries";
import { 
  useUpdatePromotionStatus, 
  useGeneratePromotionRoll 
} from "@/queries/promotion.queries";

const GenerateResult = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [classSection, setClassSection] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  // React Queries & Mutations
  const { data: studentsResponse, isLoading: studentsLoading, error: studentsError } = useStudents({
    year,
    page: 1,
    limit: 1000, // Fetch all for result generation
    level: selectedClass ? Number(selectedClass) : undefined,
    section: classSection || undefined,
  });

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdatePromotionStatus();
  const { mutate: generateRoll, isPending: isGeneratingRoll } = useGeneratePromotionRoll();

  const students = studentsResponse?.data || [];
  const loading = studentsLoading || isUpdatingStatus || isGeneratingRoll;

  useEffect(() => {
    const storedYear = sessionStorage.getItem("generateResultYear");
    const storedClass = sessionStorage.getItem("generateResultClass");
    const storedSection = sessionStorage.getItem("generateResultSection");
    const storedGroup = sessionStorage.getItem("generateResultGroup");

    if (storedYear) setYear(Number(storedYear));
    if (storedClass) setSelectedClass(storedClass);
    if (storedSection) setClassSection(storedSection);
    if (storedGroup) setGroup(storedGroup);
  }, []);

  const handleYearChange = (value: string) => {
    setYear(Number(value));
    sessionStorage.setItem("generateResultYear", value);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setGroup("");
    setClassSection("");
    sessionStorage.setItem("generateResultClass", value);
  };

  const handleSectionChange = (value: string) => {
    setClassSection(value);
    sessionStorage.setItem("generateResultSection", value);
  };

  const handleGroupChange = (value: string) => {
    setGroup(value);
    sessionStorage.setItem("generateResultGroup", value);
  };

  const handleGenerateResult = () => {
    updateStatus(year);
  };

  const handleGenerateRoll = () => {
    if (!confirm("Are you sure you want to generate roll? This action will overwrite existing roll numbers and cannot be undone.")) return;
    generateRoll(year);
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => !group || s.group === group)
      .sort((a, b) => (a.section || "").localeCompare(b.section || "") || (a.roll || 0) - (b.roll || 0));
  }, [students, group]);

  const downloadSessionMarksheet = async (studentId: string) => {
    try {
      const response = await axios.get(
        `/api/marks/${studentId}/${year}/download`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to download session marksheet");
    }
  };

  const downloadAllMarksheetPDF = async () => {
    try {
      const response = await axios.get(`/api/marks/all/${year}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to download all marksheets");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      <PageHeader 
        title="Generate & Manage Results" 
        description="Automate merit ranking, generate promotional status, and download student marksheets."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Merit & Progress"
          icon={<Trophy className="w-5 h-5 text-amber-500" />}
          description="Calculate merit positions and generate promotional status (Pass/Fail) for the current year."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="w-3 h-3" /> Select Academic Year
              </Label>
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={currentYear - i}>
                    {currentYear - i}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateResult}
              disabled={isUpdatingStatus}
              className="w-full h-11 font-bold shadow-sm transition-all hover:shadow-md"
            >
              {isUpdatingStatus ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Generate Pass/Fail Status
            </Button>
            <p className="text-[11px] text-muted-foreground italic text-center px-4">
              Tip: Generate status first, then refine manually in "Customize Result" if needed.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Annual Promotion"
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          description="Finalize transitions by generating new roll numbers for the next academic year."
        >
          <div className="space-y-4">
             <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="w-3 h-3" /> Select Promotion Year
              </Label>
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={currentYear - i}>
                    {currentYear - i}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateRoll}
              disabled={isGeneratingRoll}
              variant="secondary"
              className="w-full h-11 font-bold shadow-sm transition-all hover:shadow-md border border-border"
            >
              {isGeneratingRoll ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Generate Next Year Rolls
            </Button>
            <p className="text-[11px] text-destructive/80 font-medium text-center px-4">
               Warning: This will overwrite existing roll numbers for the next year.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Data Filters"
        icon={<Search className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="w-3 h-3" /> Year
            </Label>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={currentYear - i}>
                  {currentYear - i}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="w-3 h-3" /> Class
            </Label>
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
            >
              <option value="">All Classes</option>
              {[6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="w-3 h-3" /> Section
            </Label>
            <select
              value={classSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900 disabled:opacity-50"
              disabled={!selectedClass}
            >
              <option value="">All Sections</option>
              {["A", "B", "C", "D"].map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="w-3 h-3" /> Group
            </Label>
            <select
              value={group}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900 disabled:opacity-50"
              disabled={Number(selectedClass) < 9}
            >
              <option value="">All Groups</option>
              {["Science", "Humanities", "Commerce"].map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        noPadding 
        title="Student Merit List"
        icon={<FileSpreadsheet className="w-5 h-5 text-primary" />}
        description={studentsError ? "Failed to load students" : `Showing ${filteredStudents.length} records`}
        headerAction={
          filteredStudents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadAllMarksheetPDF}
              className="h-8 px-3 gap-1.5 font-medium border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-none"
            >
              <Download className="w-3.5 h-3.5" />
              Download All PDFs
            </Button>
          )
        }
      >
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border shadow-sm">
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic w-16 text-center">Merit</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic">Student Name</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic text-center w-20">Roll</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic text-center w-24">Section</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic text-center w-24 bg-primary/5">Next Roll</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic text-center w-28 bg-primary/5">Next Sec</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-muted-foreground italic">
                    {studentsError ? "An error occurred while fetching students." : "No students matching your filters found."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <motion.tr 
                    key={student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                    className="hover:bg-muted/30 transition-all group"
                  >
                    <td className="px-6 py-4 text-center border-r border-border/50">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${
                        student.final_merit === 1 ? 'bg-amber-500 text-white' : 
                        student.final_merit === 2 ? 'bg-zinc-400 text-white' : 
                        student.final_merit === 3 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {student.final_merit || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors border-r border-border/50 uppercase">
                      {student.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums border-r border-border/50">{student.roll || "N/A"}</td>
                    <td className="px-6 py-4 text-center font-medium border-r border-border/50">{student.section || "N/A"}</td>
                    <td className="px-6 py-4 text-center font-bold text-primary bg-primary/5 border-r border-border/50 tabular-nums">
                      {student.next_year_roll || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-primary bg-primary/5 border-r border-border/50">
                      {student.next_year_section || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 gap-1.5 font-medium border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-none"
                          onClick={() => downloadSessionMarksheet(student.id)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Session PDF
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

export default GenerateResult;
