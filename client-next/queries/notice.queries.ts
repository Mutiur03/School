import { api } from "@/lib/backend";
import { NoticeItem } from "@/types";

function normalizeNotices(payload: unknown): NoticeItem[] {
  if (!Array.isArray(payload)) return [];

  return payload.filter((item): item is NoticeItem => {
    if (!item || typeof item !== "object") return false;

    const notice = item as Partial<NoticeItem>;
    return (
      typeof notice.id === "number" &&
      typeof notice.title === "string" &&
      typeof notice.created_at === "string"
    );
  });
}

export const fetchNotices = async (limit?: number): Promise<NoticeItem[]> => {
  return api
    .get<NoticeItem[]>("/api/notices/getNotices", { params: { limit } })
    .then((res) => normalizeNotices(res.data))
    .catch(() => []);
};
