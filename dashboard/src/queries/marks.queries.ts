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
  fourth_subject_id?: number | null;
}

export interface SubjectMark {
  subjectId: number;
  cq_marks?: number | null;
  mcq_marks?: number | null;
  practical_marks?: number | null;
  marks?: number | null;
}

export interface MarksData {
  [studentId: number]: {
    subjectMarks: SubjectMark[];
  };
}

export interface StudentMarkResponse {
  student_id: number;
  roll: number;
  name: string;
  class: number;
  section?: string;
  group?: string;
  fourth_subject_id?: number | null;
  marks?: Array<{
    subject_id: number;
    subject: string;
    cq_marks: number | null;
    mcq_marks: number | null;
    practical_marks: number | null;
    marks: number | null;
    subject_info?: {
      full_mark: number;
      cq_mark: number;
      mcq_mark: number;
      practical_mark: number;
      marking_scheme: string;
    };
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

export const useStudentMarks = (studentId: number | undefined, year: number, examName: string) => {
  return useQuery({
    queryKey: ["student-marks", studentId, year, examName],
    queryFn: async () => {
      if (!studentId || !year || !examName) return null;
      const response = await axios.get(
        `/api/marks/getMarks/${studentId}/${year}/${examName}`
      );
      return response.data?.data || [];
    },
    enabled: !!studentId && !!year && !!examName,
  });
};

export const useStudentPreview = (studentId: number | undefined, year: number) => {
  return useQuery({
    queryKey: ["student-preview", studentId, year],
    queryFn: async () => {
      if (!studentId || !year) return null;
      const response = await axios.get(
        `/api/marks/${studentId}/${year}/preview`
      );
      return response.data?.data || [];
    },
    enabled: !!studentId && !!year,
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

export const useUpdateFourthSubjectMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      studentId: number;
      year: number;
      subjectId: number | null;
    }) => {
      const response = await axios.post("/api/marks/update-fourth-subject", data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["class-marks"] });
      queryClient.invalidateQueries({ queryKey: ["marks-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-preview"] });
      toast.success(data.message || "4th subject updated successfully");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || "Failed to update 4th subject"
      );
    },
  });
};
