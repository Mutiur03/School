import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { Subject } from "@/types/subjects";
import { toast } from "react-hot-toast";

export const useSubjects = () => {
  return useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => {
      const response = await axios.get("/api/sub/getSubjects");
      return response.data.data;
    },
  });
};

export const useAddSubjects = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subjects: any[]) => {
      const response = await axios.post("/api/sub/addSubject", { subjects });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(data.message || "Subjects added successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Error adding subjects");
    },
  });
};

export const useUpdateSubject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, old_parent_id }: { id: number; data: any; old_parent_id?: number | null }) => {
      const response = await axios.put(`/api/sub/updateSubject/${id}`, {
        ...data,
        old_parent_id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Error updating subject");
    },
  });
};

export const useDeleteSubject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.delete(`/api/sub/deleteSubject/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Error deleting subject");
    },
  });
};
