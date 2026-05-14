import { headers } from "next/headers";
import { NoticeItem } from "@/types";
const API_URL = process.env.API_URL;
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
  console.log("[fetchNotices SSR start]", { limit, API_URL });

  try {
    const incomingHeaders = await headers();
    const host = incomingHeaders.get("host");
    const forwardedProto = incomingHeaders.get("x-forwarded-proto");
    const protocol =
      forwardedProto || (host?.includes("localhost") ? "http" : "https");
    const origin = host ? `${protocol}://${host}` : undefined;
    const url = buildNoticesUrl(limit);
    if (!url) {
      console.error("[fetchNotices SSR missing API_URL]", {
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
      });
      return [];
    }

    console.log("[fetchNotices SSR request]", { url, origin });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      cache: "no-store",
    });
    const text = await response.text();

    console.log("[fetchNotices SSR response]", {
      url,
      status: response.status,
      ok: response.ok,
      bodyPreview: text.slice(0, 2000),
    });

    if (!response.ok) {
      return [];
    }

    const payload = JSON.parse(text) as unknown;
    const notices = normalizeNotices(payload);

    console.log("[fetchNotices SSR result]", {
      limit,
      rawIsArray: Array.isArray(payload),
      rawHasData: !!payload && typeof payload === "object" && "data" in payload,
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

export function buildNoticesUrl(limit?: number): string | null {
  if (!API_URL) return null;

  const params = new URLSearchParams();

  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return `${API_URL}/api/notices/getNotices${query}`;
}
