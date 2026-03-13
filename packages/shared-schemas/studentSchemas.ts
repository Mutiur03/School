import { z } from "zod";
import {
  isValidDob,
  normalizeText,
  normalizeOptionalText,
  normalizeDob,
} from "./utils.js";
import {
  NAME,
  PHONE_NUMBER,
  ROLL_NUMBER,
  SECTION,
  ADDRESS_TEXT,
  CLASS_NUM,
  LOGIN_ID,
  VALID_DEPARTMENTS,
  RELIGION,
} from "./regex.js";

export const studentLoginSchema = z.object({
  login_id: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => val.trim().length > 0, { message: "Login ID is required" })
    .refine((val) => LOGIN_ID.test(val), {
      message: "Login ID must be exactly 5 digits",
    }),

  password: z.string().min(1, "Password is required"),
});

export type StudentLoginData = z.infer<typeof studentLoginSchema>;

export const studentFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .min(2, "Name must be at least 2 characters")
      .regex(NAME, "Enter a valid name (letters and basic punctuation only)"),
    father_name: z
      .string()
      .trim()
      .min(1, "Father name is required")
      .min(2, "Father name must be at least 2 characters")
      .regex(NAME, "Enter a valid father name"),
    mother_name: z
      .string()
      .trim()
      .min(1, "Mother name is required")
      .min(2, "Mother name must be at least 2 characters")
      .regex(NAME, "Enter a valid mother name"),
    father_phone: z
      .string()
      .trim()
      .min(1, "Father phone is required")
      .min(1, "Father phone is required")
      .regex(PHONE_NUMBER, "Father phone must be 11 digits and start with 01"),
    mother_phone: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || PHONE_NUMBER.test(value), {
        message: "Mother phone must be 11 digits and start with 01",
      }),
    roll: z
      .string()
      .trim()
      .min(1, "Roll is required")
      .regex(ROLL_NUMBER, "Roll must be a number between 1 and 999999"),
    section: z
      .string()
      .trim()
      .min(1, "Section is required")
      .regex(SECTION, "Section must be a single letter (A-Z)"),
    village: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || ADDRESS_TEXT.test(value), {
        message: "Enter a valid village",
      }),
    post_office: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || ADDRESS_TEXT.test(value), {
        message: "Enter a valid post office",
      }),
    upazila: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || ADDRESS_TEXT.test(value), {
        message: "Enter a valid upazila",
      }),
    district: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || ADDRESS_TEXT.test(value), {
        message: "Enter a valid district",
      }),
    religion: z.enum(RELIGION).or(z.literal("")),
    dob: z
      .string()
      .trim()
      .min(1, "Date of birth is required")
      .refine(isValidDob, "Invalid date of birth"),
    class: z
      .string()
      .trim()
      .min(1, "Class is required")
      .regex(CLASS_NUM, "Class must be between 1 and 10"),
    department: z.string().trim(),
    has_stipend: z.boolean(),
    available: z.boolean(),
    image: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.religion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["religion"],
        message: "Religion is required",
      });
    }
    const classNumber = Number(value.class);
    if (
      (classNumber === 9 || classNumber === 10) &&
      !VALID_DEPARTMENTS.includes(
        value.department as (typeof VALID_DEPARTMENTS)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["department"],
        message: "Department is required for class 9-10",
      });
    }
  });

export type StudentFormSchemaData = z.infer<typeof studentFormSchema>;

export const addStudentInputSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Invalid student name format",
      }),
    father_name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Valid father name is required",
      }),
    mother_name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Valid mother name is required",
      }),
    father_phone: z
      .any()
      .refine(
        (value) => typeof value === "string" && PHONE_NUMBER.test(value),
        {
          message: "Father phone must be 11 digits and start with 01",
        },
      ),
    mother_phone: z
      .any()
      .optional()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || PHONE_NUMBER.test(value), {
        message: "Mother phone must be 11 digits and start with 01",
      }),
    village: z
      .any()
      .optional()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid village format",
      }),
    post_office: z
      .any()
      .optional()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid post office format",
      }),
    upazila: z
      .any()
      .optional()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid upazila format",
      }),
    district: z
      .any()
      .optional()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid district format",
      }),
    dob: z
      .any()
      .transform(normalizeDob)
      .refine((value) => isValidDob(value), {
        message: "Valid date of birth is required",
      }),
    has_stipend: z
      .any()
      .optional()
      .transform((value) => Boolean(value)),
    class: z.coerce.number().int().min(1).max(12),
    roll: z.coerce.number().int().min(1).max(999999),
    section: z
      .any()
      .transform((value) => normalizeText(value).toUpperCase())
      .refine((value) => SECTION.test(value), {
        message: "Section must be a single letter",
      }),
    department: z.any().optional().transform(normalizeOptionalText),
    religion: z.string().trim().min(1, "Religion is required"),
    year: z.coerce.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.class === 9 || value.class === 10) &&
      !VALID_DEPARTMENTS.includes(
        (value.department || "") as (typeof VALID_DEPARTMENTS)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["department"],
        message: "Department is required for class 9-10",
      });
    }
  });

