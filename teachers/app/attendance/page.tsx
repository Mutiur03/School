"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  roll: number;
  section: string;
  class: number;
  name?: string;
}

interface AttendanceRecord {
  date: string;
  studentId: string;
  status: 'present' | 'absent';
}

interface AttendanceData {
  [studentId: string]: {
    [day: number]: 'present' | 'absent';
  };
}

interface AttendanceApiResponse {
  message: string;
  present: number;
  absent: number;
  sms: {
    successful: number;
    failed: number;
  };
}

function Attendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({});
  const [editableDays, setEditableDays] = useState<number[]>([]);
  const [visibleDays, setVisibleDays] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [classList, setClassList] = useState<number[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | "">("");

  const months: string[] = [
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
    const fetchStudents = async (): Promise<void> => {
      try {
        const response = await axios.get<{ data: Student[] }>(
          `/api/students/getStudents/${selectedYear}`
        );
        const students = response.data.data
          .sort((a: Student, b: Student) => a.roll - b.roll)
          .sort((a: Student, b: Student) => a.section.localeCompare(b.section));
        setClassList([...new Set(students.map((student: Student) => student.class))]);
        setStudents(students || []);
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    };

    const fetchAttendance = async (): Promise<void> => {
      try {
        const response = await axios.get<AttendanceRecord[]>(`/api/attendance/getAttendence`);
        const attendanceMap: AttendanceData = {};
        response.data.forEach((record: AttendanceRecord) => {
          const date = new Date(record.date);
          const day = date.getDate();
          const month = date.getMonth();
          const year = date.getFullYear();
          if (month === selectedMonth && year === selectedYear) {
            if (!attendanceMap[record.studentId]) {
              attendanceMap[record.studentId] = {};
            }
            attendanceMap[record.studentId][day] = record.status;
          }
        });
        setAttendanceData(attendanceMap);
      } catch (error) {
        console.error("Error fetching attendance:", error);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchStudents();
    fetchAttendance();
    setVisibleDays([currentDay]);
    setEditableDays([]);
  }, [currentDay, selectedMonth, selectedYear]);

  const getDaysInMonth = (month: number, year: number): number =>
    new Date(year, month + 1, 0).getDate();


  const toggleVisibleDay = (day: number): void => {
    setVisibleDays((prev: number[]) =>
      prev.includes(day) ? prev.filter((d: number) => d !== day) : [...prev, day]
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

  const handleAttendanceChange = (studentId: string, day: number, isChecked: boolean): void => {
    if (isEditable(day)) {
      const updatedAttendance: AttendanceData = { ...attendanceData };
      if (!updatedAttendance[studentId]) {
        updatedAttendance[studentId] = {};
      }
      updatedAttendance[studentId][day] = isChecked ? "present" : "absent";
      setAttendanceData(updatedAttendance);
    }
  };

  const getAttendanceStatus = (studentId: string, day: number): string => {
    console.log("Attendance Data:", attendanceData[studentId]?.[day]);
    return attendanceData[studentId]?.[day] || "";
  };

  const resetFilters = (): void => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
    setVisibleDays([currentDay]);
    setEditableDays([]);
  };

  const saveAttendance = async (): Promise<void> => {
    try {
      setSaving(true);
      const allEditableDays: number[] = [
        ...(selectedMonth === currentMonth && selectedYear === currentYear
          ? [currentDay]
          : []),
        ...editableDays,
      ];
      const attendanceRecords: AttendanceRecord[] = [];
      students
        .filter((student: Student) => student.class === selectedClass)
        .forEach((student: Student) => {
          allEditableDays.forEach((day: number) => {
            attendanceRecords.push({
              studentId: student.id,
              date: `${selectedYear}-${selectedMonth + 1}-${day}`,
              status: attendanceData[student.id]?.[day] || "absent",
            });
          });
        });

      const data: AttendanceApiResponse = await axios
        .post<AttendanceApiResponse>("/api/attendance/addAttendence", {
          records: attendanceRecords,
        })
        .then((res) => res.data);

      alert(
        `${data.message}\nPresent: ${data.present}\nAbsent: ${data.absent}\nSMS Success: ${data.sms.successful}\nSMS Failed: ${data.sms.failed}`
      );
    } catch (error) {
      console.error("Error saving attendance:", error);
      alert("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const addtovisible = (): void => {
    setVisibleDays(
      Array.from(
        { length: getDaysInMonth(selectedMonth, selectedYear) },
        (_: undefined, i: number) => i + 1
      )
    );
  };


  const resetvisible = (): void => {
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

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center">
        <select
          className="border rounded-lg text-input dark:bg-accent px-3 py-2 w-full md:w-auto"
          value={selectedMonth}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(parseInt(e.target.value))}
        >
          {months.map((month: string, index: number) => (
            <option key={month} value={index}>
              {month}
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2  text-input dark:bg-accent w-full md:w-auto"
          value={selectedYear}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedYear(parseInt(e.target.value))}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((year: number) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <Button onClick={resetFilters} variant={"outline"}>
          Reset
        </Button>
      </div>

      {/* Day Toggles */}
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
              className={"bg-green-500 text-white hover:bg-green-600"}
            >
              Select All
            </Button>
            <Button variant={"outline"} onClick={resetvisible}>
              Reset
            </Button>
          </div>
        </div>

        {/* <div>
          <p className="font-semibold mb-1">Toggle Editable Days:</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              { length: getDaysInMonth(selectedMonth, selectedYear) },
              (_, i) => i + 1
            ).map((day) => (
              <button
                key={day}
                onClick={() => {
                  toggleEditableDay(day);
                  setVisibleDays((prev) => [...new Set([...prev, day])]);
                }}
                className={`px-2 py-1 text-sm border rounded-md ${
                  isEditable(day) ? "bg-sky-500 text-white" : ""
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={addtoeditable}>Select All</Button>
            <Button variant={"outline"} onClick={reseteditable}>
              Reset
            </Button>
          </div>
        </div> */}
      </div>

      {/* Class Selection */}
      <div className="mb-4">
        <select
          className="border rounded-md text-input dark:bg-accent px-3 py-2 w-full md:w-auto"
          value={selectedClass}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedClass(parseInt(e.target.value))}
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

      {/* Attendance Table */}
      {loading ? (
        <p>Loading attendance data...</p>
      ) : (
        <>
          <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border divide-y divide-gray-200">
                <thead className="bg-popover">
                  <tr>
                    <th className=" min-w-12.5  px-4 py-2 text-left sticky top-0  z-10">
                      Section
                    </th>
                    <th className=" min-w-12.5  px-4 py-2 text-left sticky top-0  z-10">
                      Roll
                    </th>
                    <th className=" min-w-37.5  px-4 py-2 text-left sticky top-0  z-10">
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
                            className={` min-w-12.5  px-3 py-2 text-center sticky top-0 z-10 ${isEditable(day) ? "" : "opacity-50"
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
                        <tr key={student.id} className="">
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
                                className={`px-3 py-2 text-center ${isEditable(day) ? "" : ""
                                  }`}
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
                                    className={` ${getAttendanceStatus(student.id, day) ===
                                      "present"
                                      ? "text-green-600"
                                      : "text-red-600"
                                      }`}
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

          {/* Save Button */}
          {(selectedMonth === currentMonth && selectedYear === currentYear) ||
            editableDays.length > 0 ? (
            <Button
              onClick={saveAttendance}
              disabled={saving}
              className={`mt-4 `}
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
