import { api } from "@/lib/backend";
import type { Staff } from "@/types";

export const fetchStaffs = async (): Promise<Staff[]> => {
  try {
    const response = await api.get<Staff[]>("/api/staffs", { revalidate: 60 });
    return response.data ?? [];
  } catch (error) {
    console.error("Error fetching staffs:", error);
    return [];
  }
};
