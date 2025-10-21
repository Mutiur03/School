import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

const AddMarks = () => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    // formState: { errors },
  } = useForm({
    defaultValues: {
      year: new Date().getFullYear(),
      examName: "",
      level: "",
      department: "",
      section: "",
      specific: 0,
    },
  });

  // State management
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [examList, setExamList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState({
    initial: true,
    students: false,
    marks: false,
    submit: false,
  });
  const [marksData, setMarksData] = useState({});
  const [sections, setSections] = useState([]);
  const [gpaData, setGpaData] = useState({});

  // Form values
  const formValues = watch();
  const { year, examName, level, department, section, specific } = formValues;

  // Fetch initial data
  const fetchInitialData = async () => {
    try {
      setLoading((prev) => ({ ...prev, initial: true }));

      const [subjectsRes, examsRes] = await Promise.all([
        axios.get("/api/sub/getSubjects").catch(() => ({ data: { data: [] } })),
        axios.get("/api/exams/getExams").catch(() => ({ data: { data: [] } })),
      ]);

      setSubjects(subjectsRes.data?.data || []);
      console.log("Subjects:", subjectsRes.data?.data || []);
      const exams = examsRes.data?.data || [];
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
  };

  // Fetch students after class selection
  const fetchStudents = async () => {
    if (!level) {
      setStudents([]);
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, students: true }));
      const studentsRes = await axios.get(
        `/api/students/getStudentsByClass/${year}/${level}`
      );
      const studentsData = studentsRes.data?.data || [];
      setStudents(studentsData);
      console.log("Students:", studentsData);
    } catch (error) {
      console.error("Students fetch error:", error);
      toast.error("Failed to load students");
      setStudents([]);
    } finally {
      setLoading((prev) => ({ ...prev, students: false }));
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [year]);

  useEffect(() => {
    setValue("level", ""); // Reset level when examName is empty
    setValue("department", "");
    setValue("section", "");
    setValue("specific", 0);
    setStudents([]); // Clear students when exam changes

    // Auto-set class for JSC and SSC
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
  }, [level, year]);

  // Filtered data
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => (department ? s.department === department : true)) // Match department or include all
      .filter((s) => !section || s.section === section) // Match section or include all
      .sort((a, b) => a.roll - b.roll); // Sort by roll number
  }, [students, department, section]);

  const subjectsForClass = useMemo(() => {
    // Remove department filtering - show all subjects for the selected class
    return subjects.filter((s) => s.class.toString() == level); // Only filter by class
  }, [subjects, level]);

  useEffect(() => {
    if (!subjectsForClass.some((sub) => sub.id == specific)) {
      setValue("specific", 0); // Reset specific if the selected subject is no longer valid
    }
  }, [subjectsForClass, specific, setValue]);

  // Auto-select department when specific subject is chosen
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
          // Auto-select department if the subject has a specific department
          setValue("department", selectedSubject.department);
        } else {
          // Reset to "All Departments" if subject is general (for all departments)
          setValue("department", "");
        }
      }
    } else if (specific === 0) {
      setValue("department", ""); // Reset to "All Departments" when "Select Subject" is selected
    }
  }, [specific, subjectsForClass, setValue]);

  // Fetch existing marks
  const fetchExistingMarks = async () => {
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
      console.log("Marks data:", res.data);

      const marks = res.data?.data || [];
      const initialData = {};

      marks.forEach((student) => {
        initialData[student.student_id] = {
          subjectMarks: subjectsForClass.map((subject) => {
            const existingMark = (student.marks || []).find(
              (mark) => mark.subject_id === subject.id
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
      console.log("Initial marks data:", initialData);

      setMarksData(initialData);
    } catch (error) {
      console.error("Marks fetch error:", error);
      toast.error("Failed to load existing marks");
    } finally {
      setLoading((prev) => ({ ...prev, marks: false }));
    }
  };

  const fetchGPA = async () => {
    if (!year || !examName || (examName !== "JSC" && examName !== "SSC")) {
      setGpaData({});
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, marks: true }));
      const res = await axios.get(`/api/marks/getGPA/${year}`);
      console.log("GPA data:", res.data);
      const gpaDatas = res.data?.data || [];

      const initialData = {};
      if (examName == "JSC") {
        gpaDatas.forEach((student) => {
          initialData[student.student_id] = {
            gpa: student.jsc_gpa,
          };
        });
      } else if (examName == "SSC") {
        gpaDatas.forEach((student) => {
          initialData[student.student_id] = {
            studentId: student.student_id,
            gpa: student.ssc_gpa,
          };
        });
      }
      console.log("Initial GPA data:", initialData);
      setGpaData(initialData);
    } catch (error) {
      console.error("GPA fetch error:", error);
      toast.error("Failed to load existing GPA");
    } finally {
      setLoading((prev) => ({ ...prev, marks: false }));
    }
  };

  useEffect(() => {
    if (students.length > 0) {
      setSections(() => {
        return Array.from(new Set(students.map((s) => s.section)));
      });

      // Fetch marks/GPA data when students are loaded AND exam is selected
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
  }, [students, examName, level, year]);

  // Handle marks change
  const handleMarksChange = (studentId, subjectId, markType, value) => {
    console.log("Marks changed:", studentId, subjectId, markType, value);
    const subject = subjectsForClass.find((s) => s.id === subjectId);
    const marks = value;

    // Get max mark based on mark type and subject
    let maxMark = 100; // default fallback
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

      let updatedSubjectMarks;
      if (currentSubjectIndex >= 0) {
        // Update existing subject marks
        updatedSubjectMarks = [...currentStudent.subjectMarks];
        updatedSubjectMarks[currentSubjectIndex] = {
          ...updatedSubjectMarks[currentSubjectIndex],
          [markType]: validatedMarks,
        };
      } else {
        // Add new subject marks
        updatedSubjectMarks = [
          ...currentStudent.subjectMarks,
          {
            subjectId,
            cq_marks: markType === "cq_marks" ? validatedMarks : 0,
            mcq_marks: markType === "mcq_marks" ? validatedMarks : 0,
            practical_marks:
              markType === "practical_marks" ? validatedMarks : 0,
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

  const handleGPAchange = (studentId, value) => {
    console.log("GPA changed:", studentId, value);
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
          // Only include students that are currently visible/filtered
          const student = filteredStudents.find(
            (s) => s?.student_id === Number(studentId)
          );
          return student; // This ensures only visible students are submitted
        })
        .map(([studentId, data]) => ({
          studentId: parseInt(studentId),
          gpa: data.gpa,
        }));

      console.log("Submitting GPA data:", gpaDataToSend);
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
      fetchGPA(); // Refresh GPA data after submission
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }
    try {
      console.log("Submitting marks data:", marksData);

      // Get currently visible subjects based on filters
      const visibleSubjects = subjectsForClass.filter(
        (s) => !specific || s.id == specific
      );

      // Include all visible students, even those without marks entered
      const submissionData = filteredStudents.map((student) => {
        const studentData = marksData[student.student_id];

        // Create subject marks for all visible subjects
        const subjectMarks = visibleSubjects.map((subject) => {
          const existingMark = studentData?.subjectMarks?.find(
            (m) => m.subjectId === subject.id
          );
          return {
            subjectId: subject.id,
            cq_marks: Math.max(0, parseInt(existingMark?.cq_marks) || 0),
            mcq_marks: Math.max(0, parseInt(existingMark?.mcq_marks) || 0),
            practical_marks: Math.max(
              0,
              parseInt(existingMark?.practical_marks) || 0
            ),
          };
        });

        return {
          studentId: student.student_id,
          subjectMarks: subjectMarks,
        };
      });

      console.log("Submission data:", submissionData);

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
      toast.error(
        error.response?.data?.error || error.message || "Failed to save marks"
      );
    } finally {
      fetchExistingMarks();
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  // if (loading.initial) {
  //   return (
  //     <div className="flex justify-center items-center h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  //     </div>
  //   );
  // }

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-7xl">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 px-2 sm:px-0">
        Student Marks Management
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 sm:space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-lg shadow">
          {/* Year Select */}
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Academic Year
            </label>
            <select
              {...register("year", { required: true })}
              className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              disabled={loading.initial}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={2020 + i}>
                  {2020 + i}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Select */}
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Examination
            </label>
            <select
              {...register("examName", { required: true })}
              className="w-full p-2 sm:p-3 text-input dark:bg-accent border rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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
          </div>

          {/* Class Select */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Class/Grade
            </label>
            <select
              {...register("level", { required: true })}
              className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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
          </div>

          {/* Department Select */}
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Department
            </label>
            <select
              {...register("department")}
              className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              disabled={!level || loading.initial}
            >
              {level >= 9
                ? ["", "Science", "Arts", "Commerce"].map((dept) => (
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

          {/* Section Select */}
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Section
            </label>
            <select
              {...register("section")}
              className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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

          {/* Subject Filter */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium mb-1 sm:mb-2">
              Subject
            </label>
            <select
              {...register("specific")}
              className="w-full p-2 sm:p-3 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
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

        {loading.initial ? (
          <div className="flex flex-col justify-center items-center h-32 sm:h-64">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center px-4">
              Loading initial data...
            </span>
          </div>
        ) : loading.students ? (
          <div className="flex flex-col justify-center items-center h-32 sm:h-64">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center px-4">
              Loading students...
            </span>
          </div>
        ) : loading.marks ? (
          <div className="flex flex-col justify-center items-center h-32 sm:h-64">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center px-4">
              Loading marks data...
            </span>
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="px-2 sm:px-0">
            {examName !== "JSC" && examName !== "SSC" ? (
              // Only show table if a specific subject is selected
              specific && specific !== "0" ? (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  {/* Mobile Subject Header */}
                  <div className="block sm:hidden bg-blue-50 dark:bg-blue-900 p-3 border-b border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Subject:{" "}
                      {subjectsForClass.find((sub) => sub.id == specific)?.name}
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                      Teacher:{" "}
                      {
                        subjectsForClass.find((sub) => sub.id == specific)
                          ?.teacher_name
                      }
                    </div>
                    <div>
                      Total Marks:{" "}
                      {subjectsForClass.find((sub) => sub.id == specific)
                        ?.full_mark || 0}{" "}
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      {/* Desktop Subject Header */}
                      <tr className="hidden sm:table-row bg-blue-50 dark:bg-blue-900">
                        <td className="px-6 py-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                          Subject:{" "}
                          {
                            subjectsForClass.find((sub) => sub.id == specific)
                              ?.name
                          }
                        </td>
                        <td
                          className="px-6 py-2 text-sm text-blue-700 dark:text-blue-200"
                          colSpan="2"
                        >
                          Teacher:{" "}
                          {
                            subjectsForClass.find((sub) => sub.id == specific)
                              ?.teacher_name
                          }
                        </td>
                        <td
                          className="px-6 py-2 text-sm text-blue-700 dark:text-blue-200"
                          colSpan="1"
                        >
                          Total Marks:{" "}
                          {subjectsForClass.find((sub) => sub.id == specific)
                            ?.full_mark || 0}
                        </td>
                      </tr>
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Student Info
                        </th>
                        {(() => {
                          const selectedSubject = subjectsForClass.find(
                            (sub) => sub.id == specific
                          );
                          return selectedSubject ? (
                            <>
                              <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <span className="inline">
                                  CQ ({selectedSubject.cq_mark || 0})
                                </span>
                              </th>
                              <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <span className="inline">
                                  MCQ ({selectedSubject.mcq_mark || 0})
                                </span>
                              </th>
                              <th className="px-2 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <span className="hidden sm:inline">
                                  Practical (
                                  {selectedSubject.practical_mark || 0})
                                </span>
                                <span className="sm:hidden">
                                  Prac ({selectedSubject.practical_mark || 0})
                                </span>
                              </th>
                            </>
                          ) : null;
                        })()}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredStudents.map((student) => {
                        const selectedSubject = subjectsForClass.find(
                          (sub) => sub.id == specific
                        );

                        if (!selectedSubject) {
                          return null;
                        }

                        if (
                          selectedSubject.department !== student.department &&
                          selectedSubject.department !== "" &&
                          selectedSubject.department !== null
                        ) {
                          return (
                            <tr
                              key={student.student_id}
                              className="bg-gray-100 dark:bg-gray-700"
                            >
                              <td className="px-3 sm:px-6 py-3 sm:py-4">
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {student.name}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                      <span>Roll: {student.roll}</span>
                                      <span className="hidden sm:inline">
                                        |
                                      </span>
                                      <span>
                                        Sec: {student.section || "N/A"}
                                      </span>
                                      <span className="hidden sm:inline">
                                        |
                                      </span>
                                      <span>Class: {student.class}</span>
                                    </div>
                                    {student.department && (
                                      <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                        {student.department}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td
                                colSpan="3"
                                className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400"
                              >
                                Subject not available for this student's
                                department
                              </td>
                            </tr>
                          );
                        }

                        const studentSubject = marksData[
                          student.student_id
                        ]?.subjectMarks?.find(
                          (m) => m.subjectId === selectedSubject.id
                        );

                        const cqMarks = studentSubject?.cq_marks || 0;
                        const mcqMarks = studentSubject?.mcq_marks || 0;
                        const practicalMarks =
                          studentSubject?.practical_marks || 0;

                        return (
                          <tr
                            key={student.student_id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {student.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                    <span>Roll: {student.roll}</span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>Sec: {student.section || "N/A"}</span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>Class: {student.class}</span>
                                  </div>
                                  {student.department && (
                                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                      {student.department}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.cq_mark || 100}
                                value={cqMarks}
                                onChange={(e) =>
                                  handleMarksChange(
                                    student.student_id,
                                    selectedSubject.id,
                                    "cq_marks",
                                    e.target.value
                                  )
                                }
                                disabled={
                                  !selectedSubject.cq_mark ||
                                  selectedSubject.cq_mark === 0
                                }
                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-gray-300 dark:border-gray-600 rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  !selectedSubject.cq_mark ||
                                  selectedSubject.cq_mark === 0
                                    ? "bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                    : "bg-white dark:bg-gray-700"
                                }`}
                              />
                            </td>
                            <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.mcq_mark || 100}
                                value={mcqMarks}
                                onChange={(e) =>
                                  handleMarksChange(
                                    student.student_id,
                                    selectedSubject.id,
                                    "mcq_marks",
                                    e.target.value
                                  )
                                }
                                disabled={
                                  !selectedSubject.mcq_mark ||
                                  selectedSubject.mcq_mark === 0
                                }
                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-gray-300 dark:border-gray-600 rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  !selectedSubject.mcq_mark ||
                                  selectedSubject.mcq_mark === 0
                                    ? "bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                    : "bg-white dark:bg-gray-700"
                                }`}
                              />
                            </td>
                            <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                              <input
                                type="number"
                                min="0"
                                max={selectedSubject.practical_mark || 100}
                                value={practicalMarks}
                                onChange={(e) =>
                                  handleMarksChange(
                                    student.student_id,
                                    selectedSubject.id,
                                    "practical_marks",
                                    e.target.value
                                  )
                                }
                                disabled={
                                  !selectedSubject.practical_mark ||
                                  selectedSubject.practical_mark === 0
                                }
                                className={`w-12 sm:w-16 p-1 sm:p-2 border border-gray-300 dark:border-gray-600 rounded text-center text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  !selectedSubject.practical_mark ||
                                  selectedSubject.practical_mark === 0
                                    ? "bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                    : "bg-white dark:bg-gray-700"
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
                // Show message when no subject is selected
                <div className="p-6 sm:p-8 rounded-lg dark:bg-accent bg-gray-50 shadow text-center mx-2 sm:mx-0">
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Please select a subject from the dropdown above to enter
                    marks for students.
                  </p>
                </div>
              )
            ) : (
              // JSC/SSC GPA Table - always show
              <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Student Info
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        <span className="hidden sm:inline">
                          GPA (Out of 5.00)
                        </span>
                        <span className="sm:hidden">GPA</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredStudents.map((student) => (
                      <tr
                        key={student.student_id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {student.name}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <span>Roll: {student.roll}</span>
                                <span className="hidden sm:inline">|</span>
                                <span>Sec: {student.section || "N/A"}</span>
                                <span className="hidden sm:inline">|</span>
                                <span>Class: {student.class}</span>
                              </div>
                              {student.department && (
                                <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                  {student.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
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
                            className="w-16 sm:w-24 p-2 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold bg-white dark:bg-gray-700 text-sm sm:text-base"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-lg dark:bg-accent bg-gray-50 shadow text-center mx-2 sm:mx-0">
            <p className="text-sm sm:text-base">
              {!level
                ? "Please select a class to view students"
                : students.length === 0
                ? "No students found in the system for the selected class"
                : "No students match the selected filters"}
            </p>
          </div>
        )}

        {filteredStudents.length > 0 &&
          (examName === "JSC" ||
            examName === "SSC" ||
            (examName !== "JSC" &&
              examName !== "SSC" &&
              specific &&
              specific !== 0)) &&
          subjectsForClass.find((sub) => sub.id == specific)?.full_mark > 0 &&
          (subjectsForClass.find((sub) => sub.id == specific)?.cq_mark ||
            subjectsForClass.find((sub) => sub.id == specific)?.mcq_mark ||
            subjectsForClass.find((sub) => sub.id == specific)
              ?.practical_mark) && (
            <div className="flex justify-center sm:justify-end px-2 sm:px-0">
              <button
                type="submit"
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center text-sm sm:text-base font-medium"
                disabled={loading.submit}
              >
                {loading.submit ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  `Save ${
                    examName === "JSC" || examName === "SSC" ? "GPA" : "Marks"
                  }`
                )}
              </button>
            </div>
          )}
      </form>
    </div>
  );
};

export default AddMarks;
