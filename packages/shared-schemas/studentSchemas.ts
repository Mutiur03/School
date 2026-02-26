import { z } from "zod";

export const GLOBAL_REGEX = {
  NAME: /^[A-Za-z][A-Za-z .'-]{1,98}[A-Za-z.]$/,
  PHONE_BD: /^01\d{9}$/,
  CLASS_NUM: /^(?:[1-9]|10)$/,
  SECTION: /^[A-Z]$/,
  ROLL_NUM: /^\d{1,3}$/,
  ADDRESS_TEXT: /^[A-Za-z0-9 .,'()/-]{2,100}$/,
} as const;

export const VALID_DEPARTMENTS = ["Science", "Commerce", "Humanities"] as const;

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDob = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;

  const datePartOnly = raw.match(/\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}/)?.[0] || raw.split(/[T\s]/)[0];
  const normalized = datePartOnly
    .replace(/[^0-9/.-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/-{2,}/g, "-")
    .replace(/\.+/g, ".")
    .replace(/[./]/g, (match) => (match === "." ? "/" : match));

  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split(/[/-]/).map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const isValidDob = (value: string) => {
  const dobDate = parseDob(value);
  if (!dobDate) return false;
  const today = new Date();
  return dobDate <= today && dobDate.getFullYear() >= 1980;
};

const normalizeText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeOptionalText = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = normalizeText(value);
  return normalized.length ? normalized : null;
};

const normalizePhone = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const clean = String(value).replace(/\D/g, "");
  return clean.length >= 10 ? `0${clean.slice(-10)}` : String(value).trim();
};

const normalizeDob = (value: unknown) => {
  const raw = String(value || "").trim();
  const parsed = parseDob(raw);
  return parsed ? toIsoDate(parsed) : raw;
};

