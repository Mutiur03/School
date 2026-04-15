import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/useAuth";
import { toast } from "react-hot-toast";
import axios from "axios";
import Loading from "@/components/Loading";
import { PageHeader, SectionCard } from "@/components";
import { 
  Search, 
  Download, 
  Info, 
  Calendar, 
  GraduationCap, 
  Users, 
  Layers, 
  FileSpreadsheet,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useExams } from "@/queries/exam.queries";
import { useClassMarks, type StudentMarkResponse } from "@/queries/marks.queries";

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

const ViewMarks = () => {
  const { user } = useAuth();
  const [className, setClassName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [exam, setExam] = useState("");
  const [section, setSection] = useState("");
  const [group, setGroup] = useState("");
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentMarkResponse | null>(null);

  // Queries
  const { data: exams = [], isLoading: examsLoading } = useExams();
  const { data: marksData = [], isLoading: marksLoading } = useClassMarks(className, Number(year), exam);

  // Derived data from exams
  const { examList, classList } = useMemo(() => {
    const currentYearExams = exams.filter((e) => e.exam_year === Number(year));
    return {
      examList: Array.from(new Set(currentYearExams.map((e) => e.exam_name))),
      classList: currentYearExams.reduce((acc: Record<string, number[]>, e) => {
        acc[e.exam_name] = e.levels || [];
        return acc;
      }, {})
    };
  }, [exams, year]);

  // Derived filter options from marks data
  const { subjects, availableSections, availableGroups } = useMemo(() => {
    const allSubjects = new Set<string>();
    const sections = new Set<string>();
    const groups = new Set<string>();

    marksData.forEach((student) => {
      student.marks
        ?.filter((subject) => subject.marks !== null)
        .forEach((subject) => {
          allSubjects.add(subject.subject);
        });
      if (student.section) sections.add(student.section);
      if (student.group) groups.add(student.group);
    });

    return {
      subjects: Array.from(allSubjects).sort(),
      availableSections: Array.from(sections).sort(),
      availableGroups: Array.from(groups).sort()
    };
  }, [marksData]);

  // Handle teacher assignments
  useEffect(() => {
    if (user?.role === "teacher" && (user as UserWithLevels).levels && ((user as UserWithLevels).levels?.length ?? 0) > 0) {
      const assignmentsInYear = (user as UserWithLevels).levels?.filter(
        (l: TeacherLevel) => l.year === Number(year)
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
    setClassName("");
    setSection("");
    setGroup("");
  };

  const handleClassChange = (selectedClass: string) => {
    setClassName(selectedClass);
    setSection("");
    setGroup("");
  };

  const downloadMarksheet = async (id: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const loadingToast = toast.loading("Generating transcript...");
    
    // Create new window immediately to bypass popup blockers
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write("Loading marksheet... If this takes too long, please check for errors.");
    }

    try {
      const response = await axios.get(
        `/api/marks/${id}/${year}/${exam}/download`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback to direct window.open if initial window was null
        window.open(url, "_blank");
      }

      toast.dismiss(loadingToast);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {
      toast.dismiss(loadingToast);
      if (newWindow) newWindow.close();
      toast.error("Failed to download marksheet");
    }
  };

  const downloadAllExamPDFs = async () => {
    if (!className || !year || !exam) {
      toast.error("Please select Class, Year and Exam");
      return;
    }
    const loadingToast = toast.loading("Generating bulk PDFs...");
    
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write("Generating all student marksheets... Please wait.");
    }

    try {
      const response = await axios.get(
        `/api/marks/class-exam/${className}/${year}/${exam}/download`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      
      toast.dismiss(loadingToast);
      toast.success("PDFs generated successfully");
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {
      toast.dismiss(loadingToast);
      if (newWindow) newWindow.close();
      toast.error("Failed to download all exam marksheets");
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

  const filteredData = marksData.filter((student) => {
    if (!student.marks || student.marks.length === 0) return false;
    const hasAnyMarks = student.marks.some(
      (m) => m.marks !== null && m.marks !== undefined
    );
    if (!hasAnyMarks) return false;
    const sectionMatch = !section || (student.section || "") === section;
    const groupMatch = !group || (student.group || "") === group;
    return sectionMatch && groupMatch;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader 
        title="Class Results" 
        description={className ? `Viewing marks for Class ${className}, ${exam} (${year})` : "Analyze and manage student academic performance."}
      />

      <SectionCard
        title="Filter Results"
        icon={<Search className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="w-3 h-3" /> Year
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
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
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileSpreadsheet className="w-3 h-3" /> Exam
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900"
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
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="w-3 h-3" /> Class
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900 disabled:opacity-50"
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!exam}
            >
              <option value="">Select Class</option>
              {(classList[exam] || [])
                .filter((cls) => {
                  if (user?.role === "admin") return true;
                  if (user?.role === "teacher" && (user as UserWithLevels).levels) {
                    return (user as UserWithLevels).levels?.some(
                      (l: TeacherLevel) => l.class_name === Number(cls) && l.year === Number(year)
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
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="w-3 h-3" /> Section
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900 disabled:opacity-50"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={!className || availableSections.length === 0}
            >
              <option value="">All Sections</option>
              {availableSections
                .filter((sec) => {
                  if (user?.role === "admin") return true;
                  if (user?.role === "teacher" && (user as UserWithLevels).levels) {
                    return (user as UserWithLevels).levels?.some(
                      (l: TeacherLevel) =>
                        l.class_name === Number(className) &&
                        l.section === sec &&
                        l.year === Number(year)
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
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="w-3 h-3" /> Group
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:bg-zinc-900 disabled:opacity-50"
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

      <SectionCard 
        noPadding 
        title="Student Marks"
        icon={<FileSpreadsheet className="w-5 h-5 text-primary" />}
        description={`Showing ${filteredData.length} records`}
        headerAction={
          className && exam && filteredData.length > 0 && (
            <Button
              size="sm"
              onClick={downloadAllExamPDFs}
              className="bg-primary text-white hover:bg-primary/90 gap-2 h-9 px-4 transition-all"
            >
              <Download className="w-4 h-4" />
              Download All Exam PDFs
            </Button>
          )
        }
      >
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/50 border-b border-border shadow-sm">
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic w-20 text-center">Roll</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100 italic min-w-[200px]">Student Name</th>
                {subjects.map((subject) => (
                  <th
                    key={subject}
                    className="px-4 py-4 text-center font-semibold text-gray-900 dark:text-gray-100 italic min-w-[100px]"
                  >
                    {subject}
                  </th>
                ))}
                <th className="px-6 py-4 text-center font-bold text-gray-900 dark:text-gray-100 italic">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {marksLoading ? (
                <tr>
                  <td colSpan={subjects.length + 3} className="py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loading />
                      <p className="text-muted-foreground animate-pulse font-medium">Loading results...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={subjects.length + 3}
                    className="py-20 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <Search className="w-10 h-10 mb-2" />
                      <p className="text-lg font-medium">
                        {className && exam
                          ? examsLoading ? "Refreshing exams..." : "No marks found matching these filters."
                          : "Please select Class and Exam to view results."}
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
                    <motion.tr 
                      key={data.student_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-muted/30 transition-all group"
                    >
                      <td className="px-6 py-4 text-center font-medium tabular-nums border-r border-border/50">{data.roll}</td>
                      <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors uppercase border-r border-border/50">
                        {data.name}
                      </td>
                      {subjects.map((subject) => (
                        <td
                          key={`${data.student_id}-${subject}`}
                          className="px-4 py-4 text-center tabular-nums font-medium"
                        >
                          {marksMap[subject] ?? "-"}
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white border-green-500/20 shadow-none h-8 px-3 gap-1.5 transition-all"
                            onClick={() => showStudentDetails(data)}
                          >
                            <Info className="w-3.5 h-3.5" />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-primary/20 shadow-none h-8 px-3 gap-1.5 transition-all"
                            onClick={(e) => downloadMarksheet(data.student_id, e)}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Exam PDF
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <AnimatePresence>
        {showDetailsPopup && selectedStudent && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-100 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b flex justify-between items-center bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      Detailed Marks
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                      {selectedStudent.name} | Roll: {selectedStudent.roll}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDetailsPopup}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary mb-4">
                    <Info className="w-4 h-4" /> Student Snapshot
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: "Class", value: selectedStudent.class, icon: GraduationCap },
                      { label: "Roll", value: selectedStudent.roll, icon: Users },
                      { label: "Section", value: selectedStudent.section || "N/A", icon: Layers },
                      { label: "Group", value: selectedStudent.group || "N/A", icon: Info },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-muted-foreground/70">{item.label}</p>
                          <p className="font-bold text-sm tracking-tight">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary mb-4">
                    <FileSpreadsheet className="w-4 h-4" /> Performance Metrics
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          {(() => {
                            const showBreakdown = selectedStudent.marks?.some(
                              (mark) => mark.subject_info?.marking_scheme === "BREAKDOWN"
                            );
                            return (
                              <tr className="bg-muted/50 border-b border-border">
                                <th className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 italic">Subject</th>
                                {showBreakdown && (
                                  <>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">CQ</th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">MCQ</th>
                                    <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">PRC</th>
                                  </>
                                )}
                                <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Total</th>
                                {/* <th className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Status</th> */}
                              </tr>
                            );
                          })()}
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Array.isArray(selectedStudent.marks) && selectedStudent.marks.length > 0 ? (
                            (() => {
                              const showBreakdownTable = selectedStudent.marks?.some(
                                (mark) => mark.subject_info?.marking_scheme === "BREAKDOWN"
                              );
                              return selectedStudent.marks
                                .filter((mark) => mark.marks !== null)
                                .map((mark, index) => {
                                // const percentage = mark.subject_info?.full_mark && mark.marks !== null
                                //   ? (mark.marks / mark.subject_info.full_mark) * 100
                                //   : 0;

                                return (
                                  <tr
                                    key={index}
                                    className="hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="px-4 py-3 font-bold uppercase text-xs tracking-tight">
                                      {mark.subject}
                                    </td>
                                    {showBreakdownTable && (
                                      <>
                                        <td className="px-4 py-3 text-center tabular-nums font-medium">
                                          {mark.subject_info?.marking_scheme === "BREAKDOWN" ? (mark.cq_marks ?? "-") : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-center tabular-nums font-medium">
                                          {mark.subject_info?.marking_scheme === "BREAKDOWN" ? (mark.mcq_marks ?? "-") : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-center tabular-nums font-medium">
                                          {mark.subject_info?.marking_scheme === "BREAKDOWN" ? (mark.practical_marks ?? "-") : "-"}
                                        </td>
                                      </>
                                    )}
                                    <td className="px-4 py-3 text-center tabular-nums font-bold text-primary">
                                      {mark.marks ?? "-"}
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
                              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground opacity-50 italic">
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

              <div className="p-6 bg-muted/10 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={closeDetailsPopup}>
                  Close
                </Button>
                <Button onClick={(e) => {
                  downloadMarksheet(selectedStudent.student_id, e);
                  closeDetailsPopup();
                }} className="gap-2">
                  <Download className="w-4 h-4" /> Download Official Transcript
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

