import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useTeacher = (params: { page?: number; limit?: number; search?: string }) => {
    const { page, limit, search } = params;
    return useQuery({
        queryKey: ["teachers", { page, limit, search }],
        queryFn: async () => {
          const response = await axios.get("/api/teachers", {
            params: { 
              page, 
              limit, 
              search: search?.trim() || undefined 
            },
          });
          return response.data.data;
        },
        placeholderData: keepPreviousData,
      });
};