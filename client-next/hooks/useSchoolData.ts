import type { Head, Syllabus } from "@/types";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/backend";

export const useRoutinePDF = (queryClient: QueryClient) => {
  return queryClient.fetchQuery({
    queryKey: ["routinePDF"],
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ pdf_url?: string }>>(
          "/api/class-routine/pdf",
        );
        return res.data?.[0]?.pdf_url || null;
      } catch {
        return null;
      }
    },
  });
};

export const fetchSyllabus = (): Promise<Syllabus[]> => {
  return api
    .get<Syllabus[]>("/api/syllabus")
    .then((res) => res.data)
    .catch(() => []);
};
type CitizenCharterResponse = {
  file: string | null;
};

export const fetchCitizenCharter = async (): Promise<string | null> => {
  return api
    .get<CitizenCharterResponse>("/api/file-upload/citizen-charter")
    .then((res) => res.data.file)
    .catch(() => null);
};

export const fetchHeadMasterMsg = async (): Promise<Head | null> => {
  return api
    .get<Head>("/api/teachers/head-message")
    .then((res) => res.data || null)
    .catch(() => null);
};
