import { api } from "@/lib/backend";
import { Head, Teacher } from "@/types";

export const fetchHeadMasterMsg = (async (): Promise<Head | null> => {
  return api
    .get<Head>("/api/teachers/head-message")
    .then((res) => res.data || null)
    .catch(() => null);
});
export const fetchTeachers = (async (): Promise<Teacher[]> => {
  return api
    .get<Teacher[]> ("/api/teachers")
    .then((res) => res?.data || [])
    .catch(() => []);
});
