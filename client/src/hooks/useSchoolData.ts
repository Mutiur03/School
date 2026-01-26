import type { NoticeItem, Syllabus } from "@/types";
import { QueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useRoutinePDF = (queryClient: QueryClient) => {
  return queryClient.fetchQuery({
    queryKey: ["routinePDF"],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/class-routine/pdf");
        return res?.data?.[0]?.pdf_url || null;
      } catch {
        return null;
      }
    },
  });
};

export const useSyllabuses = (queryClient: QueryClient) => {
  return queryClient.fetchQuery<Syllabus[]>({
    queryKey: ["syllabuses"],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/syllabus");
        return res.data;
      } catch {
        return [];
      }
    },
  });
};

export const useCitizenCharter = (queryClient: QueryClient) => {
  return queryClient.fetchQuery({
    queryKey: ["citizenCharter"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/file-upload/citizen-charter");
        return response.data.file || null;
      } catch {
        return null;
      }
    },
  });
};

export const useHeadMasterMsg = () => {
  return useQuery({
    queryKey: ["headMasterMsg"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/teachers/get_head_msg");
        return response?.data?.teacher?.image || null;
      } catch {
        return null;
      }
    },
  });
};

export const useNotices = (limit = 5) => {
  return useQuery({
    queryKey: ["notices", limit],
    queryFn: async () => {
      try {
        const response = await axios.get(
          `/api/notices/getNotices?limit=${limit}`,
        );
        return response.data;
      } catch {
        return [];
      }
    },
  });
};

export const useAllNotices = () => {
  return useQuery<NoticeItem[]>({
    queryKey: ["notices", "all"],
    queryFn: async () => {
      const response = await axios.get("/api/notices/getNotices");
      return response.data;
    },
  });
};
