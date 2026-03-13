import type { Student } from "@/types/students";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

export type StudentsListMeta = {
  total: number;
  filtered: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type StudentsListResponse = {
  data: Student[];
  meta: StudentsListMeta;
};

export const useStudents = (params: {
  year: number;
  page: number;
  limit: number;
  level?: number;
  section?: string;
  religion?: string;
  search?: string;
}) => {
  const { year, page, limit, level, section, religion, search } = params;

  return useQuery<StudentsListResponse>({
    queryKey: ["students", year, { page, limit, level, section, religion, search }],
    queryFn: async () => {
      const response = await axios.get(`/api/students`, {
        params: { year, page, limit, level, section, religion, search },
      });

      const payload = response.data?.data as StudentsListResponse | undefined;
      const list = (payload?.data || []).filter(
        (student: Student) => student.class >= 1 && student.class <= 10,
      ) as Student[];

      const meta: StudentsListMeta = {
        total: payload?.meta?.total ?? 0,
        filtered: payload?.meta?.filtered ?? 0,
        page: payload?.meta?.page ?? page,
        limit: payload?.meta?.limit ?? limit,
        totalPages: payload?.meta?.totalPages ?? 0,
      };

      return { data: list, meta } satisfies StudentsListResponse;
    },
    placeholderData: keepPreviousData,
  });
};