import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { StaffListResponse } from "@/types/staff";

export const useStaff = (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const { page, limit, search } = params;

  return useQuery({
    queryKey: ["staff", { page, limit, search }],
    queryFn: async (): Promise<StaffListResponse> => {
      const response = await axios.get("/api/staffs", {
        params: {
          page,
          limit,
          search: search?.trim() || undefined,
        },
      });
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
};
