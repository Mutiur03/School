import axios from "axios";
import { useEffect, useState } from "react";

interface Student {
  id: string;
  name: string;
  phone: number;
  roll: number;
  batch: number;
  section: string;
  address: string;
  dob?: string;
}

function AlumniList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  useEffect(() => {
    const getStudentList = async () => {
      try {
        const response = await axios.get("/api/students/getAlumni");
        setStudents(response.data || []);
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    };
    getStudentList();
  }, []);

  const currentYear = new Date().getFullYear();
  const alumniStudents = students.filter((student) => student.batch < currentYear);

  const filteredStudents = alumniStudents
    .filter(
      (student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone.toString().includes(searchQuery)
    )
    .filter((student) => (batchFilter ? student.batch === Number(batchFilter) : true))
    .sort((a, b) => a.batch - b.batch);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Student List</h1>

      <input
        type="text"
        placeholder="Search students..."
        className="border rounded-lg px-3 py-2 mb-4 w-full"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="flex gap-4 mb-4">
        <select
          className="border rounded-lg px-3 py-2"
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
        >
          <option value="">All Batches</option>
          {[...new Set(alumniStudents.map((s) => s.batch))]
            .sort((a, b) => b - a)
            .map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="">All Sections</option>
          {[...new Set(alumniStudents.map((s) => s.section))].map((section) => (
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
                <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Phone</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Roll</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Batch</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Section</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Address</th>
                <th className="border border-gray-300 px-4 py-2 text-left">DOB</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="even:bg-gray-100">
                  <td className="border border-gray-300 px-4 py-2">{student.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{`0${student.phone}`}</td>
                  <td className="border border-gray-300 px-4 py-2">{student.roll}</td>
                  <td className="border border-gray-300 px-4 py-2">{student.batch}</td>
                  <td className="border border-gray-300 px-4 py-2">{student.section}</td>
                  <td className="border border-gray-300 px-4 py-2">{student.address}</td>
                  <td className="border border-gray-300 px-4 py-2">{student.dob?.slice(0, 10)}</td>
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