const requiredField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`);

export const studentFormSchema = z
  .object({
    name: requiredField("Name").pipe(
      z
        .string()
        .min(2, "Name must be at least 2 characters")
        .regex(GLOBAL_REGEX.NAME, "Enter a valid name (letters and basic punctuation only)"),
    ),
    father_name: requiredField("Father name").pipe(
      z
        .string()
        .min(2, "Father name must be at least 2 characters")
        .regex(GLOBAL_REGEX.NAME, "Enter a valid father name"),
    ),
    mother_name: requiredField("Mother name").pipe(
      z
        .string()
        .min(2, "Mother name must be at least 2 characters")
        .regex(GLOBAL_REGEX.NAME, "Enter a valid mother name"),
    ),
    father_phone: requiredField("Father phone").pipe(
      z
        .string()
        .regex(GLOBAL_REGEX.PHONE_BD, "Father phone must be 11 digits and start with 01"),
    ),
    mother_phone: z
      .string()
      .trim()
      .refine((value) => !value || GLOBAL_REGEX.PHONE_BD.test(value), {
        message: "Mother phone must be 11 digits and start with 01",
      }),
    roll: requiredField("Roll").pipe(
      z
        .string()
        .regex(GLOBAL_REGEX.ROLL_NUM, "Roll must be numeric (up to 3 digits)")
        .refine((value) => Number(value) > 0, "Roll must be greater than 0"),
    ),
    section: requiredField("Section").pipe(
      z
        .string()
        .toUpperCase()
        .regex(/^[A-Z]$/, "Section must be a single letter (A-Z)"),
    ),
    village: z
      .string()
      .trim()
      .refine((value) => !value || GLOBAL_REGEX.ADDRESS_TEXT.test(value), {
        message: "Enter a valid village",
      }),
    post_office: z
      .string()
      .trim()
      .refine((value) => !value || GLOBAL_REGEX.ADDRESS_TEXT.test(value), {
        message: "Enter a valid post office",
      }),
    upazila: z
      .string()
      .trim()
      .refine((value) => !value || GLOBAL_REGEX.ADDRESS_TEXT.test(value), {
        message: "Enter a valid upazila",
      }),
    district: z
      .string()
      .trim()
      .refine((value) => !value || GLOBAL_REGEX.ADDRESS_TEXT.test(value), {
        message: "Enter a valid district",
      }),
    dob: requiredField("Date of birth").pipe(
      z
        .string()
        .refine((value) => isValidDob(value), "Invalid date of birth"),
    ),
    class: requiredField("Class").pipe(
      z
        .string()
        .regex(GLOBAL_REGEX.CLASS_NUM, "Class must be between 1 and 10"),
    ),
    department: z.string().trim(),
    has_stipend: z.boolean(),
    available: z.boolean(),
    image: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const classNumber = Number(value.class);
    if ((classNumber === 9 || classNumber === 10) && !VALID_DEPARTMENTS.includes(value.department as (typeof VALID_DEPARTMENTS)[number])) {
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
    name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Invalid student name format",
    }),
    father_name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Valid father name is required",
    }),
    mother_name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Valid mother name is required",
    }),
    father_phone: z
      .any()
      .transform(normalizePhone)
      .refine((value) => typeof value === "string" && GLOBAL_REGEX.PHONE_BD.test(value), {
        message: "Father phone must be 11 digits and start with 01",
      }),
    mother_phone: z
      .any()
      .transform(normalizePhone)
      .refine((value) => value === null || GLOBAL_REGEX.PHONE_BD.test(value), {
        message: "Mother phone must be 11 digits and start with 01",
      }),
    village: z.any().optional().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid village format" },
    ),
    post_office: z.any().optional().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid post office format" },
    ),
    upazila: z.any().optional().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid upazila format" },
    ),
    district: z.any().optional().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid district format" },
    ),
    dob: z.any().transform(normalizeDob).refine((value) => isValidDob(value), {
      message: "Valid date of birth is required",
    }),
    has_stipend: z.any().optional().transform((value) => Boolean(value)),
    class: z.coerce.number().int().min(1).max(12),
    roll: z.coerce.number().int().min(1).max(999),
    section: z
      .any()
      .transform((value) => normalizeText(value).toUpperCase())
      .refine((value) => GLOBAL_REGEX.SECTION.test(value), {
        message: "Section must be a single letter",
      }),
    department: z.any().optional().transform(normalizeOptionalText),
    year: z.coerce.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.class === 9 || value.class === 10) && !VALID_DEPARTMENTS.includes((value.department || "") as (typeof VALID_DEPARTMENTS)[number])) {
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
    .min(1, "Students must be an array with at least one element."),
});

export const deleteStudentsBulkRequestSchema = z.object({
  studentIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "At least one student ID is required")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate student IDs are not allowed",
    }),
});

export const updateStudentSchema = z
  .object({
    name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Invalid student name format",
    }),
    father_name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Invalid father name format",
    }),
    mother_name: z.string().transform(normalizeText).refine((value) => GLOBAL_REGEX.NAME.test(value), {
      message: "Invalid mother name format",
    }),
    father_phone: z
      .any()
      .transform(normalizePhone)
      .refine((value) => typeof value === "string" && GLOBAL_REGEX.PHONE_BD.test(value), {
        message: "Invalid father phone",
      }),
    mother_phone: z
      .any()
      .transform(normalizePhone)
      .refine((value) => value === null || GLOBAL_REGEX.PHONE_BD.test(value), {
        message: "Invalid mother phone",
      }),
    dob: z.any().transform(normalizeDob).refine((value) => isValidDob(value), {
      message: "Invalid date of birth",
    }),
    village: z.any().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid village format" },
    ),
    post_office: z.any().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid post office format" },
    ),
    upazila: z.any().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid upazila format" },
    ),
    district: z.any().transform(normalizeOptionalText).refine(
      (value) => value === null || GLOBAL_REGEX.ADDRESS_TEXT.test(value),
      { message: "Invalid district format" },
    ),
    has_stipend: z.any().transform((value) => Boolean(value)),
    available: z.any().transform((value) => Boolean(value)),
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
      .refine((value) => GLOBAL_REGEX.SECTION.test(value), {
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
