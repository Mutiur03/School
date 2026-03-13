import { z } from "zod";
import { SUBJECT_NAME, CLASS_NUM, VALID_DEPARTMENTS } from "./regex.js";

// Helper for numeric fields that can be empty or null
const numericCoerce = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? val : num;
}, z.number().nullable().optional());

export const subjectFormSchema = z
  .object({
    id: z.number().nullable().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Subject name is required")
      .regex(SUBJECT_NAME, "Enter a valid subject name"),
    class: numericCoerce
      .pipe(z.number().min(1, "Class must be at least 1").max(12, "Class must be at most 12")),
    full_mark: numericCoerce
      .pipe(z.number().min(0, "Full mark must be non-negative").nullable()),
    pass_mark: numericCoerce
      .pipe(z.number().min(0, "Pass mark must be non-negative").nullable())
      .default(0),
    cq_mark: numericCoerce.default(0),
    mcq_mark: numericCoerce.default(0),
    practical_mark: numericCoerce.default(0),
    cq_pass_mark: numericCoerce.default(0),
    mcq_pass_mark: numericCoerce.default(0),
    practical_pass_mark: numericCoerce.default(0),
    department: z.string().trim().nullable().optional(),
    year: z.number().int().min(2000, "Year must be at least 2000"),
    subject_type: z.enum(["main", "paper", "single"]),
    subject_group: z.string().trim().nullable().optional(),
    parent_id: numericCoerce,
    assessment_type: z.enum(["exam", "continuous"]),
    priority: numericCoerce.default(0),
  })
  .superRefine((data, ctx) => {
    if (
      data.assessment_type === "exam" &&
      data.subject_type !== "main" &&
      (data.pass_mark === undefined || data.pass_mark === null || data.pass_mark < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pass_mark"],
        message: "Valid pass mark is required for exam subjects",
      });
    }

    // Full mark requirement for non-main subjects
    if (
      data.subject_type !== "main" &&
      (data.full_mark === undefined || data.full_mark === null || data.full_mark <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_mark"],
        message: "Full mark is required and must be positive",
      });
    }

    // Mark sum validation
    const cq = data.cq_mark || 0;
    const mcq = data.mcq_mark || 0;
    const practical = data.practical_mark || 0;
    const totalProvided = cq + mcq + practical;

    if (
      totalProvided > 0 &&
      data.full_mark !== undefined &&
      data.full_mark !== totalProvided
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_mark"],
        message: `Full mark (${data.full_mark}) must be equal to sum of CQ (${cq}), MCQ (${mcq}), and Practical (${practical}) = ${totalProvided}`,
      });
    }

    // Department validation
    if (data.department && data.department.trim() !== "") {
      if (
        !VALID_DEPARTMENTS.includes(
          data.department as (typeof VALID_DEPARTMENTS)[number],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["department"],
          message: `Invalid department: ${data.department}. Allowed values: ${VALID_DEPARTMENTS.join(", ")}`,
        });
      }
    }
  });

export type SubjectFormSchemaData = z.infer<typeof subjectFormSchema>;

export const addSubjectsSchema = z.object({
  subjects: z.array(subjectFormSchema).min(1, "At least one subject is required"),
});

export const updateSubjectSchema = subjectFormSchema.extend({
  old_parent_id: z.coerce.number().optional(),
});
