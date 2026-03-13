import { z } from "zod";
import { SUBJECT_NAME, CLASS_NUM, VALID_DEPARTMENTS } from "./regex.js";

export const subjectFormSchema = z
  .object({
    id: z.number().nullable(),
    name: z
      .string()
      .trim()
      .min(1, "Subject name is required")
      .regex(SUBJECT_NAME, "Enter a valid subject name"),
    class: z
      .string()
      .trim()
      .min(1, "Class is required")
      .regex(CLASS_NUM, "Class must be between 1 and 10"),
    full_mark: z
      .string()
      .trim()
      .min(1, "Full mark is required")
      .refine(
        (val) => !isNaN(Number(val)) && Number(val) > 0,
        "Full mark must be a positive number",
      ),
    pass_mark: z
      .string()
      .trim()
      .refine((val) => {
        if (val === "") return true;
        return !isNaN(Number(val)) && Number(val) >= 0;
      }, "Pass mark must be a non-negative number"),
    cq_mark: z.string().trim().optional(),
    mcq_mark: z.string().trim().optional(),
    practical_mark: z.string().trim().optional(),
    cq_pass_mark: z.string().trim().optional(),
    mcq_pass_mark: z.string().trim().optional(),
    practical_pass_mark: z.string().trim().optional(),
    department: z.string().trim().optional(),
    year: z.number().int().min(2000, "Year must be at least 2000"),
    subject_type: z.enum(["main", "paper", "single"]),
    parent_id: z.string().trim().optional(),
    assessment_type: z.enum(["exam", "continuous"]),
    priority: z
      .string()
      .trim()
      .refine(
        (val) => !isNaN(Number(val)) && Number(val) >= 0,
        "Priority must be a non-negative number",
      ),
  })
  .superRefine((data, ctx) => {
    const classNum = Number(data.class);
    if (
      data.assessment_type === "exam" &&
      data.subject_type !== "main" &&
      (!data.pass_mark || data.pass_mark.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pass_mark"],
        message: "Pass mark is required for exam subjects",
      });
    }

    // Full mark requirement for non-main subjects
    if (
      data.subject_type !== "main" &&
      (!data.full_mark ||
        data.full_mark.trim() === "" ||
        Number(data.full_mark) <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_mark"],
        message: "Full mark is required and must be positive",
      });
    }

    // Mark sum validation
    const cq = Number(data.cq_mark || 0);
    const mcq = Number(data.mcq_mark || 0);
    const practical = Number(data.practical_mark || 0);
    const totalProvided = cq + mcq + practical;

    if (
      totalProvided > 0 &&
      data.full_mark &&
      Number(data.full_mark) !== totalProvided
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
