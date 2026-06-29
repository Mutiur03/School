import type { Syllabus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useRoutinePDF = () => {
  return useQuery({
    queryKey: ["routinePDF"],
    enabled: false,
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

export const useSyllabuses = () => {
  return useQuery<Syllabus[]>({
    queryKey: ["syllabuses"],
    enabled: false,
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

export const useCitizenCharter = () => {
  return useQuery({
    queryKey: ["citizenCharter"],
    enabled: false,
    queryFn: async () => {
      try {
        const response = await axios.get("/api/citizen-charter");
        return response.data.file || null;
      } catch {
        return null;
      }
    },
  });
};
