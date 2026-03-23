import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useLevels = () => {
  return useQuery({
    queryKey: ["levels"],
    queryFn: async () => {
      const response = await axios.get("/api/level/getLevels");
      return response.data;
    },
  });
};
