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
    <div className="p-3 font-sans sm:p-5">
      <h1 className="mb-5 text-center text-xl font-semibold text-balance underline sm:text-2xl">
        Student Status
      </h1>
      <div className="mb-5 flex flex-col flex-wrap justify-center gap-3 sm:flex-row sm:gap-4">
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

      {filteredStudents.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No students available.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-100 shadow-sm lg:block">
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
                  {filteredStudents.map((student) => (
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
                      <td className="p-3 tabular-nums">{student.fail_count || 0}</td>
                      <td className="p-3">
                        <select
                          value={student.status || ''}
                          onChange={(e) =>
                            handleStatusChange(student.id, e.target.value as Student['status'])
                          }
                          className="border-border dark:bg-accent rounded-md border p-2"
                          aria-label={`Change status for ${student.name || 'student'}`}
                        >
                          <option value="">Select Status</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {filteredStudents.map((student) => (
              <li
                key={student.id}
                className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm font-semibold wrap-break-word">
                    {student.name || 'N/A'}
                  </p>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    Fails: {student.fail_count || 0}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {student.status === 'Passed' && (
                    <span className="text-sm font-bold text-green-600">✔ Passed</span>
                  )}
                  {student.status === 'Failed' && (
                    <span className="text-sm font-bold text-red-600">✘ Failed</span>
                  )}
                  {student.status === 'Pending' && (
                    <span className="text-sm font-bold text-orange-500">⏳ Pending</span>
                  )}
                </div>
                <label className="block space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">Change Status</span>
                  <select
                    value={student.status || ''}
                    onChange={(e) =>
                      handleStatusChange(student.id, e.target.value as Student['status'])
                    }
                    className="border-border dark:bg-accent w-full rounded-md border p-2.5 text-sm"
                  >
                    <option value="">Select Status</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default UpdateStatus;
