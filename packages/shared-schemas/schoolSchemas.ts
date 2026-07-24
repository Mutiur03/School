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
          origin: "string",
          inclusive: true,
          message: `${label} cannot exceed ${maxLength} characters`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      return value.length === 0 ? null : value;
    });

const isUploadPath = (value: string) => /^\/?uploads\/.+/.test(value);
const isR2Key = (value: string) => /^[a-z0-9][a-z0-9\-._/]+$/i.test(value);

const optionalUrl = (label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .superRefine((raw, ctx) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length === 0) return;
      if (isUploadPath(value) || isR2Key(value)) return;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid URL starting with http:// or https://, an upload path, or a storage key`,
        });
      }
    })
    .transform((raw) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      return value.length === 0 ? null : value;
    });

const requiredUrl = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .superRefine((value, ctx) => {
      if (isUploadPath(value) || isR2Key(value)) return;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid URL starting with http:// or https://, an upload path, or a storage key`,
        });
      }
    });

const requiredPhone = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((value) => PHONE_NUMBER.test(value), {
    message: "Phone number must be 11 digits and start with 01",
  });

const requiredEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Email format is invalid");

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
    logo: requiredUrl("Logo"),
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
    phone: requiredPhone,
    email: requiredEmail,
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
    gaMeasurementId: optionalTrimmedString(50, "Google Analytics Measurement ID"),
    nameBn: optionalTrimmedString(300, "Bengali Name"),
    centerCode: optionalTrimmedString(50, "Center Code"),
    governmentLogo: optionalUrl("Government Logo"),
    headerLogo: optionalUrl("Header Logo"),
    bannerUrls: z.any().optional(),
    address: optionalTrimmedString(500, "Address"),
    location: optionalTrimmedString(200, "Location"),
    mapEmbedUrl: optionalTrimmedString(5000, "Map Embed URL"),
    nationalizedYear: optionalTrimmedString(20, "Nationalized Year"),
    resultsUrl: optionalUrl("Results URL"),
    teacherLoginUrl: optionalUrl("Teacher Login URL"),
    studentLoginUrl: optionalUrl("Student Login URL"),
    website: optionalUrl("Website URL"),
    descriptions: z.any().optional(),
    academicProfile: z.any().optional(),
    identifiersExtra: z.any().optional(),
    sidebarConfig: z.any().optional(),
    menuItems: z.any().optional(),
    homeCharts: z.any().optional(),
    seo: z.any().optional(),
    theme: z.any().optional(),
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
