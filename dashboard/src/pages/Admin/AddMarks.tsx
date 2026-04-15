import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/useAuth";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import ErrorMessage from "@/components/ErrorMessage";
import { PageHeader, SectionCard, StatsCard } from "@/components";
import { Button } from "@/components/ui/button";
import { useSubjects } from "@/queries/subject.queries";
import { useExams } from "@/queries/exam.queries";
import { useMarksStudents, useClassMarks, useAddMarksMutation, type Student, type MarksData, type SubjectMark } from "@/queries/marks.queries";
import StudentMarkRow from "./components/StudentMarkRow";

interface FormValues {
  year: number;
  examName: string;
  level: string;
  group: string;
  section: string;
  specific: number;
}

const AddMarks = () => {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      year: new Date().getFullYear(),
      examName: "",
      level: "",
      group: "",
      section: "",
      specific: 0,
    },
  });

  const EMPTY_ARRAY = useRef<never[]>([]).current;

  const { data: subjects = EMPTY_ARRAY, isLoading: isLoadingSubjects } = useSubjects();
  const { data: exams = EMPTY_ARRAY, isLoading: isLoadingExams } = useExams();
  const addMarksMutation = useAddMarksMutation();

  const [marksData, setMarksData] = useState<MarksData>({});
  const [sections, setSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const formValues = watch();
  const { year, examName, level, group, section, specific } = formValues;

  const { data: students = EMPTY_ARRAY, isLoading: isLoadingStudents } = useMarksStudents(year, level);
  const { data: existingMarks = EMPTY_ARRAY, isLoading: isLoadingMarks, refetch: refetchMarks } = useClassMarks(level, year, examName);

  const subjectsForClass = useMemo(() => {
    return subjects
      .filter((s) => s.class.toString() === level)
      .filter((s) => s.subject_type !== "main")
      .filter((s) => {
        if (!group) return true;
        return !s.group || s.group === "" || s.group === group;
      });
  }, [subjects, level, group]);

  const selectedSubject = useMemo(() => {
    return subjectsForClass.find((s) => s.id === Number(specific));
  }, [subjectsForClass, specific]);

  const examList = useMemo(() => exams.filter(e => e.exam_year === Number(year)).map(e => e.exam_name), [exams, year]);
  const classListMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    exams.filter(e => e.exam_year === Number(year)).forEach(e => {
      if (!map[e.exam_name]) map[e.exam_name] = e.levels || [];
    });
    return map;
  }, [exams, year]);

  useEffect(() => {
    setValue("level", "");
    setValue("group", "");
    setValue("section", "");
    setValue("specific", 0);
  }, [examName, setValue]);

  useEffect(() => {
    if (user?.role === "teacher" && user.levels && user.levels.length > 0) {
      const assignmentsInYear = user.levels.filter((l: any) => l.year === Number(year));
      if (assignmentsInYear.length === 1) {
        const assignment = assignmentsInYear[0];
        if (examName) {
          setValue("level", assignment.class_name.toString());
          setValue("section", assignment.section);
        }
      }
    }
  }, [user, year, examName, setValue]);


  useEffect(() => {
    if (specific && !subjectsForClass.some((sub) => sub.id == Number(specific))) {
      setValue("specific", 0);
    }
  }, [subjectsForClass, specific, setValue]);

  useEffect(() => {
    if (selectedSubject && selectedSubject.group && selectedSubject.group !== "") {
      setValue("group", selectedSubject.group);
    }
  }, [selectedSubject, setValue]);

  useEffect(() => {
    if (existingMarks.length > 0) {
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
      setMarksData(initialData);
    } else {
      setMarksData((prev) => Object.keys(prev).length === 0 ? prev : {});
    }
  }, [existingMarks, subjectsForClass]);

  useEffect(() => {
    if (students.length > 0) {
      setSections(Array.from(new Set(students.map((s) => s.section))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
    } else {
      setSections([]);
    }
  }, [students]);

  const handleMarksChange = useCallback((studentId: number, subjectId: number, markType: string, value: string) => {
    const subject = subjectsForClass.find((s) => s.id === subjectId);
    let maxMark = 100;
    if (subject) {
      if (markType === "cq_marks") maxMark = subject.cq_mark || 0;
      else if (markType === "mcq_marks") maxMark = subject.mcq_mark || 0;
      else if (markType === "practical_marks") maxMark = subject.practical_mark || 0;
      else if (markType === "marks") maxMark = subject.full_mark || 100;
    }

    // Parse and validate: empty = null, non-numeric = reject, clamp to [0, maxMark]
    let validatedMarks: number | null;
    if (value === "") {
      validatedMarks = null;
    } else {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) return; // reject non-numeric input entirely
      validatedMarks = Math.min(Math.max(0, parsed), maxMark);
    }

    setMarksData((prev) => {
      const currentStudent = prev[studentId] || { subjectMarks: [] };
      const currentSubjectIndex = currentStudent.subjectMarks.findIndex((m) => m.subjectId === subjectId);
      let updatedSubjectMarks: SubjectMark[];
      if (currentSubjectIndex >= 0) {
        updatedSubjectMarks = [...currentStudent.subjectMarks];
        const updatedMark = { ...updatedSubjectMarks[currentSubjectIndex], [markType]: validatedMarks };
        if (subject && subject.marking_scheme === "BREAKDOWN" && markType !== "marks") {
          const cq = updatedMark.cq_marks;
          const mcq = updatedMark.mcq_marks;
          const prac = updatedMark.practical_marks;
          updatedMark.marks = (cq === null || cq === undefined) && (mcq === null || mcq === undefined) && (prac === null || prac === undefined)
            ? null
            : (Number(cq) || 0) + (Number(mcq) || 0) + (Number(prac) || 0);
        }
        updatedSubjectMarks[currentSubjectIndex] = updatedMark;
      } else {
        const newMark: SubjectMark = {
          subjectId,
          cq_marks: markType === "cq_marks" ? validatedMarks : null,
          mcq_marks: markType === "mcq_marks" ? validatedMarks : null,
          practical_marks: markType === "practical_marks" ? validatedMarks : null,
          marks: markType === "marks" ? validatedMarks : null,
        };
        if (subject && subject.marking_scheme === "BREAKDOWN" && markType !== "marks") {
          newMark.marks = (Number(newMark.cq_marks) || 0) + (Number(newMark.mcq_marks) || 0) + (Number(newMark.practical_marks) || 0);
        }
        updatedSubjectMarks = [...currentStudent.subjectMarks, newMark];
      }
      return { ...prev, [studentId]: { ...currentStudent, subjectMarks: updatedSubjectMarks } };
    });
  }, [subjectsForClass]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((s: Student) => (group ? s.group === group : true))
      .filter((s: Student) => !section || s.section === section)
      .filter((s: Student) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.roll.toString().includes(query)
        );
      })
      .sort((a: Student, b: Student) => {
        const secCmp = a.section.localeCompare(b.section, undefined, { numeric: true, sensitivity: "base" });
        return secCmp !== 0 ? secCmp : a.roll - b.roll;
      });
  }, [students, group, section, searchQuery]);


  const onSubmit = async () => {
    const visibleSubjects = subjectsForClass.filter(
      (s) => !specific || s.id === specific
    );

    const submissionData = filteredStudents.map((student) => {
      const studentData = marksData[student.student_id];
      const subjectMarks = visibleSubjects.map((subject) => {
        const existingMark = studentData?.subjectMarks?.find(
          (m) => m.subjectId === subject.id
        );
        return {
          subjectId: subject.id,
          cq_marks: existingMark?.cq_marks ?? null,
          mcq_marks: existingMark?.mcq_marks ?? null,
          practical_marks: existingMark?.practical_marks ?? null,
          marks: existingMark?.marks ?? null,
        };
      });

      return {
        studentId: student.student_id,
        subjectMarks: subjectMarks,
      };
    });

    if (submissionData.length === 0) {
      toast.error("No students found to submit marks for");
      return;
    }

    addMarksMutation.mutate({
      students: submissionData,
      examName,
      year,
    }, {
      onSuccess: () => {
        refetchMarks();
      }
    });
  };

  const isLoading = isLoadingSubjects || isLoadingExams || isLoadingStudents || isLoadingMarks;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Student Marks Management"
        description="Enter and manage student marks for different examinations."
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <StatsCard
          label="Selected Class"
          value={level ? `Class ${level}` : "None"}
          loading={isLoadingStudents}
        />
        <StatsCard
          label="Total Students"
          value={filteredStudents.length}
          loading={isLoadingStudents}
        />
        <StatsCard
          label="Total Subjects"
          value={subjectsForClass.length}
          loading={isLoadingSubjects}
        />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, (err) => {
          console.error("Form errors:", err);
          toast.error("Please fill all required fields");
        })}
        className="space-y-6"
      >
        <SectionCard className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Academic Year</label>
              <select
                {...register("year", { required: true, valueAsNumber: true })}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                disabled={isLoadingExams}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={2020 + i}>
                    {2020 + i}
                  </option>
                ))}
              </select>
              <ErrorMessage message={errors.year?.message} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Examination</label>
              <select
                {...register("examName", { required: true })}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                disabled={!year || isLoadingExams}
              >
                <option value="">Select Exam</option>
                {examList.map((exam, index) => (
                  <option key={index} value={exam}>
                    {exam}
                  </option>
                ))}
              </select>
              <ErrorMessage message={errors.examName?.message} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Class/Grade</label>
              <select
                {...register("level", { required: true })}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                disabled={!examName || isLoadingExams}
                value={level}
              >
                <option value="">Select Class</option>
                {examName &&
                  (classListMap[examName] || [])
                    .slice().sort((a, b) => a - b)
                    .filter((cls) => {
                      if (user?.role === "admin") return true;
                      if (user?.role === "teacher") {
                        return user.levels?.some(
                          (l: any) =>
                            l.class_name === Number(cls) &&
                            l.year === Number(year),
                        );
                      }
                      return false;
                    })
                    .map((cls, index) => (
                      <option key={index} value={cls}>
                        Class {cls}
                      </option>
                    ))}
              </select>
              <ErrorMessage message={errors.level?.message} />
            </div>

            {Number(level) >= 9 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Group</label>
                <select
                  {...register("group")}
                  className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                  disabled={!level || isLoadingExams}
                >
                  {["", "Science", "Humanities", "Commerce"].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept ? dept : "All Groups"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Section</label>
              <select
                {...register("section")}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                disabled={!level || isLoadingExams}
              >
                <option value="">All Sections</option>
                {sections
                  .filter((sec) => {
                    if (user?.role === "admin") return true;
                    if (user?.role === "teacher") {
                      return user.levels?.some(
                        (l: any) =>
                          l.class_name === Number(level) &&
                          l.section === sec &&
                          l.year === Number(year)
                      );
                    }
                    return false;
                  })
                  .map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <select
                {...register("specific", { valueAsNumber: true })}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                disabled={!level || isLoadingExams}
              >
                <option value="0">Select Subject</option>
                {examName &&
                  subjectsForClass.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {isLoading ? (
          <SectionCard className="flex flex-col justify-center items-center h-40 sm:h-64">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-primary"></div>
            <span className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground text-center px-4">
              {isLoadingSubjects || isLoadingExams ? "Loading initial data..." : isLoadingStudents ? "Loading students..." : "Loading marks data..."}
            </span>
          </SectionCard>
        ) : students.length > 0 ? (
          <SectionCard className="p-0 overflow-hidden">
            <div className="p-3 sm:p-4 bg-muted/20 border-b border-border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search name or roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                />
                <svg
                  className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="text-xs text-muted-foreground font-medium text-right sm:text-left">
                Showing {filteredStudents.length} of {students.length} students
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-6 sm:p-12 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No students match your search{searchQuery ? ` "${searchQuery}"` : " or filters"}.
                </p>
              </div>
            ) : (specific && specific !== 0 && selectedSubject) ? (
              <>
                <div className="bg-primary/5 p-3 sm:p-4 border-b border-border flex justify-between items-center gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-lg font-bold text-primary truncate">
                      {subjectsForClass.find((sub) => sub.id === specific)?.name}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Subject Mark Entry</p>
                  </div>
                  <div className="shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Total</span>
                      <span className="text-sm font-bold">{subjectsForClass.find((sub) => sub.id === specific)?.full_mark || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile card layout */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Roll / Sec</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {selectedSubject?.marking_scheme === "BREAKDOWN" ? "CQ / MCQ / Prac" : `Marks (${selectedSubject?.full_mark || 0})`}
                    </span>
                  </div>
                  {filteredStudents.map((student) => {
                    const studentMarksEntry = marksData[student.student_id];
                    const subjectMark = studentMarksEntry?.subjectMarks?.find(
                      (m) => m.subjectId === selectedSubject.id
                    );
                    return (
                      <StudentMarkRow
                        key={student.student_id}
                        variant="card"
                        student={student}
                        selectedSubject={selectedSubject}
                        studentSubject={subjectMark}
                        onMarkChange={handleMarksChange}
                      />
                    );
                  })}
                </div>

                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full divide-y divide-border">
                    <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Student
                        </th>
                        {selectedSubject && selectedSubject.marking_scheme === "BREAKDOWN" ? (
                          <>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                              CQ ({selectedSubject.cq_mark || 0})
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                              MCQ ({selectedSubject.mcq_mark || 0})
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                              Prac ({selectedSubject.practical_mark || 0})
                            </th>
                          </>
                        ) : (
                          <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                            Marks ({selectedSubject?.full_mark || 0})
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {filteredStudents.map((student) => {
                        const studentMarksEntry = marksData[student.student_id];
                        const subjectMark = studentMarksEntry?.subjectMarks?.find(
                          (m) => m.subjectId === selectedSubject.id
                        );
                        return (
                          <StudentMarkRow
                            key={student.student_id}
                            variant="table"
                            student={student}
                            selectedSubject={selectedSubject}
                            studentSubject={subjectMark}
                            onMarkChange={handleMarksChange}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-6 sm:p-12 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Please select a subject from the filters above to continue.
                </p>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard className="p-6 sm:p-12 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {!level
                ? "Please select a class to view students"
                : "No students found for the selected class."}
            </p>
          </SectionCard>
        )}

        {filteredStudents.length > 0 &&
          (specific && specific !== 0) &&
          selectedSubject &&
          selectedSubject.full_mark > 0 && (
            selectedSubject.marking_scheme === "TOTAL" ||
            (selectedSubject.cq_mark || 0) > 0 ||
            (selectedSubject.mcq_mark || 0) > 0 ||
            (selectedSubject.practical_mark || 0) > 0
          ) && (
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t sm:border-t-0 border-border -mx-4 px-4 py-3 sm:mx-0 sm:px-0 sm:py-0 sm:static sm:bg-transparent sm:backdrop-blur-none flex justify-end pt-0 sm:pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={addMarksMutation.isPending}
                className="w-full sm:w-auto px-10 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {addMarksMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Save Marks`
                )}
              </Button>
            </div>
          )}
      </form>
    </div>
  );
};

export default AddMarks;
