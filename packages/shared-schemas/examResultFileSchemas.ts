import { z } from 'zod';

/** Body of `PUT /exam-result-files/:examId/:class`: the R2 key returned by `upload-url` after the PUT. */
export const examResultFileSchema = z
  .object({
    key: z.string().trim().min(1, 'File key is required'),
    fileName: z.string().trim().min(1, 'File name is required').max(255),
  })
  .strict();

export type ExamResultFileData = z.infer<typeof examResultFileSchema>;
