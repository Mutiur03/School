import { z } from 'zod';

export const examTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  is_year_end: z.boolean().optional().default(false),
  sort_order: z.coerce.number().int().optional().default(0),
  assign_to_new_schools: z.boolean().optional().default(false),
  school_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export type ExamTypeSchemaData = z.infer<typeof examTypeSchema>;

export const schoolExamTypesSchema = z.object({
  exam_type_ids: z.array(z.coerce.number().int().positive()),
});

export const createExamSchema = z.object({
  exam_type_id: z.coerce.number().int().positive('Exam type is required'),
  exam_year: z.coerce.number().int().min(2000).max(2100),
  levels: z.array(z.coerce.number().int().min(1).max(12)).min(1, 'Select at least one class'),
  start_date: z.string().trim().min(1, 'Start date is required'),
  end_date: z.string().trim().min(1, 'End date is required'),
  result_date: z.string().trim().min(1, 'Result date is required'),
  return_date: z.string().trim().optional(),
});

export const addExamsSchema = z.object({
  exams: z.array(createExamSchema).min(1, 'At least one exam is required'),
});

export type CreateExamSchemaData = z.infer<typeof createExamSchema>;
