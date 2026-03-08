import type { Student } from "@/types/students";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useStudents = (year: number,level?: number) => {
 return useQuery({
     queryKey: ["students", year],
     queryFn: async () => {
       const response = await axios.get(`/api/students`, {
         params: { year, level },
       });
       return (response.data.data || []).filter(
         (student: Student) => student.class >= 1 && student.class <= 10
       ) as Student[];
     },
   });   
}