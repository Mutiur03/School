import axios from "axios";
import React, { useEffect, useState } from "react";
function AlumniList() {
  let [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  useEffect(() => {
    const getStudentList = async () => {
      try {
        console.log("Fetching students...");
        const response = await axios.get(
          "/api/students/getAlumni"
        );
        console.log(response.data);
        setStudents(response.data || []);
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    };
    getStudentList();
  }, []);
  const batchToClass = (batch) => {
    return batch;
  };
  students = students.filter(
    (student) =>
      student.batch < new Date().getFullYear() 
  );
  const filteredStudents = students
    .filter(
      (student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone.toString().includes(searchQuery)
    )
    .filter((student) =>
      batchFilter ? student.batch === (batchFilter) : true
    )
    .filter(
      (student) =>
        student.batch < new Date().getFullYear()
    )
    .sort((a, b) => a.batch - b.batch);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Student List</h1>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search students..."
        className="border rounded-lg px-3 py-2 mb-4 w-full"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Filter Options */}
      <div className="flex gap-4 mb-4">
        <select
          className="border rounded-lg px-3 py-2"
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
        >
          <option value="">All Batches</option>
          {[...new Set(students.map((s) => s.batch))]
            .sort((a, b) => b - a)
            .map((batch) => (
              <option key={batch} value={batch}>
                {batchToClass(batch)}
              </option>
            ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="">All Sections</option>
          {[...new Set(students.map((s) => s.section))].map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      </div>

      {filteredStudents.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Name
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Phone
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Roll
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Batch
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Section
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Address
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  DOB
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="even:bg-gray-100">
                  <td className="border border-gray-300 px-4 py-2">
                    {student.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {`0${student.phone}`}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {student.roll}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {batchToClass(student.batch)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {student.section}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {student.address}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {student.dob?.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No students found.</p>
      )}
    </div>
  );
}

export default AlumniList;
