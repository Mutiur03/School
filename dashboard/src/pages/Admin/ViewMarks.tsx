import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import Loading from "@/components/Loading";

interface SubjectMark {
  subject: string;
  marks: number;
  cq_marks?: number;
  mcq_marks?: number;
  practical_marks?: number;
  subject_info?: {
    full_mark?: number;
    cq_mark?: number;
    mcq_mark?: number;
    practical_mark?: number;
  };
}

interface StudentData {
  student_id: string;
  roll: string;
  name: string;
  class: string;
  section?: string;
  department?: string;
  marks?: SubjectMark[];
}

interface ExamData {
  exam_name: string;
  exam_year: string;
  levels?: string[];
}

interface ClassList {
  [examName: string]: string[];
}

const ViewMarks = () => {
  const [marksData, setMarksData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState({
    initial: true,
    marks: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [year, setYear] = useState("2025");
  const [exam, setExam] = useState("");
  const [section, setSection] = useState("");
  const [department, setDepartment] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [examList, setExamList] = useState<string[]>([]);
  const [classList, setClassList] = useState<ClassList>({});
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading((prev) => ({ ...prev, initial: true }));

        const examsRes = await axios.get("/api/exams/getExams");
        const exams: ExamData[] = examsRes.data?.data || [];
        const currentYearExams = exams.filter((e) => e.exam_year == year);

        setExamList(currentYearExams.map((e) => e.exam_name));
        setClassList(
          currentYearExams.reduce((acc: ClassList, e) => {
            acc[e.exam_name] = e.levels || [];
            return acc;
          }, {})
        );
      } catch {
        toast.error("Failed to load exam data");
      } finally {
        setLoading((prev) => ({ ...prev, initial: false }));
      }
    };

    fetchInitialData();
  }, [year]);

  useEffect(() => {
    const fetchMarks = async () => {
      if (!className || !year || !exam) {
        setMarksData([]);
        setError(null);
        return;
      }

      try {
        setLoading((prev) => ({ ...prev, marks: true }));
        setError(null);

        const response = await axios.get(
          `/api/marks/getClassMarks/${className}/${year}/${exam}`
        );

        const data = response.data;
        if (!data.success) {
          setMarksData([]);
          setAvailableDepartments([]);
          setAvailableSections([]);
          return;
        }

        const marks: StudentData[] = Array.isArray(data.data) ? data.data : [];
        setMarksData(marks);

        if (marks.length === 0) {
          setError("No marks data available for the selected filters");
        } else {
          const allSubjects = new Set<string>();
          const sections = new Set<string>();
          const departments = new Set<string>();

          marks.forEach((student) => {
            student.marks?.forEach((subject) => {
              allSubjects.add(subject.subject);
            });
            if (student.section) sections.add(student.section);
            if (student.department) departments.add(student.department);
          });

          setSubjects(Array.from(allSubjects).sort());
          setAvailableSections(Array.from(sections).sort());
          setAvailableDepartments(Array.from(departments).sort());
        }
      } catch {
        setMarksData([]);
      } finally {
        setLoading((prev) => ({ ...prev, marks: false }));
      }
    };

    fetchMarks();
  }, [className, year, exam]);

  const handleExamChange = (selectedExam: string) => {
    setExam(selectedExam);
    if (subjects.length > 0) setSubjects([]);
    setAvailableSections([]);
    setClassName("");
    setSection("");
    setDepartment("");
    setMarksData([]);
    setAvailableDepartments([]);
  };

  const handleClassChange = (selectedClass: string) => {
    setClassName(selectedClass);
    setSection("");
    setDepartment("");
  };

  const downloadMarksheet = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const host = import.meta.env.VITE_BACKEND_URL;
    const url = `${host}/api/marks/markSheet/${id}/marks/${year}/${exam}/download`;
    window.open(url, "_blank");
  };

  const showStudentDetails = (student: StudentData) => {
    setSelectedStudent(student);
    setShowDetailsPopup(true);
  };

  const closeDetailsPopup = () => {
    setShowDetailsPopup(false);
    setSelectedStudent(null);
  };

  const filteredData = marksData.filter((student) => {
    const sectionMatch = !section || (student.section || "") === section;
    const deptMatch = !department || (student.department || "") === department;
    return sectionMatch && deptMatch;
  });

  if (error) return <p className="text-center mt-4 text-red-500">{error}</p>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">
        {className
          ? `Marks for Class ${className}, Year ${year}, Exam: ${exam}`
          : "View Marks"}
      </h2>

      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <select
          className="border p-2 dark:bg-accent rounded-md"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <option key={i} value={2025 - i}>
              {2025 - i}
            </option>
          ))}
        </select>

        <select
          className="border p-2 dark:bg-accent rounded-md"
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

        <select
          className="border p-2 dark:bg-accent rounded-md"
          value={className}
          onChange={(e) => handleClassChange(e.target.value)}
          disabled={!exam}
        >
          <option value="">Select Class</option>
          {(classList[exam] || []).map((cls, index) => (
            <option key={index} value={cls}>
              {`Class ${cls}`}
            </option>
          ))}
        </select>

        {availableSections.length > 0 && (
          <select
            className="border p-2 dark:bg-accent rounded"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            disabled={!className}
          >
            <option value="">All Sections</option>
            {availableSections.map((sec, index) => (
              <option key={index} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        )}

        {availableDepartments.length > 0 && (
          <select
            className="border dark:bg-accent p-2 rounded"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={!className}
          >
            <option value="">All Departments</option>
            {availableDepartments.map((dept, index) => (
              <option key={index} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr className="">
                <th className=" p-2 text-center">Roll</th>
                <th className=" p-2 text-center">Student Name</th>
                {subjects.map((subject) => (
                  <th
                    key={subject}
                    className=" p-2 text-center "
                    style={{ width: "100px" }}
                  >
                    {subject}
                  </th>
                ))}
                <th className=" p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading.marks ? (
                <tr>
                  <td colSpan={subjects.length + 3} className="text-center">
                    <div className="flex justify-center items-center py-4">
                      <Loading />
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={subjects.length + 3}
                    className="text-center   p-2"
                  >
                    {className && exam
                      ? "No students found"
                      : "Please select all filters"}
                  </td>
                </tr>
              ) : (
                filteredData.map((data) => {
                  const marksMap: { [key: string]: number } = {};
                  data.marks?.forEach((subject) => {
                    marksMap[subject.subject] = subject.marks;
                  });

                  return (
                    <tr key={data.student_id}>
                      <td className=" p-2 text-center">{data.roll}</td>
                      <td className=" p-2 text-center">{data.name}</td>
                      {subjects.map((subject) => (
                        <td
                          key={`${data.student_id}-${subject}`}
                          className=" p-2 text-center"
                        >
                          {marksMap[subject]}
                        </td>
                      ))}
                      <td className=" p-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                            onClick={() => showStudentDetails(data)}
                            title="Show Details"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Details
                          </button>
                          <button
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                            onClick={(e) =>
                              downloadMarksheet(data.student_id, e)
                            }
                            title="Download Marksheet"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailsPopup && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">
                Detailed Marks - {selectedStudent.name} (Roll:{" "}
                {selectedStudent.roll})
              </h3>
              <button
                onClick={closeDetailsPopup}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-2">
                  Student Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <strong>Name:</strong> {selectedStudent.name}
                  </div>
                  <div>
                    <strong>Roll:</strong> {selectedStudent.roll}
                  </div>
                  <div>
                    <strong>Class:</strong> {selectedStudent.class}
                  </div>
                  {selectedStudent.section && (
                    <div>
                      <strong>Section:</strong> {selectedStudent.section}
                    </div>
                  )}
                  {selectedStudent.department && (
                    <div>
                      <strong>Department:</strong> {selectedStudent.department}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-4">
                  Subject-wise Marks Details
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="border p-3 text-left">Subject</th>
                        <th className="border p-3 text-center">CQ Marks</th>
                        <th className="border p-3 text-center">MCQ Marks</th>
                        <th className="border p-3 text-center">
                          Practical Marks
                        </th>
                        <th className="border p-3 text-center">Total Marks</th>
                        <th className="border p-3 text-center">Full Marks</th>
                        <th className="border p-3 text-center">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(selectedStudent.marks) && selectedStudent.marks.length > 0 ? (
                        selectedStudent.marks.map((mark, index) => {
                          const percentage = mark.subject_info?.full_mark
                            ? (
                              (mark.marks / mark.subject_info.full_mark) *
                              100
                            ).toFixed(2)
                            : 0;

                          return (
                            <tr
                              key={index}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <td className="border p-3 font-medium">
                                {mark.subject}
                              </td>
                              <td className="border p-3 text-center">
                                {mark.cq_marks !== null &&
                                  mark.cq_marks !== undefined
                                  ? mark.cq_marks
                                  : "N/A"}
                                {mark.subject_info?.cq_mark && (
                                  <span className="text-xs text-gray-500 block">
                                    /{mark.subject_info.cq_mark}
                                  </span>
                                )}
                              </td>
                              <td className="border p-3 text-center">
                                {mark.mcq_marks !== null &&
                                  mark.mcq_marks !== undefined
                                  ? mark.mcq_marks
                                  : "N/A"}
                                {mark.subject_info?.mcq_mark && (
                                  <span className="text-xs text-gray-500 block">
                                    /{mark.subject_info.mcq_mark}
                                  </span>
                                )}
                              </td>
                              <td className="border p-3 text-center">
                                {mark.practical_marks !== null &&
                                  mark.practical_marks !== undefined
                                  ? mark.practical_marks
                                  : "N/A"}
                                {mark.subject_info?.practical_mark && (
                                  <span className="text-xs text-gray-500 block">
                                    /{mark.subject_info.practical_mark}
                                  </span>
                                )}
                              </td>
                              <td className="border p-3 text-center font-semibold">
                                {mark.marks !== null && mark.marks !== undefined
                                  ? mark.marks
                                  : "N/A"}
                              </td>
                              <td className="border p-3 text-center">
                                {mark.subject_info?.full_mark || "N/A"}
                              </td>
                              <td className="border p-3 text-center">
                                <span
                                  className={`font-medium ${percentage && parseFloat(percentage) >= 80
                                    ? "text-green-600"
                                    : percentage &&
                                      parseFloat(percentage) >= 60
                                      ? "text-yellow-600"
                                      : percentage &&
                                        parseFloat(percentage) >= 40
                                        ? "text-orange-600"
                                        : "text-red-600"
                                    }`}
                                >
                                  {mark.marks !== null &&
                                    mark.marks !== undefined &&
                                    mark.subject_info?.full_mark
                                    ? `${percentage}%`
                                    : "N/A"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="border p-4 text-center text-gray-500"
                          >
                            No marks data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewMarks;
