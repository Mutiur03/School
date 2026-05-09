import { api } from "@/lib/backend";
import { NoticeItem } from "@/types";

function normalizeNotices(payload: unknown): NoticeItem[] {
  const candidate =
    payload &&
    typeof payload === "object" &&
    "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;

  if (!Array.isArray(candidate)) return [];

  return candidate.filter((item): item is NoticeItem => {
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
  console.log("[fetchNotices called]", { limit });

  try {
    const res = await api.get<NoticeItem[]>("/api/notices/getNotices", {
      params: { limit },
      cache: "no-store",
    });
    const notices = normalizeNotices(res.data);

    console.log("[fetchNotices result]", {
      limit,
      success: res.success,
      message: res.message,
      rawIsArray: Array.isArray(res.data),
      rawHasData:
        !!res.data && typeof res.data === "object" && "data" in res.data,
      count: notices.length,
    });

    return notices;
  } catch (error) {
    console.error("[fetchNotices error]", {
      limit,
      error: error instanceof Error ? error.message : String(error),
    });

    return [];
  }
};
