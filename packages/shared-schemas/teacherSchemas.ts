import { z } from "zod";
import { GLOBAL_REGEX } from "./studentSchemas";

export const teacherFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .regex(
      GLOBAL_REGEX.NAME,
      "Enter a valid name (letters and basic punctuation only)",
    ),

  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),

  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(GLOBAL_REGEX.PHONE_BD, "Phone must be 11 digits and start with 01"),

  designation: z
    .string()
    .trim()
    .min(1, "Designation is required")
    .min(2, "Designation must be at least 2 characters")
    .max(50, "Designation must be at most 50 characters")
    .regex(
      GLOBAL_REGEX.DESIGNATION,
      "Enter a valid designation (letters, numbers and basic punctuation only)",
    ),

  address: z
    .string()
    .trim()
    .regex(
      /^([A-Za-z0-9 .,'()\/-]{2,100})?$/,
      "Address may only contain letters, numbers and basic punctuation",
    ),
});

export type TeacherFormSchemaData = z.infer<typeof teacherFormSchema>;

export const teacherLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),

  password: z.string().min(1, "Password is required"),
});

export type TeacherLoginData = z.infer<typeof teacherLoginSchema>;
