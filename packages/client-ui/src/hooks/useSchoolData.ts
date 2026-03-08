import type { Head, NoticeItem, Syllabus } from "@/types";
import { QueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ApiResponse } from "@school/shared-schemas";

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
  return useQuery<Head>({
    queryKey: ["headMasterMsg"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/teachers/head-message");
        return response?.data.data || null;
      } catch {
        return null;
      }
    },
  });
};


export const useNotices = (limit?: number) => {
  return useQuery<NoticeItem[]>({
    queryKey: limit !== undefined ? ["notices", "limited", limit] : ["notices", "all"],
    queryFn: async () => {
      const url = limit !== undefined
        ? `/api/notices/getNotices?limit=${limit}`
        : "/api/notices/getNotices";
      const response = await axios.get(url);
      return response.data;
    },
  });
};
