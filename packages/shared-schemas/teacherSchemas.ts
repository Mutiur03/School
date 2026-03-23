import { z } from "zod";
import {
  NAME,
  PHONE_NUMBER,
  DESIGNATION,
  ADDRESS_TEXT,
  EMAIL,
} from "./regex.js";

export const deleteTeachersBulkRequestSchema = z.object({
  teacherIds: z.array(z.number()),
});

export const rotateTeachersPasswordsBulkRequestSchema = deleteTeachersBulkRequestSchema;

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
    .email("Enter a valid email address")
    .regex(EMAIL, "Enter a valid email address"),

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
      "Enter a valid designation (must start with a letter and contain valid characters)",
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
    .email("Enter a valid email address")
    .regex(EMAIL, "Enter a valid email address"),

  password: z.string().min(1, "Password is required"),
});

export type TeacherLoginData = z.infer<typeof teacherLoginSchema>;

export const teacherPasswordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .regex(EMAIL, "Please enter a valid email address"),
});

export const teacherPasswordResetCodeVerifySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .regex(EMAIL, "Please enter a valid email address"),

  code: z
    .string()
    .length(6, "Reset code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Reset code must contain only numbers"),
});

export const teacherPasswordUpdateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .regex(EMAIL, "Please enter a valid email address"),

  code: z
    .string()
    .length(6, "Reset code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Reset code must contain only numbers"),

  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(100, "Password must be at most 100 characters")
    .refine((password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);

      return hasUpperCase && hasLowerCase && hasNumbers;
    }, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
});

export type TeacherPasswordResetRequestData = z.infer<
  typeof teacherPasswordResetRequestSchema
>;
export type TeacherPasswordResetCodeVerifyData = z.infer<
  typeof teacherPasswordResetCodeVerifySchema
>;
export type TeacherPasswordUpdateData = z.infer<
  typeof teacherPasswordUpdateSchema
>;
