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

      const [studentsRes, subjectsRes, examsRes] = await Promise.all([
        axios
          .get(`/api/students/getStudents/${year}`)
          .catch(() => ({ data: { data: [] } })),
        axios.get("/api/sub/getSubjects").catch(() => ({ data: { data: [] } })),
        axios.get("/api/exams/getExams").catch(() => ({ data: { data: [] } })),
      ]);

      setStudents(studentsRes.data?.data || []);
      setSubjects(subjectsRes.data?.data || []);
      console.log("Subjects:", subjectsRes.data?.data || []);
      console.log("Students:", studentsRes.data?.data || []);
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
  useEffect(() => {
    fetchInitialData();
  }, [year, examName, level, setValue]);

  useEffect(() => {
    setValue("level", ""); // Reset level when examName is empty
  }, [examName, setValue]);

  // Filtered data
  const filteredStudents = useMemo(() => {
    if (examName == "JSC") {
      setValue("level", "8");
      return students
        .filter((s) => s.class == Number(8))
        .filter((s) => (department ? s.department === department : true))
        .filter((s) => !section || s.section === section)
        .sort((a, b) => a.roll - b.roll);
    }
    if (examName == "SSC") {
      setValue("level", "10");
      return students
        .filter((s) => s.class == Number(10))
        .filter((s) => (department ? s.department === department : true))
        .filter((s) => !section || s.section === section)
        .sort((a, b) => a.roll - b.roll);
    }
    return students
      .filter((s) => s.class === Number(level)) // Match the selected class
      .filter((s) => (department ? s.department === department : true)) // Match department or include all
      .filter((s) => !section || s.section === section) // Match section or include all
      .sort((a, b) => a.roll - b.roll); // Sort by roll number
  }, [students, level, department, section]);

  const subjectsForClass = useMemo(() => {
    const studentDepartments = new Set(
      filteredStudents.map((s) => s.department)
    );
    // console.log(subjects, level, department);

    return subjects
      .filter((s) => s.class.toString() == level) // Include subjects for the selected class or available for all
      .filter(
        (s) =>
          studentDepartments.has(s.department) ||
          s.department === "" ||
          s.department == null
      );
  }, [filteredStudents, subjects, level, specific]);

  useEffect(() => {
    if (!subjectsForClass.some((sub) => sub.id == specific)) {
      setValue("specific", 0); // Reset specific if the selected subject is no longer valid
    }
  }, [subjectsForClass, specific, setValue]);

  // Auto-select department when specific subject is chosen
  useEffect(() => {
    if (specific && specific !== 0) {
      const selectedSubject = subjectsForClass.find(sub => sub.id == specific);
      if (selectedSubject && selectedSubject.department) {
        setValue("department", selectedSubject.department);
      }
    } else if (specific === 0) {
      setValue("department", ""); // Reset to "All Departments" when "All Subjects" is selected
    }
  }, [specific, subjectsForClass, setValue]);

  // Fetch existing marks
  const fetchGPA = async () => {
    if (!year || !examName) return; // Skip if any required field is empty
    try {
      setLoading((prev) => ({ ...prev, marks: true }));
      const res = await axios.get(`/api/marks/getGPA/${year}`);
      console.log("GPA data:", res.data);
      const gpaDatas = res.data?.data || [];

      const initialData = {}; // Preserve existing gpaData
      if (examName == "JSC") {
        gpaDatas.forEach((student) => {
          initialData[student.student_id] = {
            gpa: student.jsc_gpa, // Ensure the key matches the rendering logic
          };
        });
      } else if (examName == "SSC") {
        gpaDatas.forEach((student) => {
          initialData[student.student_id] = {
            studentId: student.student_id,
            gpa: student.ssc_gpa, // Ensure the key matches the rendering logic
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
  const fetchExistingMarks = async () => {
    if (!level || !year || !examName) return; // Skip if any required field is empty
    if (examName == "JSC" || examName == "SSC") return; // Skip if exam is JSC or SSC
    setMarksData({}); // Reset marks data when filters change
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
              marks: existingMark?.marks, // Default to 0 if no marks exist
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
  useEffect(() => {
    setSections(() => {
      if (!level) return [];
      return Array.from(
        new Set(students.filter((s) => s.class == level).map((s) => s.section))
      );
    });

    fetchExistingMarks();
    fetchGPA();
  }, [level, year, examName]);

  // Handle marks change
  const handleMarksChange = (studentId, subjectId, value) => {
    console.log("Marks changed:", studentId, subjectId, value);
    const marks = value;
    const validatedMarks =
      marks === "" ? 0 : parseInt(marks) > 100 ? "100" : marks.slice(0, 3);

    setMarksData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        subjectMarks: [
          ...(prev[studentId]?.subjectMarks?.filter(
            (m) => m.subjectId !== subjectId
          ) || []),
          { subjectId, marks: validatedMarks },
        ],
      },
    }));
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
      const visibleSubjects = subjectsForClass.filter((s) => !specific || s.id == specific);

      // Include all visible students, even those without marks entered
      const submissionData = filteredStudents.map((student) => {
        const studentData = marksData[student.student_id];
        
        // Create subject marks for all visible subjects
        const subjectMarks = visibleSubjects.map((subject) => {
          const existingMark = studentData?.subjectMarks?.find(m => m.subjectId === subject.id);
          return {
            subjectId: subject.id,
            marks: Math.max(0, parseInt(existingMark?.marks) || 0), // Default to 0 if no value is provided
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
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6">Student Marks Management</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card p-6 rounded-lg shadow">
          {/* Year Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Academic Year
            </label>
            <select
              {...register("year", { required: true })}
              className="w-full p-2 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500"
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
          <div>
            <label className="block text-sm font-medium mb-1">
              Examination
            </label>
            <select
              {...register("examName", { required: true })}
              className="w-full p-2 text-input dark:bg-accent border rounded focus:ring-2 focus:ring-blue-500"
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
          <div>
            <label className="block text-sm font-medium mb-1">
              Class/Grade
            </label>
            <select
              {...register("level", { required: true })}
              className="w-full p-2 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500"
              disabled={!examName || loading.initial}
            >
              <option value="">Select Class</option>
              {examName &&
                classList[examList.indexOf(examName)]
                  ?.sort((a, b) => a - b)
                  .map((cls, index) => (
                    <option key={index} value={cls}>
                      Class {cls}
                    </option>
                  ))}
              {examName === "JSC" &&
                ["8"].map((cls, index) => (
                  <option key={index} value={cls}>
                    Class {cls}
                  </option>
                ))}
              {examName === "SSC" &&
                ["10"].map((cls, index) => (
                  <option key={index} value={cls}>
                    Class {cls}
                  </option>
                ))}
            </select>
          </div>

          {/* Department Select */}
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select
              {...register("department")}
              className="w-full p-2 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500"
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
          <div>
            <label className="block text-sm font-medium mb-1">Section</label>
            <select
              {...register("section")}
              className="w-full p-2 border  text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500"
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
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <select
              {...register("specific")}
              className="w-full p-2 border text-input dark:bg-accent rounded focus:ring-2 focus:ring-blue-500"
              disabled={!level || loading.initial}
            >
              <option value="0">All Subjects</option>
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

        {loading.marks ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => {
              // console.log("Student object:", student); // Debugging log
              return (
                <div
                  key={student.student_id}
                  className="p-6 rounded-lg dark:bg-gray-700 bg-gray-50 shadow space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold ">
                      {`${student.name} ${
                        student.department ? ` (${student.department})` : ""
                      }`}
                    </h2>
                    <div className="flex font-semibold items-center justify-center space-x-4">
                      <p className="text-sm ">
                        Section:{" "}
                        <span className="font-medium">
                          {student.section || "N/A"}
                        </span>
                      </p>
                      <p className="text-sm ">
                        Roll No:{" "}
                        <span className="font-medium">{student.roll}</span>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {examName !== "JSC" && examName !== "SSC" ? (
                      subjectsForClass
                        .filter((s) => !specific || s.id == specific) // Match specific subject if selected
                        .map((sub) => {
                          const studentSubject = marksData[
                            student.student_id //check
                          ]?.subjectMarks?.find((m) => m.subjectId === sub.id);
                          // console.log(sub);

                          if (
                            sub.department !== student.department &&
                            sub.department !== "" &&
                            sub.department !== null
                          )
                            return null;
                          return (
                            <div
                              key={sub.id}
                              className="flex justify-between items-center"
                            >
                              <label className="text-sm font-medium ">
                                {sub.name} - by {sub.teacher_name}:
                              </label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={studentSubject?.marks}
                                  onChange={(e) =>
                                    handleMarksChange(
                                      student.student_id,
                                      sub.id,
                                      e.target.value
                                    )
                                  }
                                  className="w-20 p-2 border dark:border-gray-400 border-gray-700 rounded focus:ring-2 focus:ring-blue-500 text-center"
                                />
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div
                        className="flex justify-between items-center"
                        key={student.student_id}
                      >
                        <label className="text-sm font-medium ">GPA:</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step={"0.01"}
                            min="0"
                            max="5"
                            value={gpaData[student.student_id]?.gpa}
                            onChange={(e) =>
                              handleGPAchange(
                                student.student_id,
                                e.target.value
                              )
                            }
                            className="w-20 p-2 border dark:border-gray-400 border-gray-700 rounded focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className=" p-8 rounded-lg dark:bg-accent bg-gray-50 shadow text-center">
            <p className="">
              {students.length === 0
                ? "No students found in the system"
                : "No students match the selected filters"}
            </p>
          </div>
        )}

        {filteredStudents.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
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
                "Save Marks"
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default AddMarks;
