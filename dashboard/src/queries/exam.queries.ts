import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface Exam {
  id: number;
  exam_name: string;
  exam_year: number;
  levels: number[];
  visible: boolean;
  start_date?: string | null;
  result_date?: string | null;
}

export const useExams = () => {
  return useQuery<Exam[]>({
    queryKey: ["exams"],
    queryFn: async () => {
      const response = await axios.get("/api/exams/getExams");
      return response.data?.data || [];
    },
  });
};
