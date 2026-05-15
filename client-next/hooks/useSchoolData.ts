import type { Head, Syllabus } from "@/types";
import { api } from "@/lib/backend";
import { cache } from "react";


export const fetchSyllabus = cache((): Promise<Syllabus[]> => {
  return api
    .get<Syllabus[]>("/api/syllabus")
    .then((res) => res.data)
    .catch(() => []);
});
type CitizenCharterResponse = {
  file: string | null;
};

export const fetchCitizenCharter = cache(async (): Promise<string | null> => {
  return api
    .get<CitizenCharterResponse>("/api/file-upload/citizen-charter")
    .then((res) => res.data.file)
    .catch(() => null);
});

export const fetchHeadMasterMsg = cache(async (): Promise<Head | null> => {
  return api
    .get<Head>("/api/teachers/head-message")
    .then((res) => res.data || null)
    .catch(() => null);
});
