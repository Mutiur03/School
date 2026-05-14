import { api } from "@/lib/backend";
import type { NoticeItem } from "@/types";

export const fetchNotices = async (limit?: number): Promise<NoticeItem[]> => {
  try {
    const response = await api.get<NoticeItem[]>("/api/notices/getNotices", {
      params: { limit },
      revalidate: 60,
    });
    return response.data || [];
  } catch (error) {
    console.error("Error fetching notices:", error);
    return [];
  }
};
