import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { SquareKanban, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  name: string;
  roll: number;
  section: string;
  class: number;
  department?: string;
  final_merit?: number;
  next_year_roll?: number;
  next_year_section?: string;
}

const GenerateResult = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  const [year, setYear] = useState<number>(currentYear);
  const [students, setStudents] = useState<Student[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [classSection, setClassSection] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  useEffect(() => {
    const storedYear = sessionStorage.getItem("generateResultYear");
    const storedClass = sessionStorage.getItem("generateResultClass");
    const storedSection = sessionStorage.getItem("generateResultSection");
    const storedDepartment = sessionStorage.getItem("generateResultDepartment");

    if (storedYear) setYear(Number(storedYear));
    if (storedClass) setSelectedClass(storedClass);
    if (storedSection) setClassSection(storedSection);
    if (storedDepartment) setDepartment(storedDepartment);
  }, []);

  const handleYearChange = (value: string) => {
    setYear(Number(value));
    sessionStorage.setItem("generateResultYear", value);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setDepartment("");
    setClassSection("");
    sessionStorage.setItem("generateResultClass", value);
  };

  const handleSectionChange = (value: string) => {
    setClassSection(value);
    sessionStorage.setItem("generateResultSection", value);
  };

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    sessionStorage.setItem("generateResultDepartment", value);
  };

  const handleGenerateResult = () => {
    axios
      .post(`/api/promotion/updateStatus/${year}`)
      .then(() => {
        getStudentList();
        toast.success("Status Generated Successfully");
      })
      .catch(() => {
        toast.error("Failed to generate result");
      });
  };

  const handleGenerateRoll = () => {
    if (!confirm("Are you sure you want to generate roll?")) return;
    if (
      !confirm(
        "This action will overwrite the existing roll numbers. You can't undone this action. Are you sure you want to continue?"
      )
    )
      return;
    axios
      .post(`/api/promotion/addPromotion/${year}`)
      .then((response) => {
        toast.success(response.data.message);
        getStudentList();
      })
      .catch(() => {
        toast.error("Failed to generate roll");
      });
  };

  const getStudentList = async () => {
    try {
      const response = await axios.get(`/api/students/getStudents/${year}`);
      const filtered = (response.data.data || []).filter(
        (s: Student) => s.class >= 1 && s.class <= 10
      );
      if (filtered.length === 0) {
        setErrorMessage("No students found for the selected year.");
      } else {
        setErrorMessage("");
      }
      setStudents(filtered);
    } catch (error) {
      setStudents([]);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setErrorMessage("No students found for the selected year.");
      } else {
        setErrorMessage("An error occurred while fetching students.");
      }
    }
  };

  useEffect(() => {
    getStudentList();
  }, [year]);

  const filteredStudents = students
    .filter(
      (s) =>
        s.class === parseInt(selectedClass) &&
        (!classSection || s.section === classSection) &&
        (!department || s.department === department)
    )
    .sort((a, b) => a.section.localeCompare(b.section) || a.roll - b.roll);

  const handleViewFinalMarksheet = (studentId: string) => {
    navigate(`/finalmarkSheet/${studentId}/${year}`);
  };

  const downloadAllMarksheetPDF = () => {
    const host = import.meta.env.VITE_BACKEND_URL;
    const url = `${host}/api/marks/all/${year}`;
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-7xl mx-auto font-sans">
      <div className="grid sm:grid-cols-2 gap-6 mt-10 bg-card text-card-foreground p-6 border rounded-xl shadow-md">
        <div>
          <label className="block font-semibold mb-2">
            Select Year to Generate Result:{" "}
            <span className="text-sm font-light">
              (This will generate the pass fand fail status. If want to
              customize then first generate then customize the status)
            </span>
          </label>
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full p-2 mb-4 border dark:bg-accent rounded-md"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={currentYear - i}>
                {currentYear - i}
              </option>
            ))}
          </select>
          <Button
            onClick={handleGenerateResult}
            className="w-full py-2 font-bold rounded-md"
          >
            Generate Result
          </Button>
        </div>
        <div>
          <label className="block font-semibold mb-2">
            Select Year to Generate Roll:{" "}
            <span className="text-sm font-light">
              (This will generate the roll for the next year according to the
              status)
            </span>
          </label>
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full p-2 mb-4 border dark:bg-accent rounded-md"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={currentYear - i}>
                {currentYear - i}
              </option>
            ))}
          </select>
          <Button
            onClick={handleGenerateRoll}
            className="w-full py-2 font-bold rounded-md"
          >
            Generate Roll
          </Button>
        </div>
      </div>

      <h1 className="text-center text-3xl sm:text-4xl font-semibold mt-12 mb-6">
        Marksheet Generation
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block mb-1 font-medium">Year:</label>
          <input
            type="number"
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="p-2 border dark:bg-accent rounded-md w-full"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className="p-2 border dark:bg-accent rounded-md w-full"
          >
            <option value="">Select Class</option>
            {[6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Section:</label>
          <select
            value={classSection}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="p-2 border dark:bg-accent rounded-md w-full"
            disabled={!selectedClass}
          >
            <option value="">All Sections</option>
            {["A", "B"].map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>
        {selectedClass > "8" && (
          <div>
            <label className="block mb-1 font-medium">Department:</label>
            <select
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="p-2 border dark:bg-accent rounded-md w-full"
              disabled={!selectedClass}
            >
              <option value="">All Departments</option>
              {["Science", "Arts", "Commerce"].map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={downloadAllMarksheetPDF}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md"
        >
          <Download className="w-4 h-4" />
          Download All PDFs
        </button>
      </div>

      {errorMessage && <p className="text-center mb-5">{errorMessage}</p>}

      <div className="rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Roll</th>
                <th className="p-3">Section</th>
                <th className="p-3">Merit</th>
                <th className="p-3">Next Roll</th>
                <th className="p-3">Next Section</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-center divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="p-3">{student.name || "N/A"}</td>
                    <td className="p-3">{student.roll || "N/A"}</td>
                    <td className="p-3">{student.section || "N/A"}</td>
                    <td className="p-3">{student.final_merit || "N/A"}</td>
                    <td className="p-3">{student.next_year_roll || "N/A"}</td>
                    <td className="p-3">{student.next_year_section || "N/A"}</td>
                    <td className="p-3 text-sky-500 text-center">
                      <button onClick={() => handleViewFinalMarksheet(student.id)}>
                        <SquareKanban className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-4 text-gray-500">
                    No students available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GenerateResult;
