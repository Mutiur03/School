import { z } from "zod";
import { ADDRESS_TEXT, DESIGNATION, EMAIL, NAME, PHONE_NUMBER } from "./regex.js";
import { normalizeOptionalText } from "./utils.js";

const optionalEmail = z
  .any()
  .optional()
  .transform(normalizeOptionalText)
  .refine((value) => value === null || EMAIL.test(value), {
    message: "Enter a valid email address",
  });

const optionalDesignation = z
  .any()
  .optional()
  .transform(normalizeOptionalText)
  .refine((value) => value === null || DESIGNATION.test(value), {
    message: "Enter a valid designation",
  });

const optionalAddress = z
  .any()
  .optional()
  .transform(normalizeOptionalText)
  .refine((value) => value === null || ADDRESS_TEXT.test(value), {
    message: "Enter a valid address",
  });

export const staffFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100)
    .regex(NAME, "Enter a valid name"),

  email: optionalEmail,

  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .transform((value) => `0${value.replace(/\D/g, "").slice(-10)}`)
    .refine((value) => PHONE_NUMBER.test(value), {
      message: "Phone must be 11 digits and start with 01",
    }),

  designation: optionalDesignation,
  address: optionalAddress,
});

export type StaffFormInput = z.input<typeof staffFormSchema>;
export type StaffFormData = z.infer<typeof staffFormSchema>;

const addStaffBodySchema = z.object({
  staff: z.array(staffFormSchema).min(1, "At least one staff member is required"),
});

export const addStaffRequestSchema = z.preprocess((input) => {
  if (Array.isArray(input)) {
    return { staff: input };
  }

  if (input && typeof input === "object") {
    const body = input as Record<string, unknown>;
    if (!("staff" in body) && Array.isArray(body.staffs)) {
      return { staff: body.staffs };
    }
  }

  return input;
}, addStaffBodySchema.transform((body) => body.staff));

export const staffIdParamSchema = z.coerce.number().int().positive();

export const staffPresignedUrlQuerySchema = z.object({
  id: staffIdParamSchema,
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
});

export const staffImageKeySchema = z.object({
  key: z.string().trim().min(1),
});
