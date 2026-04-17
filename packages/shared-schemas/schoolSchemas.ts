import { z } from "zod";
import { districts, upazilas } from "./location.js";
import { PHONE_NUMBER } from "./regex.js";

const currentYear = new Date().getFullYear();
const districtIds = new Set(districts.map((d) => d.id));
const upazilaIds = new Set(upazilas.map((u) => u.id));

// ─── helpers ────────────────────────────────────────────────────────────────

const optionalTrimmedString = (maxLength: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .superRefine((raw, ctx) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length > 0 && value.length > maxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: maxLength,
          type: "string",
          inclusive: true,
          message: `${label} cannot exceed ${maxLength} characters`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      return value.length === 0 ? null : value;
    });

const optionalUrl = (label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .superRefine((raw, ctx) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length === 0) return;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid URL starting with http:// or https://`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      return value.length === 0 ? null : value;
    });

const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .superRefine((raw, ctx) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > 0 && !PHONE_NUMBER.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number must be 11 digits and start with 01",
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    return value.length === 0 ? null : value;
  });

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .superRefine((raw, ctx) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > 0 && !z.string().email().safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email format is invalid",
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    return value.length === 0 ? null : value;
  });

const optionalEiin = z
  .union([z.string(), z.null(), z.undefined()])
  .superRefine((raw, ctx) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > 0 && !/^\d{6}$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "EIIN must be exactly 6 digits",
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    return value.length === 0 ? null : value;
  });

const optionalSubdomain = z
  .union([z.string(), z.null(), z.undefined()])
  .superRefine((raw, ctx) => {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (
      value.length > 0 &&
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Subdomain can contain lowercase letters, numbers, and hyphens only",
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return value.length === 0 ? null : value;
  });

const optionalCustomDomain = z
  .union([z.string(), z.null(), z.undefined()])
  .superRefine((raw, ctx) => {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (value.length > 0 && !/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom domain must be a valid domain (e.g. school.edu)",
      });
    }
  })
  .transform((raw) => {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return value.length === 0 ? null : value;
  });

// ─── schema ──────────────────────────────────────────────────────────────────

const schoolBaseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "School name must be at least 2 characters")
      .max(200, "School name cannot exceed 200 characters"),
    shortName: optionalTrimmedString(50, "Short name"),
    eiin: optionalEiin,
    logo: optionalUrl("Logo"),
    favicon: optionalUrl("Favicon"),
    district: z
      .string()
      .trim()
      .min(1, "District is required")
      .refine((v) => districtIds.has(v), { message: "District is invalid" }),
    upazila: z
      .string()
      .trim()
      .min(1, "Upazila is required")
      .refine((v) => upazilaIds.has(v), { message: "Upazila is invalid" }),
    phone: optionalPhone,
    email: optionalEmail,
    slogan: optionalTrimmedString(500, "Slogan"),
    establishedIn: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .superRefine((raw, ctx) => {
        if (raw === null || raw === undefined || raw === "") return;
        const parsed =
          typeof raw === "number"
            ? Number.isFinite(raw)
              ? Math.trunc(raw)
              : NaN
            : parseInt(String(raw), 10);
        if (
          isNaN(parsed) ||
          !Number.isInteger(parsed) ||
          parsed < 1800 ||
          parsed > currentYear
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Established year must be between 1800 and ${currentYear}`,
          });
        }
      })
      .transform((raw) => {
        if (raw === null || raw === undefined || raw === "") return null;
        const parsed =
          typeof raw === "number" ? Math.trunc(raw) : parseInt(String(raw), 10);
        return isNaN(parsed) ? null : parsed;
      }),
    subdomain: optionalSubdomain,
    customDomain: optionalCustomDomain,
  })
  .superRefine((value, ctx) => {
    if (value.upazila && value.district) {
      const belongs = upazilas.some(
        (u) => u.id === value.upazila && u.districtId === value.district,
      );
      if (!belongs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["upazila"],
          message: "Selected upazila does not belong to the selected district",
        });
      }
    }
  });

export const createSchoolSchema = schoolBaseSchema;
export const updateSchoolSchema = schoolBaseSchema;

export type CreateSchoolSchemaData = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolSchemaData = z.infer<typeof updateSchoolSchema>;
