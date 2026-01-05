import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";

interface Student {
  id: number;
  name: string;
  roll: number;
  section: string;
  class: number;
}

interface AttendanceRecord {
  student_id: number;
  date: string;
  status: "present" | "absent";
}

interface AttendanceData {
  [studentId: number]: {
    [day: number]: "present" | "absent";
  };
}

interface SavedAttendanceRecord {
  studentId: number;
  date: string;
  status: string;
}

function Attendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({});
  const [editableDays, setEditableDays] = useState<number[]>([]);
  const [visibleDays, setVisibleDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classList, setClassList] = useState<number[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | "">("");

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [studentsResponse, attendanceResponse] = await Promise.all([
          axios
            .get(`/api/students/getStudents/${selectedYear}`)
            .catch((err) => {
              if (
                err.response?.status === 404 ||
                err.response?.data?.data?.length === 0
              ) {
                return { data: { data: [] } };
              }
              throw err;
            }),
          axios.get(`/api/attendance/getAttendence`).catch((err) => {
            if (
              err.response?.status === 404 ||
              err.response?.data?.length === 0
            ) {
              return { data: [] };
            }
            throw err;
          }),
        ]);

        const fetchedStudents: Student[] = (studentsResponse.data.data || [])
          .sort((a: Student, b: Student) => a.roll - b.roll)
          .sort((a: Student, b: Student) => a.section.localeCompare(b.section));
        setClassList([...new Set(fetchedStudents.map((student: Student) => student.class))] as number[]);
        setStudents(fetchedStudents);

        const attendanceMap: AttendanceData = {};
        const attendanceRecords: AttendanceRecord[] = attendanceResponse.data || [];
        attendanceRecords.forEach((record) => {
          const date = new Date(record.date);
          const day = date.getDate();
          const month = date.getMonth();
          const year = date.getFullYear();
          if (month === selectedMonth && year === selectedYear) {
            if (!attendanceMap[record.student_id]) {
              attendanceMap[record.student_id] = {};
            }
            attendanceMap[record.student_id][day] = record.status;
          }
        });
        setAttendanceData(attendanceMap);
      } catch (err) {
        console.error("Error fetching data:", err);
        const error = err as { response?: { status?: number } };
        if (!error.response || (typeof error.response.status === "number" && error.response.status >= 500)) {
          setError(
            "Failed to fetch students or attendance data. Please try again."
          );
        }
        setStudents([]);
        setAttendanceData({});
        setClassList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setVisibleDays([currentDay]);
    setEditableDays([]);
  }, [currentDay, selectedMonth, selectedYear]);

  const getDaysInMonth = (month: number, year: number): number =>
    new Date(year, month + 1, 0).getDate();

  const toggleVisibleDay = (day: number) => {
    setVisibleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const isEditable = (day: number): boolean =>
    (selectedMonth === currentMonth &&
      selectedYear === currentYear &&
      day === currentDay) ||
    editableDays.includes(day);

  const isVisible = (day: number): boolean =>
    (selectedMonth === currentMonth &&
      selectedYear === currentYear &&
      day === currentDay) ||
    visibleDays.includes(day);

  const handleAttendanceChange = (studentId: number, day: number, isChecked: boolean) => {
    if (isEditable(day)) {
      const updatedAttendance = { ...attendanceData };
      if (!updatedAttendance[studentId]) {
        updatedAttendance[studentId] = {};
      }
      updatedAttendance[studentId][day] = isChecked ? "present" : "absent";
      setAttendanceData(updatedAttendance);
    }
  };

  const getAttendanceStatus = (studentId: number, day: number): string => {
    return attendanceData[studentId]?.[day] || "";
  };

  const resetFilters = () => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
    setVisibleDays([currentDay]);
    setEditableDays([]);
  };

  const saveAttendance = async () => {
    try {
      setSaving(true);
      const allEditableDays = [
        ...(selectedMonth === currentMonth && selectedYear === currentYear
          ? [currentDay]
          : []),
        ...editableDays,
      ];
      const attendanceRecords: SavedAttendanceRecord[] = [];
      students
        .filter((student) => student.class === selectedClass)
        .forEach((student) => {
          allEditableDays.forEach((day) => {
            attendanceRecords.push({
              studentId: student.id,
              date: `${selectedYear}-${selectedMonth + 1}-${day}`,
              status: attendanceData[student.id]?.[day] || "absent",
            });
          });
        });

      const data = await axios
        .post("/api/attendance/addAttendence", {
          records: attendanceRecords,
        })
        .then((res) => res.data);

      alert(
        `${data.message}\nPresent: ${data.present}\nAbsent: ${data.absent}\nSMS Success: ${data.sms.successful}\nSMS Failed: ${data.sms.failed}`
      );
    } catch (err) {
      console.error("Error saving attendance:", err);
      alert("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const addtovisible = () => {
    setVisibleDays(
      Array.from(
        { length: getDaysInMonth(selectedMonth, selectedYear) },
        (_, i) => i + 1
      )
    );
  };

  const resetvisible = () => {
    setVisibleDays([currentDay]);
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">
        Attendance Management
      </h1>
      <p className="mb-4 text-sm sm:text-base">
        View and manage attendance records for students.
      </p>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center">
        <select
          className="border rounded-lg text-input dark:bg-accent px-3 py-2 w-full md:w-auto"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        >
          {months.map((month, index) => (
            <option key={month} value={index}>
              {month}
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2 text-input dark:bg-accent w-full md:w-auto"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <Button onClick={resetFilters} variant="outline">
          Reset
        </Button>
      </div>

      <div className="mb-4 space-y-4">
        <div>
          <p className="font-semibold mb-1">Toggle Visible Days:</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              { length: getDaysInMonth(selectedMonth, selectedYear) },
              (_, i) => i + 1
            ).map((day) => (
              <button
                key={day}
                onClick={() => toggleVisibleDay(day)}
                className={`px-2 py-1 text-sm border rounded-md ${isVisible(day) ? "bg-green-500 text-white" : ""
                  }`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={addtovisible}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Select All
            </Button>
            <Button variant="outline" onClick={resetvisible}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <select
          className="border rounded-md text-input dark:bg-accent px-3 py-2 w-full md:w-auto"
          value={selectedClass}
          onChange={(e) => setSelectedClass(parseInt(e.target.value))}
        >
          <option value="" disabled>
            Select Class
          </option>
          {classList.map((classItem) => (
            <option key={classItem} value={classItem}>
              Class {classItem}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-red-700 underline text-sm hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading attendance data...</p>
      ) : error ? (
        <p className="text-gray-500">
          Please resolve the error above to view attendance data.
        </p>
      ) : (
        <>
          <div className="rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border divide-y divide-gray-200">
                <thead className="bg-popover">
                  <tr>
                    <th className="min-w-[50px] px-4 py-2 text-left sticky top-0 z-10">
                      Section
                    </th>
                    <th className="min-w-[50px] px-4 py-2 text-left sticky top-0 z-10">
                      Roll
                    </th>
                    <th className="min-w-[150px] px-4 py-2 text-left sticky top-0 z-10">
                      Name
                    </th>
                    {selectedClass &&
                      Array.from(
                        { length: getDaysInMonth(selectedMonth, selectedYear) },
                        (_, i) => i + 1
                      )
                        .filter((day) => isVisible(day))
                        .map((day) => (
                          <th
                            key={day}
                            className={`min-w-[50px] px-3 py-2 text-center sticky top-0 z-10 ${isEditable(day) ? "" : "opacity-50"
                              }`}
                          >
                            {day}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!selectedClass && (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        Please select a class to view attendance.
                      </td>
                    </tr>
                  )}
                  {selectedClass &&
                    students
                      .filter((student) => student.class === selectedClass)
                      .map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-2">{student.section}</td>
                          <td className="px-4 py-2">{student.roll}</td>
                          <td className="px-4 py-2">{student.name}</td>
                          {Array.from(
                            {
                              length: getDaysInMonth(
                                selectedMonth,
                                selectedYear
                              ),
                            },
                            (_, i) => i + 1
                          )
                            .filter((day) => isVisible(day))
                            .map((day) => (
                              <td
                                key={day}
                                className="px-3 py-2 text-center"
                              >
                                {isEditable(day) ? (
                                  <input
                                    type="checkbox"
                                    checked={
                                      getAttendanceStatus(student.id, day) ===
                                      "present"
                                    }
                                    onChange={(e) =>
                                      handleAttendanceChange(
                                        student.id,
                                        day,
                                        e.target.checked
                                      )
                                    }
                                    className="w-4 h-4"
                                  />
                                ) : (
                                  <span
                                    className={
                                      getAttendanceStatus(student.id, day) ===
                                        "present"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {getAttendanceStatus(student.id, day)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {(selectedMonth === currentMonth && selectedYear === currentYear) ||
            editableDays.length > 0 ? (
            <Button
              onClick={saveAttendance}
              disabled={saving}
              className="mt-4"
            >
              {saving ? "Saving..." : "Save Attendance"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default Attendance;
