import { cache } from "react";
import { api } from "@/lib/backend";
import type { NoticeItem } from "@/types";

/** Deduped per RSC request (TopBanner + NoticeBoard, etc.). */
export const fetchNotices = cache(async (limit?: number): Promise<NoticeItem[]> => {
  try {
    const response = await api.get<NoticeItem[]>("/api/notices/getNotices", {
      params: { limit },
      revalidate: 60,
    });
    return response.data || [];
  } catch (error) {
    console.warn(
      "Error fetching notices:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
});
