import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import ErrorMessage from "@/components/ErrorMessage";
import { PageHeader, SectionCard, StatsCard } from "@/components";
import { Button } from "@/components/ui/button";

interface Student {
  student_id: number;
  name: string;
  roll: number;
  section: string;
  class: number;
  department: string;
}

interface Subject {
  id: number;
  name: string;
  class: number;
  department: string;
  cq_mark: number;
  mcq_mark: number;
  practical_mark: number;
  full_mark: number;
}

interface Exam {
  exam_name: string;
  exam_year: number;
  levels: number[];
}

interface SubjectMark {
  subjectId: number;
  cq_marks: number;
  mcq_marks: number;
  practical_marks: number;
}

interface MarksData {
  [studentId: number]: {
    subjectMarks: SubjectMark[];
  };
}

interface GpaData {
  [studentId: number]: {
    gpa: string | number;
    studentId?: number;
  };
}

interface FormValues {
  year: number;
  examName: string;
  level: string;
  department: string;
  section: string;
  specific: number;
}

interface StudentMarkResponse {
  student_id: number;
  marks?: Array<{
    subject_id: number;
    cq_marks: number;
    mcq_marks: number;
    practical_marks: number;
  }>;
}

interface GPAResponse {
  student_id: number;
  jsc_gpa?: number;
  ssc_gpa?: number;
}

