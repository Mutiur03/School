import { api } from "@/lib/backend";
import { NoticeItem } from "@/types";

export const fetchNotices = async (limit?: number): Promise<NoticeItem[]> => {
  return api
    .get<NoticeItem[]>("/api/notices/getNotices", { params: { limit } })
    .then((res) => res.data || [])
    .catch(() => []);
};
