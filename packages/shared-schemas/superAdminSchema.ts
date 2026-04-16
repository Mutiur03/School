import { z } from "zod";

export const setupSuperAdminSchema = z.object({
  email: z.string().email(),
  token: z.string(),
});

export const superAdminLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});
