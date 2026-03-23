import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-hot-toast";

export interface Student {
  student_id: number;
  name: string;
  roll: number;
  section: string;
  class: number;
  group: string;
}

export interface SubjectMark {
  subjectId: number;
  cq_marks: number;
  mcq_marks: number;
  practical_marks: number;
  marks: number;
}

export interface MarksData {
  [studentId: number]: {
    subjectMarks: SubjectMark[];
  };
}

export interface StudentMarkResponse {
  student_id: number;
  marks?: Array<{
    subject_id: number;
    cq_marks: number;
    mcq_marks: number;
    practical_marks: number;
    marks: number;
  }>;
}

export const useMarksStudents = (year: number, level: string) => {
  return useQuery<Student[]>({
    queryKey: ["marks-students", year, level],
    queryFn: async () => {
      if (!level) return [];
      const response = await axios.get("/api/marks/students", {
        params: { year, class: level },
      });
      return response.data?.data || [];
    },
    enabled: !!level,
  });
};

export const useClassMarks = (level: string, year: number, examName: string) => {
  return useQuery<StudentMarkResponse[]>({
    queryKey: ["class-marks", level, year, examName],
    queryFn: async () => {
      if (!level || !year || !examName) return [];
      const response = await axios.get(
        `/api/marks/getClassMarks/${level}/${year}/${examName}`
      );
      return response.data?.data || [];
    },
    enabled: !!level && !!year && !!examName,
  });
};

export const useAddMarksMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      students: any[];
      examName: string;
      year: number;
    }) => {
      const response = await axios.post("/api/marks/addMarks", data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["class-marks"] });
      toast.success(data.message || "Marks saved successfully");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || "Failed to save marks"
      );
    },
  });
};
