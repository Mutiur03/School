import { z } from "zod";
import { CLASS_NUM, PHONE_NUMBER, ROLL_NUMBER, SECTION } from "./regex.js";

const yearLike = z.union([z.string(), z.number()]);
const classLike = z.union([z.string(), z.number()]);
const rollLike = z.union([z.string(), z.number()]);

/** Public site result lookup: session + class + section + roll + mobile. */
export const publicResultVerifySchema = z
  .object({
    year: yearLike.optional(),
    session: yearLike.optional(),
    class: classLike,
    section: z.union([z.string(), z.number()]),
    roll: rollLike,
    phone: z.string().optional(),
    mobile: z.string().optional(),
  })
  .transform((data) => ({
    year: String(data.year ?? data.session ?? "").trim(),
    class: String(data.class ?? "").trim(),
    section: String(data.section ?? "")
      .trim()
      .toUpperCase(),
    roll: String(data.roll ?? "").trim(),
    phone: String(data.phone ?? data.mobile ?? "").trim(),
  }))
  .pipe(
    z.object({
      year: z
        .string()
        .min(1, "Session is required")
        .regex(/^\d{4}$/, "Session must be a 4-digit year")
        .transform((v) => Number(v))
        .refine((y) => y >= 2000 && y <= 2100, {
          message: "Session year is invalid",
        }),
      class: z
        .string()
        .min(1, "Class is required")
        .regex(CLASS_NUM, "Class must be between 1 and 10")
        .transform((v) => Number(v)),
      section: z
        .string()
        .min(1, "Section is required")
        .regex(SECTION, "Section must be a single letter (A-Z)"),
      roll: z
        .string()
        .min(1, "Roll is required")
        .regex(ROLL_NUMBER, "Roll must be a number between 1 and 999999")
        .transform((v) => Number(v)),
      phone: z
        .string()
        .min(1, "Mobile number is required")
        .regex(PHONE_NUMBER, "Mobile must be 11 digits and start with 01"),
    }),
  );

export type PublicResultVerifyInput = z.input<typeof publicResultVerifySchema>;
export type PublicResultVerifyData = z.infer<typeof publicResultVerifySchema>;

/** Query params for GET /public/exams (published exams for a session + class). */
export const publicResultExamsQuerySchema = z.object({
  year: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .min(1, "Session is required")
        .regex(/^\d{4}$/, "Session must be a 4-digit year")
        .transform((v) => Number(v))
        .refine((y) => y >= 2000 && y <= 2100, {
          message: "Session year is invalid",
        }),
    ),
  class: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .min(1, "Class is required")
        .regex(CLASS_NUM, "Class must be between 1 and 10")
        .transform((v) => Number(v)),
    ),
});

export type PublicResultExamsQueryData = z.infer<
  typeof publicResultExamsQuerySchema
>;

/** Query params for /public/result and /public/download. */
export const publicResultQuerySchema = z.object({
  year: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .min(1, "Year is required")
        .regex(/^\d{4}$/, "Year must be a 4-digit number")
        .transform((v) => Number(v))
        .refine((y) => y >= 2000 && y <= 2100, {
          message: "Year is invalid",
        }),
    ),
  exam: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1, "Exam is required")),
});

export type PublicResultQueryData = z.infer<typeof publicResultQuerySchema>;
