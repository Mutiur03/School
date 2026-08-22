import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Student {
  id: string;
  name: string;
  class: number;
  section: string;
  group: string;
  status: 'Passed' | 'Failed' | 'Pending';
  fail_count: number;
}

function UpdateStatus() {
  const [students, setStudents] = useState<Student[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [classSection, setClassSection] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');

  const getStudentList = async () => {
    try {
      if (!year) {
        setErrorMessage('Year is required to fetch students.');
        return;
      }
      const response = await axios.get<{ data: Student[] }>('/api/students', {
        params: { year },
      });
      const filteredStudents = (response.data.data || []).filter(
        (student) => student.class >= 1 && student.class <= 10,
      );
      if (filteredStudents.length === 0) {
        setErrorMessage('No students found for the selected year.');
      } else {
        setErrorMessage('');
      }
      setStudents(filteredStudents);
    } catch (error) {
      setStudents([]);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setErrorMessage('No students found for the selected year.');
        return;
      }
      setErrorMessage('An error occurred while fetching students.');
    }
  };

  useEffect(() => {
    getStudentList();
  }, [year]);

  const handleStatusChange = async (studentId: string, newStatus: Student['status']) => {
    if (!newStatus) {
      toast.error('Status cannot be empty.');
      return;
    }
    try {
      await axios.put('/api/promotion/updateStatus', {
        id: studentId,
        status: newStatus,
      });
      toast.success('Status updated successfully!');
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, status: newStatus } : s)),
      );
    } catch {
      toast.error('Failed to update status. Please try again.');
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.class === parseInt(selectedClass) &&
      (classSection === '' || student.section === classSection) &&
      (group === '' || student.group === group),
  );

  return (
    <div className="p-5 font-sans">
      <h1 className="mb-5 text-center text-2xl font-semibold underline">Student Status</h1>
      <div className="mb-5 flex flex-wrap justify-center gap-4">
        <div>
          <label htmlFor="year" className="mb-1 block font-medium">
            Select Year:
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border-border dark:bg-accent w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label htmlFor="selectedClass" className="mb-1 block font-medium">
            Class:
          </label>
          <select
            id="selectedClass"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border-border dark:bg-accent w-full rounded-md border p-2"
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
          <label htmlFor="classSection" className="mb-1 block font-medium">
            Section:
          </label>
          <select
            id="classSection"
            value={classSection}
            onChange={(e) => setClassSection(e.target.value)}
            className="border-border dark:bg-accent w-full rounded-md border p-2"
            disabled={!selectedClass}
          >
            <option value="">All Sections</option>
            {['A', 'B'].map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>
        {parseInt(selectedClass) > 8 && (
          <div>
            <label htmlFor="group" className="mb-1 block font-medium">
              Group:
            </label>
            <select
              id="group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="border-border dark:bg-accent w-full rounded-md border p-2"
              disabled={!selectedClass}
            >
              <option value="">All Groups</option>
              {['Science', 'Humanities', 'Commerce'].map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {errorMessage && <p className="mb-5 text-center text-red-500">{errorMessage}</p>}
      <div className="overflow-hidden rounded-lg border border-gray-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-popover">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Fail Count</th>
                <th className="p-3 text-left">Change Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="p-3">{student.name || 'N/A'}</td>
                    <td className="p-3">
                      {student.status === 'Passed' && (
                        <span className="font-bold text-green-600">✔ Passed</span>
                      )}
                      {student.status === 'Failed' && (
                        <span className="font-bold text-red-600">✘ Failed</span>
                      )}
                      {student.status === 'Pending' && (
                        <span className="font-bold text-orange-500">⏳ Pending</span>
                      )}
                    </td>
                    <td className="p-3">{student.fail_count || 0}</td>
                    <td className="p-3">
                      <select
                        value={student.status || ''}
                        onChange={(e) =>
                          handleStatusChange(student.id, e.target.value as Student['status'])
                        }
                        className="border-border dark:bg-accent rounded-md border p-2"
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
                  <td colSpan={4} className="text-muted-foreground p-3 text-center">
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
