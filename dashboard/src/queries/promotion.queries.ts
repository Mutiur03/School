import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-hot-toast";

export const useUpdatePromotionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotion/updateStatus/${year}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Status Generated Successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to generate result");
    },
  });
};

export const useGeneratePromotionRoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotion/addPromotion/${year}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(data.message || "Roll numbers generated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to generate roll numbers");
    },
  });
};
