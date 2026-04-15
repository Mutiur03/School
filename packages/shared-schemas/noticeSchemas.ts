import { z } from "zod";

export const noticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required"),
  file: z.any().optional(),
  created_at: z.string().optional(),
});

export type NoticeFormData = z.infer<typeof noticeSchema>;