const AddMarks = () => {
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
      department: "",
      section: "",
      specific: 0,
    },
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examList, setExamList] = useState<string[]>([]);
  const [classList, setClassList] = useState<number[][]>([]);
  const [loading, setLoading] = useState({
    initial: true,
    students: false,
    marks: false,
    submit: false,
  });
  const [marksData, setMarksData] = useState<MarksData>({});
  const [sections, setSections] = useState<string[]>([]);
  const [gpaData, setGpaData] = useState<GpaData>({});

  const formValues = watch();
  const { year, examName, level, department, section, specific } = formValues;

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, initial: true }));

      const [subjectsRes, examsRes] = await Promise.all([
        axios.get("/api/sub/getSubjects").catch(() => ({ data: { data: [] } })),
        axios.get("/api/exams/getExams").catch(() => ({ data: { data: [] } })),
      ]);

      setSubjects(subjectsRes.data?.data || []);
      const exams: Exam[] = examsRes.data?.data || [];
      const currentYearExams = exams.filter(
        (e) => e.exam_year === Number(year)
      );
      setExamList(currentYearExams.map((e) => e.exam_name));
      setClassList(currentYearExams.map((e) => e.levels || []));
    } catch (error) {
      console.error("Initial data error:", error);
      toast.error("Failed to load initial data");
    } finally {
      setLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [year]);

  const fetchStudents = useCallback(async () => {
    if (!level) {
      setStudents([]);
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, students: true }));
      const studentsRes = await axios.get("/api/students", {
        params: { year, class: level },
      });
      const studentsData = studentsRes.data?.data || [];
      setStudents(studentsData);
    } catch (error) {
      console.error("Students fetch error:", error);
      toast.error("Failed to load students");
      setStudents([]);
    } finally {
      setLoading((prev) => ({ ...prev, students: false }));
    }
  }, [level, year]);

  useEffect(() => {
    fetchInitialData();
  }, [year, fetchInitialData]);

  useEffect(() => {
    setValue("level", "");
    setValue("department", "");
    setValue("section", "");
    setValue("specific", 0);
    setStudents([]);

    if (examName === "JSC") {
      setValue("level", "8");
    } else if (examName === "SSC") {
      setValue("level", "10");
    }
  }, [examName, setValue]);

  useEffect(() => {
    if (level) {
      fetchStudents();
    } else {
      setStudents([]);
      setSections([]);
    }
  }, [level, year, fetchStudents]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => (department ? s.department === department : true))
      .filter((s) => !section || s.section === section)
      .sort((a, b) => a.roll - b.roll);
  }, [students, department, section]);

  const subjectsForClass = useMemo(() => {
    return subjects.filter((s) => s.class.toString() == level);
  }, [subjects, level]);

  useEffect(() => {
    if (!subjectsForClass.some((sub) => sub.id == specific)) {
      setValue("specific", 0);
    }
  }, [subjectsForClass, specific, setValue]);

  useEffect(() => {
    if (specific && specific !== 0) {
      const selectedSubject = subjectsForClass.find(
        (sub) => sub.id == specific
      );
      if (selectedSubject) {
        if (
          selectedSubject.department &&
          selectedSubject.department !== "" &&
          selectedSubject.department !== null
        ) {
          setValue("department", selectedSubject.department);
        } else {
          setValue("department", "");
        }
      }
    } else if (specific === 0) {
      setValue("department", "");
    }
  }, [specific, subjectsForClass, setValue]);

  const fetchExistingMarks = useCallback(async () => {
    if (
      !level ||
      !year ||
      !examName ||
      examName === "JSC" ||
      examName === "SSC"
    ) {
      setMarksData({});
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, marks: true }));
      setMarksData({});

      const res = await axios.get(
        `/api/marks/getClassMarks/${level}/${year}/${examName}`
      );

      const marks = res.data?.data || [];
      const initialData: MarksData = {};

      marks.forEach((student: StudentMarkResponse) => {
        initialData[student.student_id] = {
          subjectMarks: subjectsForClass.map((subject) => {
            const existingMark = (student.marks || []).find(
              (mark: { subject_id: number; cq_marks: number; mcq_marks: number; practical_marks: number }) => mark.subject_id === subject.id
            );
            return {
              subjectId: subject.id,
              cq_marks: existingMark?.cq_marks || 0,
              mcq_marks: existingMark?.mcq_marks || 0,
              practical_marks: existingMark?.practical_marks || 0,
            };
          }),
        };
      });

      setMarksData(initialData);
    } catch (error) {
      console.error("Marks fetch error:", error);
      toast.error("Failed to load existing marks");
    } finally {
      setLoading((prev) => ({ ...prev, marks: false }));
    }
  }, [level, year, examName, subjectsForClass]);

  const fetchGPA = useCallback(async () => {
    if (!year || !examName || (examName !== "JSC" && examName !== "SSC")) {
      setGpaData({});
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, marks: true }));
      const res = await axios.get(`/api/marks/getGPA/${year}`);
      const gpaDatas = res.data?.data || [];

      const initialData: GpaData = {};
      if (examName == "JSC") {
        gpaDatas.forEach((student: GPAResponse) => {
          initialData[student.student_id] = {
            gpa: student.jsc_gpa || 0,
          };
        });
      } else if (examName == "SSC") {
        gpaDatas.forEach((student: GPAResponse) => {
          initialData[student.student_id] = {
            studentId: student.student_id,
            gpa: student.ssc_gpa || 0,
          };
        });
      }
      setGpaData(initialData);
    } catch (error) {
      console.error("GPA fetch error:", error);
      toast.error("Failed to load existing GPA");
    } finally {
      setLoading((prev) => ({ ...prev, marks: false }));
    }
  }, [year, examName]);

  useEffect(() => {
    if (students.length > 0) {
      setSections(() => {
        return Array.from(new Set(students.map((s) => s.section)));
      });

      if (examName === "JSC" || examName === "SSC") {
        fetchGPA();
      } else if (
        examName &&
        level &&
        examName !== "JSC" &&
        examName !== "SSC"
      ) {
        fetchExistingMarks();
      }
    } else {
      setSections([]);
      setMarksData({});
      setGpaData({});
    }
  }, [students, examName, level, year, fetchExistingMarks, fetchGPA]);

  const handleMarksChange = (studentId: number, subjectId: number, markType: string, value: string) => {
    const subject = subjectsForClass.find((s) => s.id === subjectId);
    const marks = value;

    let maxMark = 100;
    if (subject) {
      switch (markType) {
        case "cq_marks":
          maxMark = subject.cq_mark || 0;
          break;
        case "mcq_marks":
          maxMark = subject.mcq_mark || 0;
          break;
        case "practical_marks":
          maxMark = subject.practical_mark || 0;
          break;
      }
    }

    const validatedMarks =
      marks === ""
        ? 0
        : parseInt(marks) > maxMark
          ? maxMark.toString()
          : marks.slice(0, 3);

    setMarksData((prev) => {
      const currentStudent = prev[studentId] || { subjectMarks: [] };
      const currentSubjectIndex = currentStudent.subjectMarks.findIndex(
        (m) => m.subjectId === subjectId
      );

      let updatedSubjectMarks: SubjectMark[];
      if (currentSubjectIndex >= 0) {
        updatedSubjectMarks = [...currentStudent.subjectMarks];
        updatedSubjectMarks[currentSubjectIndex] = {
          ...updatedSubjectMarks[currentSubjectIndex],
          [markType]: validatedMarks,
        };
      } else {
        updatedSubjectMarks = [
          ...currentStudent.subjectMarks,
          {
            subjectId,
            cq_marks: markType === "cq_marks" ? Number(validatedMarks) : 0,
            mcq_marks: markType === "mcq_marks" ? Number(validatedMarks) : 0,
            practical_marks:
              markType === "practical_marks" ? Number(validatedMarks) : 0,
          },
        ];
      }

      return {
        ...prev,
        [studentId]: {
          ...currentStudent,
          subjectMarks: updatedSubjectMarks,
        },
      };
    });
  };

  const handleGPAchange = (studentId: number, value: string | number) => {
    setGpaData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        gpa: value,
      },
    }));
  };

  const onSubmit = async () => {
    setLoading((prev) => ({ ...prev, submit: true }));
    if (examName === "SSC" || examName === "JSC") {
      const gpaDataToSend = Object.entries(gpaData)
        .filter(([studentId]) => {
          const student = filteredStudents.find(
            (s) => s?.student_id === Number(studentId)
          );
          return student;
        })
        .map(([studentId, data]) => ({
          studentId: parseInt(studentId),
          gpa: data.gpa,
        }));

      try {
        const response = await axios.post("/api/marks/addGPA", {
          students: gpaDataToSend,
          examName,
        });
        toast.success(response.data.message || "Marks saved successfully");
      } catch (error) {
        console.error("Submission error:", error);
        toast.error("Failed to save marks");
      }
      fetchGPA();
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }
    try {
      const visibleSubjects = subjectsForClass.filter(
        (s) => !specific || s.id == specific
      );

      const submissionData = filteredStudents.map((student) => {
        const studentData = marksData[student.student_id];

        const subjectMarks = visibleSubjects.map((subject) => {
          const existingMark = studentData?.subjectMarks?.find(
            (m) => m.subjectId === subject.id
          );
          return {
            subjectId: subject.id,
            cq_marks: Math.max(0, Number(existingMark?.cq_marks) || 0),
            mcq_marks: Math.max(0, Number(existingMark?.mcq_marks) || 0),
            practical_marks: Math.max(
              0,
              Number(existingMark?.practical_marks) || 0
            ),
          };
        });

        return {
          studentId: student.student_id,
          subjectMarks: subjectMarks,
        };
      });

      if (submissionData.length === 0) {
        throw new Error("No students found to submit marks for");
      }

      const response = await axios.post("/api/marks/addMarks", {
        students: submissionData,
        examName,
        year,
      });

      toast.success(response.data.message || "Marks saved successfully");
    } catch (error) {
      console.error("Submission error:", error);
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error(
        axiosError.response?.data?.error || axiosError.message || "Failed to save marks"
      );
    } finally {
      fetchExistingMarks();
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Student Marks Management"
        description="Enter and manage student marks for different examinations."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <StatsCard
          label="Selected Class"
          value={level ? `Class ${level}` : "None"}
          loading={loading.students}
        />
        <StatsCard
          label="Total Students"
          value={filteredStudents.length}
          loading={loading.students}
        />
        <StatsCard
          label="Total Subjects"
          value={subjectsForClass.length}
          loading={loading.initial}
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
                {...register("year", { required: true })}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                disabled={loading.initial}
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
                disabled={!year || loading.initial}
              >
                <option value="">Select Exam</option>
                {examList.map((exam, index) => (
                  <option key={index} value={exam}>
                    {exam}
                  </option>
                ))}
                {["JSC", "SSC"].map((exam, index) => (
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
                disabled={
                  !examName ||
                  loading.initial ||
                  examName === "JSC" ||
                  examName === "SSC"
                }
                value={level}
              >
                <option value="">Select Class</option>
                {examName === "JSC" ? (
                  <option value="8">Class 8</option>
                ) : examName === "SSC" ? (
                  <option value="10">Class 10</option>
                ) : (
                  examName &&
                  classList[examList.indexOf(examName)]
                    ?.sort((a, b) => a - b)
                    .map((cls, index) => (
                      <option key={index} value={cls}>
                        Class {cls}
                      </option>
                    ))
                )}
              </select>
              <ErrorMessage message={errors.level?.message} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Department</label>
              <select
                {...register("department")}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                disabled={!level || loading.initial}
              >
                {Number(level) >= 9
                  ? ["", "Science", "Humanities", "Commerce"].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept ? dept : "All Departments"}
                    </option>
                  ))
                  : [""].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept ? dept : "General"}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Section</label>
              <select
                {...register("section")}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                disabled={!level || loading.initial}
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <select
                {...register("specific")}
                className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-muted/50"
                disabled={!level || loading.initial}
              >
                <option value="0">Select Subject</option>
                {examName !== "JSC" &&
                  examName !== "SSC" &&
                  subjectsForClass.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {loading.initial || loading.students || loading.marks ? (
          <SectionCard className="flex flex-col justify-center items-center h-32 sm:h-64">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-primary"></div>
            <span className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground text-center px-4">
              {loading.initial ? "Loading initial data..." : loading.students ? "Loading students..." : "Loading marks data..."}
            </span>
          </SectionCard>
        ) : filteredStudents.length > 0 ? (
          <SectionCard className="p-0 overflow-hidden">
            {examName !== "JSC" && examName !== "SSC" ? (
              specific && specific !== 0 ? (
                <div className="overflow-x-auto">
                  {/* Subject Info Ribbon */}
                  <div className="bg-primary/5 p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-primary">
                        {subjectsForClass.find((sub) => sub.id == specific)?.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Subject Mark Entry</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center sm:text-right">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Total Marks</span>
                        <span className="text-sm font-bold">{subjectsForClass.find((sub) => sub.id == specific)?.full_mark || 0}</span>
                      </div>
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Student Information
                        </th>
                        {(() => {
                          const selectedSubject = subjectsForClass.find(
                            (sub) => sub.id == specific
                          );
                          return selectedSubject ? (
                            <>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                                CQ ({selectedSubject.cq_mark || 0})
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                                MCQ ({selectedSubject.mcq_mark || 0})
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                                Practical ({selectedSubject.practical_mark || 0})
                              </th>
                            </>
                          ) : null;
                        })()}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {filteredStudents.map((student) => {
                        const selectedSubject = subjectsForClass.find((sub) => sub.id == specific);
                        if (!selectedSubject) return null;

                        const isDeptMismatch = selectedSubject.department && 
                          selectedSubject.department !== "" && 
                          selectedSubject.department !== student.department;

                        if (isDeptMismatch) {
                          return (
                            <tr key={student.student_id} className="bg-muted/30">
                              <td className="px-4 py-4">
                                <div className="text-sm font-medium">{student.name}</div>
                                <div className="text-[10px] text-muted-foreground">Roll: {student.roll} | Sec: {student.section || "N/A"}</div>
                              </td>
                              <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground italic">
                                Not available for student department
                              </td>
                            </tr>
                          );
                        }

                        const studentSubject = marksData[student.student_id]?.subjectMarks?.find(
                          (m) => m.subjectId === selectedSubject.id
                        );

                        return (
                          <tr key={student.student_id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{student.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Roll: {student.roll}</span>
                                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Sec: {student.section || "N/A"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.cq_mark || 100}
                                value={studentSubject?.cq_marks || 0}
                                onChange={(e) => handleMarksChange(student.student_id, selectedSubject.id, "cq_marks", e.target.value)}
                                disabled={!selectedSubject.cq_mark}
                                className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${
                                  !selectedSubject.cq_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
                                }`}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.mcq_mark || 100}
                                value={studentSubject?.mcq_marks || 0}
                                onChange={(e) => handleMarksChange(student.student_id, selectedSubject.id, "mcq_marks", e.target.value)}
                                disabled={!selectedSubject.mcq_mark}
                                className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${
                                  !selectedSubject.mcq_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
                                }`}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.practical_mark || 100}
                                value={studentSubject?.practical_marks || 0}
                                onChange={(e) => handleMarksChange(student.student_id, selectedSubject.id, "practical_marks", e.target.value)}
                                disabled={!selectedSubject.practical_mark}
                                className={`w-16 p-2 border border-border rounded text-center text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all ${
                                  !selectedSubject.practical_mark ? "bg-muted cursor-not-allowed text-muted-foreground" : "bg-card"
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Please select a subject from the filters above to continue.
                  </p>
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-3 text-left">Student Information</th>
                      <th className="px-6 py-3 text-center">GPA (Out of 5.00)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {filteredStudents.map((student) => (
                      <tr key={student.student_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{student.name}</span>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Roll: {student.roll}</span>
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Sec: {student.section || "N/A"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            value={gpaData[student.student_id]?.gpa || ""}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (parseFloat(val) > 5) val = "5.00";
                              if (val && val.includes(".")) {
                                const [intPart, decPart] = val.split(".");
                                val = intPart + "." + decPart.slice(0, 2);
                              }
                              handleGPAchange(student.student_id, val);
                            }}
                            className="w-24 p-2.5 border border-border rounded-lg text-center font-bold text-sm bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {!level
                ? "Please select a class to view students"
                : students.length === 0
                  ? "No students found for the selected class."
                  : "No students match the current filters."}
            </p>
          </SectionCard>
        )}

        {filteredStudents.length > 0 &&
          (examName === "JSC" ||
            examName === "SSC" ||
            (examName !== "JSC" &&
              examName !== "SSC" &&
              specific &&
              specific !== 0)) &&
          ((subjectsForClass.find((sub) => sub.id == specific)?.full_mark ?? 0) > 0) &&
          ((subjectsForClass.find((sub) => sub.id == specific)?.cq_mark ?? 0) ||
            (subjectsForClass.find((sub) => sub.id == specific)?.mcq_mark ?? 0) ||
            (subjectsForClass.find((sub) => sub.id == specific)?.practical_mark ?? 0)) && (
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={loading.submit}
                className="w-full sm:w-auto px-10 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading.submit ? (
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
                  `Save ${examName === "JSC" || examName === "SSC" ? "GPA" : "Marks"}`
                )}
              </Button>
            </div>
          )}
      </form>
    </div>
  );
};

export default AddMarks;