export const addStudentsRequestSchema = z.object({
  students: z
    .array(addStudentInputSchema)
    .min(1, "Students must be an array with at least one element.")
    .max(500, "Maximum 500 students allowed per upload."),
});

export const deleteStudentsBulkRequestSchema = z.object({
  studentIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "At least one student ID is required")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate student IDs are not allowed",
    }),
});

export const rotatePasswordsBulkRequestSchema = deleteStudentsBulkRequestSchema;

export const updateStudentSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Invalid student name format",
      }),
    father_name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Invalid father name format",
      }),
    mother_name: z
      .string()
      .transform(normalizeText)
      .refine((value) => NAME.test(value), {
        message: "Invalid mother name format",
      }),
    father_phone: z
      .any()
      .refine(
        (value) => typeof value === "string" && PHONE_NUMBER.test(value),
        {
          message: "Invalid father phone",
        },
      ),
    mother_phone: z
      .any()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || PHONE_NUMBER.test(value), {
        message: "Invalid mother phone",
      }),
    dob: z
      .any()
      .transform(normalizeDob)
      .refine((value) => isValidDob(value), {
        message: "Invalid date of birth",
      }),
    village: z
      .any()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid village format",
      }),
    post_office: z
      .any()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid post office format",
      }),
    upazila: z
      .any()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid upazila format",
      }),
    district: z
      .any()
      .transform(normalizeOptionalText)
      .refine((value) => value === null || ADDRESS_TEXT.test(value), {
        message: "Invalid district format",
      }),
    has_stipend: z.any().transform((value) => Boolean(value)),
    available: z.any().transform((value) => Boolean(value)),
    religion: z.string().trim().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No valid fields to update",
  });

export const updateAcademicSchema = z
  .object({
    class: z.coerce.number().int().min(1).max(12),
    roll: z.coerce.number().int().min(1),
    section: z
      .any()
      .transform((value) => normalizeText(value).toUpperCase())
      .refine((value) => SECTION.test(value), {
        message: "Section must be a single letter (A-Z).",
      }),
    department: z.any().transform(normalizeOptionalText),
    year: z.coerce.number().int(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No valid academic fields provided",
  });

export const enrollmentIdParamSchema = z.coerce.number().int().positive();
export const yearParamSchema = z.object({ year: z.coerce.number().int() });
export const classStudentsParamSchema = z.object({
  year: z.coerce.number().int(),
  level: z.coerce.number().int(),
});

export const studentPasswordResetRequestSchema = z.object({
  login_id: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => val.trim().length > 0, { message: "Login ID is required" })
    .refine((val) => LOGIN_ID.test(val), {
      message: "Login ID must be exactly 5 digits",
    }),
});

export const studentPasswordResetCodeVerifySchema = z.object({
  login_id: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => val.trim().length > 0, { message: "Login ID is required" })
    .refine((val) => LOGIN_ID.test(val), {
      message: "Login ID must be exactly 5 digits",
    }),
  code: z
    .string()
    .length(6, "Reset code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Reset code must contain only numbers"),
});

export const studentPasswordUpdateSchema = z.object({
  login_id: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => val.trim().length > 0, { message: "Login ID is required" })
    .refine((val) => LOGIN_ID.test(val), {
      message: "Login ID must be exactly 5 digits",
    }),
  code: z
    .string()
    .length(6, "Reset code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Reset code must contain only numbers"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(100, "Password must be at most 100 characters")
    .refine((password) => {
      // Password strength validation
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);

      return hasUpperCase && hasLowerCase && hasNumbers;
    }, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
});

export type StudentPasswordResetRequestData = z.infer<
  typeof studentPasswordResetRequestSchema
>;
export type StudentPasswordResetCodeVerifyData = z.infer<
  typeof studentPasswordResetCodeVerifySchema
>;
export type StudentPasswordUpdateData = z.infer<
  typeof studentPasswordUpdateSchema
>;
