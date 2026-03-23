import { z } from "zod";
import { SUBJECT_NAME, CLASS_NUM, VALID_GROUPS } from "./regex.js";

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
    group: z.string().trim().nullable().optional(),
    year: z.number().int().min(2000, "Year must be at least 2000"),
    subject_type: z.enum(["main", "paper", "single"]),
    subject_group: z.string().trim().nullable().optional(),
    parent_id: numericCoerce,
    assessment_type: z.enum(["exam", "continuous"]),
    marking_scheme: z.enum(["TOTAL", "BREAKDOWN"]).default("TOTAL"),
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

    // Group validation
    if (data.group && data.group.trim() !== "") {
      if (
        !VALID_GROUPS.includes(
          data.group as (typeof VALID_GROUPS)[number],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["group"],
          message: `Invalid group: ${data.group}. Allowed values: ${VALID_GROUPS.join(", ")}`,
        });
      }
    }

    // Parent ID is required for papers
    if (data.subject_type === "paper" && (!data.parent_id || Number(data.parent_id) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parent_id"],
        message: "Parent subject is required for paper subjects",
      });
    }

    // Pass mark cannot exceed full mark
    if (data.pass_mark !== null && data.full_mark !== null && Number(data.pass_mark) > Number(data.full_mark)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pass_mark"],
        message: `Pass mark (${data.pass_mark}) cannot exceed full mark (${data.full_mark})`,
      });
    }

    // Force BREAKDOWN for class 9 and 10
    const isClass9or10 = Number(data.class) === 9 || Number(data.class) === 10;
    const isBreakdown = data.marking_scheme === "BREAKDOWN" || isClass9or10;

    if (isClass9or10 && data.marking_scheme !== "BREAKDOWN") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["marking_scheme"],
        message: "Classes 9 and 10 must use BREAKDOWN marking scheme",
      });
    }

    // BREAKDOWN scheme specific validations
    if (isBreakdown && data.subject_type !== "main") {
      const cq = Number(data.cq_mark) || 0;
      const mcq = Number(data.mcq_mark) || 0;
      const practical = Number(data.practical_mark) || 0;
      
      const totalBreakdown = cq + mcq + practical;
      
      if (totalBreakdown === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cq_mark"],
          message: "At least one breakdown mark (CQ, MCQ, or Practical) must be non-zero for BREAKDOWN scheme",
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mcq_mark"],
          message: "REQUIRED",
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["practical_mark"],
          message: "REQUIRED",
        });
      }

      if (data.full_mark !== null && totalBreakdown > 0 && Number(data.full_mark) !== totalBreakdown) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["full_mark"],
          message: `Full mark (${data.full_mark}) must equal sum of CQ, MCQ, Practical (${totalBreakdown})`,
        });
      }

      // Check breakdown pass marks
      const cq_pass = Number(data.cq_pass_mark) || 0;
      const mcq_pass = Number(data.mcq_pass_mark) || 0;
      const practical_pass = Number(data.practical_pass_mark) || 0;

      if (cq_pass > cq) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cq_pass_mark"], message: `CQ Pass (${cq_pass}) cannot exceed CQ Mark (${cq})` });
      }
      if (mcq_pass > mcq) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mcq_pass_mark"], message: `MCQ Pass (${mcq_pass}) cannot exceed MCQ Mark (${mcq})` });
      }
      if (practical_pass > practical) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["practical_pass_mark"], message: `Practical Pass (${practical_pass}) cannot exceed Practical Mark (${practical})` });
      }

      const totalPass = cq_pass + mcq_pass + practical_pass;
      if (data.pass_mark !== null && totalPass > 0 && Number(data.pass_mark) !== totalPass) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pass_mark"],
          message: `Pass mark (${data.pass_mark}) must equal sum of breakdown pass marks (${totalPass})`,
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
