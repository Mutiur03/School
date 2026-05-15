import { api } from "@/lib/backend";
import { Head } from "@/types";
import { cache } from "react";

export const fetchHeadMasterMsg = cache(async (): Promise<Head | null> => {
  return api
    .get<Head>("/api/teachers/head-message")
    .then((res) => res.data || null)
    .catch(() => null);
});
