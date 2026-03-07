import { z } from "zod";
import { NAME, PHONE_NUMBER, DESIGNATION, ADDRESS_TEXT } from "./regex.js";

export const teacherFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .regex(NAME, "Enter a valid name (letters and basic punctuation only)"),

  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),

  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(PHONE_NUMBER, "Phone must be 11 digits and start with 01"),

  designation: z
    .string()
    .trim()
    .min(1, "Designation is required")
    .min(2, "Designation must be at least 2 characters")
    .max(50, "Designation must be at most 50 characters")
    .regex(
      DESIGNATION,
      "Enter a valid designation (letters, numbers and basic punctuation only)",
    ),

  address: z
    .string()
    .trim()
    .refine((value) => !value || ADDRESS_TEXT.test(value), {
      message: "Address may only contain letters and numbers",
    }),
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
