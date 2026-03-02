import { BANGLA_ONLY, BIRTH_REG_NO, ENGLISH_ONLY, NID, PHONE_NUMBER, POST_CODE, ROLL_NUMBER } from "./regex.ts";
import { z } from "zod";

/**
 * Regex patterns used in Class 6 registration validation.
 * Exported so frontend/backend can reuse them in custom UI logic.
 */
// export const = {
//   BANGLA_ONLY: /^[\u0980-\u09FF\s.:]+$/,
//   ENGLISH_ONLY: /^[A-Za-z\s.:]+$/,
//   PHONE_NUMBER: /^01[3-9][0-9]{8}$/,
//   NID: /^(?:\d{10}|\d{13}|\d{17})$/,
//   BIRTH_REG_NO: /^\d{17}$/,
//   POST_CODE: /^\d{4}$/,
//   ROLL_NUMBER: /^\d{1,6}$/,
// } as const;

/**
 * Internal base fields (no photo, no UI-only booleans).
 * Frontend extends class6RegistrationServerSchema.omit({ photo_path: true }).
 * Not exported — consumers use class6RegistrationServerSchema directly.
 */
const class6RegistrationFieldsSchema = z.object({
  // Personal Information
  student_name_bn: z
    .string()
    .min(1, "Student Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
  student_name_en: z
    .string()
    .min(1, "Student Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed"),
  birth_reg_no: z
    .string()
    .min(1, "Birth Registration Number is required")
    .regex(BIRTH_REG_NO, "Must be 17 digits"),
  birth_year: z.string().min(1, "Year is required"),
  birth_month: z.string().min(1, "Month is required"),
  birth_day: z.string().min(1, "Day is required"),
  email: z
    .string()
    .default("")
    .refine(
      (val) => !val || /^[\x00-\x7F]+$/.test(val),
      "Email must contain only English characters",
    )
    .refine(
      (val) => !val || z.string().email().safeParse(val).success,
      "Invalid email format",
    ),
  religion: z.string().min(1, "Religion is required").max(50).default(""),

  // Parents Information
  father_name_bn: z
    .string()
    .min(1, "Father's Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
  father_name_en: z
    .string()
    .min(1, "Father's Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed"),
  father_nid: z
    .string()
    .min(1, "Father's NID is required")
    .regex(NID, "Must be 10, 13 or 17 digits"),
  father_phone: z
    .string()
    .min(1, "Father's Phone is required")
    .regex(PHONE_NUMBER, "Invalid phone number"),

  mother_name_bn: z
    .string()
    .min(1, "Mother's Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
  mother_name_en: z
    .string()
    .min(1, "Mother's Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed"),
  mother_nid: z
    .string()
    .min(1, "Mother's NID is required")
    .regex(NID, "Must be 10, 13 or 17 digits"),
  mother_phone: z
    .string()
    .min(1, "Mother's Phone is required")
    .regex(PHONE_NUMBER, "Invalid phone number"),

  // Permanent Address
  permanent_district: z.string().min(1, "District is required"),
  permanent_upazila: z.string().min(1, "Upazila is required"),
  permanent_post_office: z.string().min(1, "Post Office is required"),
  permanent_post_code: z
    .string()
    .min(1, "Post Code is required")
    .regex(POST_CODE, "Must be 4 digits"),
  permanent_village_road: z.string().min(1, "Village/Road is required"),

  // Present Address
  present_district: z.string().min(1, "District is required"),
  present_upazila: z.string().min(1, "Upazila is required"),
  present_post_office: z.string().min(1, "Post Office is required"),
  present_post_code: z
    .string()
    .min(1, "Post Code is required")
    .regex(POST_CODE, "Must be 4 digits"),
  present_village_road: z.string().min(1, "Village/Road is required"),

  // Guardian Information (all optional at field level; cross-field rules via superRefine)
  guardian_name: z.string().optional(),
  guardian_phone: z.string().optional(),
  guardian_relation: z.string().optional(),
  guardian_nid: z.string().optional(),
  guardian_district: z.string().optional(),
  guardian_upazila: z.string().optional(),
  guardian_post_office: z.string().optional(),
  guardian_post_code: z.string().optional(),
  guardian_village_road: z.string().optional(),

  // Class Information
  section: z.string().min(1, "Section is required"),
  roll: z
    .string()
    .min(1, "Roll is required")
    .regex(ROLL_NUMBER, "Invalid roll"),

  // Previous School Information
  prev_school_name: z.string().min(1, "Previous School Name is required"),
  prev_school_passing_year: z
    .string()
    .min(1, "Previous School Passing Year is required"),
  section_in_prev_school: z
    .string()
    .min(1, "Section in previous school is required"),
  roll_in_prev_school: z
    .string()
    .min(1, "Roll in previous school is required")
    .regex(ROLL_NUMBER, "Roll must be numeric"),
  prev_school_district: z
    .string()
    .min(1, "Previous School District is required"),
  prev_school_upazila: z
    .string()
    .min(1, "Previous School Upazila is required"),

  nearby_student_info: z
    .string()
    .min(1, "Nearby student information is required"),
});

/**
 * Plain object shape (no refinements) for the server payload.
 * Exported separately so the frontend can call .omit({ photo_path: true })
 * to derive its base schema without hitting Zod's "no omit on refined schema" restriction.
 */
export const class6RegistrationServerShape =
  class6RegistrationFieldsSchema.extend({
    photo_path: z.string().min(1, "Student photo is required"),
  });

/**
 * Full server-side schema with cross-field guardian validation.
 * Used by the validate() middleware on POST / and PUT /:id routes.
 */
export const class6RegistrationServerSchema =
  class6RegistrationServerShape.check((ctx) => {
      const data = ctx.value;
      // If a guardian name was submitted, all other guardian fields are required
      if (data.guardian_name) {
        if (!data.guardian_phone) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian phone is required",
            path: ["guardian_phone"],
            input: data,
          });
        } else if (!PHONE_NUMBER.test(data.guardian_phone)) {
          ctx.issues.push({
            code: "custom",
            message: "Invalid Guardian Phone Number",
            path: ["guardian_phone"],
            input: data,
          });
        }

        if (!data.guardian_relation) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian relation is required",
            path: ["guardian_relation"],
            input: data,
          });
        }

        if (!data.guardian_nid) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian NID is required",
            path: ["guardian_nid"],
            input: data,
          });
        } else if (!NID.test(data.guardian_nid)) {
          ctx.issues.push({
            code: "custom",
            message: "Invalid Guardian NID (Must be 10, 13 or 17 digits)",
            path: ["guardian_nid"],
            input: data,
          });
        }

        if (!data.guardian_district) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian district is required",
            path: ["guardian_district"],
            input: data,
          });
        }
        if (!data.guardian_upazila) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian upazila is required",
            path: ["guardian_upazila"],
            input: data,
          });
        }
        if (!data.guardian_post_office) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian post office is required",
            path: ["guardian_post_office"],
            input: data,
          });
        }
        if (
          !data.guardian_post_code ||
          !POST_CODE.test(data.guardian_post_code)
        ) {
          ctx.issues.push({
            code: "custom",
            message: "Invalid Guardian Post Code",
            path: ["guardian_post_code"],
            input: data,
          });
        }
        if (!data.guardian_village_road) {
          ctx.issues.push({
            code: "custom",
            message: "Guardian village/road is required",
            path: ["guardian_village_road"],
            input: data,
          });
        }
      }
    });

/**
 * Status-only update schema used by the PUT /:id/status endpoint.
 */
export const class6RegistrationStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], {
    message: "Status must be pending, approved, or rejected",
  }),
});

export type Class6RegistrationServerData = z.infer<
  typeof class6RegistrationServerSchema
>;
export type Class6RegistrationStatusData = z.infer<
  typeof class6RegistrationStatusSchema
>;

/**
 * Shape of the record returned by the API / stored in the DB.
 * Extends the submitted data but replaces photo_path with photo (the DB column name)
 * and adds server-managed fields (id, registration_no, birth_date, class6_year,
 * status, created_at).
 */
export type Class6RegistrationRecord = Omit<
  Class6RegistrationServerData,
  "photo_path"
> & {
  id: string;
  photo?: string | null;
  /** Formatted date string (e.g. "2012-03-15") derived from birth_year/month/day */
  birth_date?: string | null;
  class6_year?: number | null;
  status?: string | null;
  created_at?: string | null;
};
