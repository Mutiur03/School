import { z } from "zod";

export const levelFormSchema = z.object({
  class_name: z.coerce.number().int().min(1, "Class is required").max(12, "Max class is 12"),
  section: z.string().min(1, "Section is required").max(10, "Section is too long"),
  year: z.coerce.number().int().min(2000).max(2100),
  teacher_id: z.coerce.number().int().min(1, "Teacher is required"),
});

export type LevelFormSchemaData = z.infer<typeof levelFormSchema>;
