import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export type Syllabus = {
  id: number;
  class: number;
  year: number;
  pdf_url: string;
  download_url: string;
  public_id: string;
  created_at: string;
};

export const useRoutinePDF = () => {
  return useQuery({
    queryKey: ["routinePDF"],
    queryFn: async () => {
      const res = await axios.get("/api/class-routine/pdf");
      return res?.data?.[0]?.pdf_url || null;
    },
  });
};

export const useSyllabuses = () => {
  return useQuery<Syllabus[]>({
    queryKey: ["syllabuses"],
    queryFn: async () => {
      const res = await axios.get("/api/syllabus");
      return res.data;
    },
  });
};

export const useCitizenCharter = () => {
  return useQuery({
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
      const response = await axios.get(
        `/api/notices/getNotices?limit=${limit}`,
      );
      return response.data;
    },
  });
};

export type NoticeItem = {
  id: number;
  title: string;
  created_at: string;
  download_url: string;
  file?: string;
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
