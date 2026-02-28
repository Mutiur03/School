import { z } from "zod";

export const adminLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required"),

  password: z
    .string()
    .min(1, "Password is required"),
});

export const addAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(
      /^[A-Za-z0-9_.-@]+$/,
      "Username may only contain letters, numbers, underscores, dots and hyphens and @"
    ),
    // .regex(
    //   /^[A-Za-z0-9_.-]+$/,
    //   "Username may only contain letters, numbers, underscores, dots and hyphens"
    // ),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be at most 100 characters"),
});

export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type AddAdminData = z.infer<typeof addAdminSchema>;
