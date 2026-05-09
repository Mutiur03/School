"use client";

import { useEffect } from "react";
import type { NoticeItem } from "@/types";

type ClientNoticeDebugProps = {
  label: string;
  notices: NoticeItem[];
  backend?: string;
  limit?: number;
};

export function ClientNoticeDebug({
  label,
  notices,
  backend,
  limit,
}: ClientNoticeDebugProps) {
  useEffect(() => {
    const payload = {
      label,
      backend,
      limit,
      count: notices.length,
      notices,
    };

    console.group(`[notice-debug] ${label}`);
    console.log("summary", {
      backend,
      limit,
      count: notices.length,
      firstNotice: notices[0] ?? null,
    });
    console.table(
      notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        file: notice.file,
        created_at: notice.created_at,
      })),
    );
    console.log("raw", payload);
    console.groupEnd();

    if (!backend) {
      console.warn("[notice-debug] backend missing on client");
      return;
    }

    const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const url = `${backend}/api/notices/getNotices${query}`;

    fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        const text = await response.text();
        console.group(`[notice-debug] client fetch ${label}`);
        console.log("request", { url });
        console.log("response", {
          status: response.status,
          ok: response.ok,
          bodyPreview: text.slice(0, 2000),
        });
        console.groupEnd();
      })
      .catch((error) => {
        console.error(`[notice-debug] client fetch failed ${label}`, {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [backend, label, limit, notices]);

  return null;
}
