import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { uploadToR2 } from "@/lib/uploadToR2";

export interface Notice {
  id: string | number;
  title: string;
  file: string;
  created_at: string;
  download_url?: string;
}

export const useNotices = () => {
  return useQuery<Notice[]>({
    queryKey: ["notices"],
    queryFn: async () => {
      const response = await axios.get("/api/notices/getNotices");
      return response.data.data;
    },
  });
};

export const useAddNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; file: File; created_at?: string }) => {
      const key = await uploadToR2("/api/notices/presigned-url", data.file);

      // Save notice record to database
      const response = await axios.post("/api/notices/addNotice", {
        title: data.title,
        key,
        created_at: data.created_at,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice added successfully");
    },
    onError: (error: any) => {
      console.error("Error adding notice:", error);
      toast.error(error.response?.data?.error || "Error adding notice");
    },
  });
};

export const useUpdateNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: { title?: string; file?: File | null; created_at?: string } }) => {
      let key = undefined;
      if (data.file) {
        key = await uploadToR2("/api/notices/presigned-url", data.file);
      }

      const response = await axios.put(`/api/notices/updateNotice/${id}`, {
        title: data.title,
        key,
        created_at: data.created_at,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating notice:", error);
      toast.error(error.response?.data?.error || "Error updating notice");
    },
  });
};

export const useDeleteNotice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const response = await axios.delete(`/api/notices/deleteNotice/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Notice deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting notice:", error);
      toast.error(error.response?.data?.error || "Error deleting notice");
    },
  });
};
