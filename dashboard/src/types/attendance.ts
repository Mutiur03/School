export type AttendanceStatus = "present" | "absent" | "run-awayed";

export interface AttendanceRecord {
  id: number;
  date: string;
  status: AttendanceStatus | string;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  runAwayed: number;
  total: number;
  attendanceRate: number | null;
}

export interface StudentAttendanceResponse {
  records: AttendanceRecord[];
  stats: AttendanceStats;
  month?: number;
  year: number;
}
