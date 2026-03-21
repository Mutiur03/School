import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";


export const useAttendance = (params?: { month?: number; year?: number; level?: number; section?: string }) => {
  return useQuery({
    queryKey: ["attendance", params],
    queryFn: async () => {
      const response = await axios.get("/api/attendance/getAttendence", { params });
      return response.data;
    },
    enabled: !!params?.year && params?.month !== undefined && !!params?.level && !!params?.section,
  });
};

export const useAttendanceOverview = (params: { year: number; level?: number; section?: string }) => {
  return useQuery({
    queryKey: ["attendance-overview", params],
    queryFn: async () => {
      const response = await axios.get("/api/students/attendance-overview", { params });
      return response.data;
    },
    enabled: !!params.year && !!params.level && !!params.section,
  });
};

export const useAddAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (records: any[]) => {
      const response = await axios.post("/api/attendance/addAttendence", { records });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(data.message || "Attendance saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to save attendance");
    },
  });
};

export const useAttendanceStats = (params: { date: string; level: number; section: string; year: number }) => {
  return useQuery({
    queryKey: ["attendance-stats", params],
    queryFn: async () => {
      const response = await axios.get("/api/attendance/getStats", { params });
      return response.data;
    },
    enabled: !!params.date && !!params.level && !!params.section && !!params.year,
  });
};
