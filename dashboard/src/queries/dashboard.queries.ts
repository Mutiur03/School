import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

export type AttendanceRange = 7 | 15 | 30;

export const ATTENDANCE_RANGES: AttendanceRange[] = [7, 15, 30];

export interface AttendanceDataPoint {
  name: string;
  present: number;
  absent: number;
  run_awayed: number;
  sort_date: string;
}

export interface DashboardOverview {
  quickStats: {
    students: number;
    teachers: number;
    events: number;
  };
  announcements: {
    id: number;
    title: string;
    content: string;
    date: string;
    url: string;
  }[];
  events: {
    id: number;
    title: string;
    date: string;
    location: string;
  }[];
  examSchedule: {
    name: string;
    start_date: string;
    end_date: string;
  }[];
}

export const useDashboardOverview = () =>
  useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => {
      const response = await axios.get("/api/dashboard");
      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to fetch dashboard data");
      }
      return response.data.data as DashboardOverview;
    },
  });

export const useDashboardAttendance = (days: AttendanceRange) =>
  useQuery({
    queryKey: ["dashboard", "attendance", days],
    queryFn: async () => {
      const response = await axios.get("/api/dashboard/attendance", {
        params: { attendanceDays: days },
      });
      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to fetch attendance data");
      }
      return response.data.data as AttendanceDataPoint[];
    },
    placeholderData: keepPreviousData,
  });
