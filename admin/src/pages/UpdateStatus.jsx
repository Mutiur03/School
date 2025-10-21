import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function UpdateStatus() {
  const [students, setStudents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [classSection, setClassSection] = useState("");
  const [department, setDepartment] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const getStudentList = async () => {
    try {
      if (!year) {
        setErrorMessage("Year is required to fetch students.");
        return;
      }
      const response = await axios.get(`/api/students/getStudents/${year}`);
      console.log(response.data.data);
      const filteredStudents = (response.data.data || []).filter(
        (student) => student.class >= 1 && student.class <= 10
      );
      if (filteredStudents.length === 0) {
        setErrorMessage("No students found for the selected year.");
      } else {
        setErrorMessage("");
      }
      setStudents(filteredStudents);
    } catch (error) {
      setStudents([]);
      if (error.response && error.response.status === 404) {
        setErrorMessage("No students found for the selected year.");
        console.log(error);
        return;
      }
      setErrorMessage("An error occurred while fetching students.");
    }
  };

  useEffect(() => {
    getStudentList();
  }, [year]);

  const handleStatusChange = async (studentId, newStatus) => {
    if (!newStatus) {
      toast.error("Status cannot be empty.");
      return;
    }
    try {
      await axios.put(`/api/promotion/updateStatus`, {
        id: studentId,
        status: newStatus,
      });
      toast.success("Status updated successfully!");
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, status: newStatus } : s))
      );
    } catch {
      toast.error("Failed to update status. Please try again.");
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.class === parseInt(selectedClass) &&
      (classSection === "" || student.section === classSection) &&
      (department === "" || student.department === department)
  );

  return (
    <div className="font-sans p-5">
      <h1 className="text-center text-2xl font-semibold underline mb-5">
        Student Status
      </h1>
      <div className="mb-5 flex flex-wrap justify-center gap-4">
        <div>
          <label htmlFor="year" className="block font-medium mb-1">
            Select Year:
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="p-2 border border-gray-300 rounded-md dark:bg-accent w-full"
          />
        </div>
        <div>
          <label htmlFor="selectedClass" className="block font-medium mb-1">
            Class:
          </label>
          <select
            id="selectedClass"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="p-2 border border-gray-300 rounded-md dark:bg-accent w-full"
          >
            <option value="">Select Class</option>
            {[...Array(5).keys()].map((num) => (
              <option key={num + 6} value={num + 6}>
                {num + 6}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="classSection" className="block font-medium mb-1">
            Section:
          </label>
          <select
            id="classSection"
            value={classSection}
            onChange={(e) => setClassSection(e.target.value)}
            className="p-2 border border-gray-300 rounded-md dark:bg-accent w-full"
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
        {selectedClass > 8 && (
          <div>
            <label htmlFor="department" className="block font-medium mb-1">
              Department:
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="p-2 border border-gray-300 rounded-md dark:bg-accent w-full"
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
      {errorMessage && (
        <p className="text-center text-red-500 mb-5">{errorMessage}</p>
      )}
      <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr className="">
                <th className=" p-3 text-left">Name</th>
                <th className="  p-3 text-left">Status</th>
                <th className="  p-3 text-left">
                  Fail Count
                </th>
                <th className="p-3 text-left">
                  Change Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="">
                    <td className=" p-3">
                      {student.name || "N/A"}
                    </td>
                    <td className=" p-3">
                      {student.status === "Passed" && (
                        <span className="text-green-600 font-bold">
                          ✔ Passed
                        </span>
                      )}
                      {student.status === "Failed" && (
                        <span className="text-red-600 font-bold">✘ Failed</span>
                      )}
                      {student.status === "Pending" && (
                        <span className="text-orange-500 font-bold">
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                    <td className=" p-3">
                      {student.fail_count || 0}
                    </td>
                    <td className="p-3">
                      <select
                        value={student.status || ""}
                        onChange={(e) =>
                          handleStatusChange(student.id, e.target.value)
                        }
                        className="p-2 border border-gray-300 rounded-md dark:bg-accent "
                      >
                        <option value="">Select Status</option>
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="4"
                    className="p-3 text-center text-gray-500"
                  >
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
}

export default UpdateStatus;
