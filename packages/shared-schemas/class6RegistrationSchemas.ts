import {
  ADDRESS_TEXT,
  BANGLA_ONLY,
  BIRTH_REG_NO,
  ENGLISH_ONLY,
  NID,
  PHONE_NUMBER,
  POST_CODE,
  ROLL_NUMBER,
  ASCII_ONLY,
} from "./regex.js";
import { z } from "zod";

const registrationObjectShape = z.object({
  student_name_bn: z
    .string()
    .min(1, "Student Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed")
    .default(""),
  student_name_en: z
    .string()
    .min(1, "Student Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed")
    .default(""),
  birth_reg_no: z
    .string()
    .min(1, "Birth Registration Number is required")
    .regex(BIRTH_REG_NO, "Must be 17 digits")
    .default(""),
  birth_year: z.string().min(1, "Year is required").default(""),
  birth_month: z.string().min(1, "Month is required").default(""),
  birth_day: z.string().min(1, "Day is required").default(""),
  email: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .default("")
      .refine(
        (val) => !val || ASCII_ONLY.test(val),
        "Email must contain only English characters",
      )
      .refine(
        (val) => !val || z.string().email().safeParse(val).success,
        "Invalid email format",
      ),
  ),
  religion: z.string().min(1, "Religion is required").max(50).default(""),

  father_name_bn: z
    .string()
    .min(1, "Father's Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed")
    .default(""),
  father_name_en: z
    .string()
    .min(1, "Father's Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed")
    .default(""),
  father_nid: z
    .string()
    .min(1, "Father's NID is required")
    .regex(NID, "Must be 10, 13 or 17 digits")
    .default(""),
  father_phone: z
    .string()
    .min(1, "Father's Phone is required")
    .regex(PHONE_NUMBER, "Invalid phone number")
    .default(""),

  mother_name_bn: z
    .string()
    .min(1, "Mother's Name in Bangla is required")
    .regex(BANGLA_ONLY, "Only Bangla characters are allowed")
    .default(""),
  mother_name_en: z
    .string()
    .min(1, "Mother's Name in English is required")
    .regex(ENGLISH_ONLY, "Only English characters are allowed")
    .default(""),
  mother_nid: z
    .string()
    .min(1, "Mother's NID is required")
    .regex(NID, "Must be 10, 13 or 17 digits")
    .default(""),
  mother_phone: z
    .string()
    .min(1, "Mother's Phone is required")
    .regex(PHONE_NUMBER, "Invalid phone number")
    .default(""),

  permanent_district: z.string().min(1, "District is required").default(""),
  permanent_upazila: z.string().min(1, "Upazila is required").default(""),
  permanent_post_office: z
    .string()
    .min(1, "Post Office is required")
    .regex(ADDRESS_TEXT, "Only English letters, digits and spaces are allowed")
    .default(""),
  permanent_post_code: z
    .string()
    .min(1, "Post Code is required")
    .regex(POST_CODE, "Must be 4 digits")
    .default(""),
  permanent_village_road: z
    .string()
    .min(1, "Village/Road is required")
    .regex(ADDRESS_TEXT, "Only English letters, digits and spaces are allowed")
    .default(""),

  present_district: z.string().min(1, "District is required").default(""),
  present_upazila: z.string().min(1, "Upazila is required").default(""),
  present_post_office: z
    .string()
    .min(1, "Post Office is required")
    .regex(ADDRESS_TEXT, "Only English letters, digits and spaces are allowed")
    .default(""),
  present_post_code: z
    .string()
    .min(1, "Post Code is required")
    .regex(POST_CODE, "Must be 4 digits")
    .default(""),
  present_village_road: z
    .string()
    .min(1, "Village/Road is required")
    .regex(ADDRESS_TEXT, "Only English letters, digits and spaces are allowed")
    .default(""),
  same_as_permanent: z.boolean().default(false),
  guardian_is_not_father: z.boolean().default(false),
  guardian_name: z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().max(100).default(""),
  ),
  guardian_phone: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .max(11)
      .refine(
        (val) => !val || PHONE_NUMBER.test(val),
        "Invalid Bangladeshi phone number",
      )
      .default(""),
  ),
  guardian_relation: z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().max(50).default(""),
  ),
  guardian_nid: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .max(17)
      .refine(
        (val) => !val || NID.test(val),
        "Guardian NID must be 10, 13 or 17 digits",
      )
      .default(""),
  ),
  guardian_address_same_as_permanent: z.boolean().default(false),
  guardian_district: z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().max(50).default(""),
  ),
  guardian_upazila: z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().max(50).default(""),
  ),
  guardian_post_office: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .max(100)
      .refine(
        (val) => !val || ADDRESS_TEXT.test(val),
        "Only English letters, digits and spaces are allowed",
      )
      .default(""),
  ),
  guardian_post_code: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .refine(
        (val) => !val || POST_CODE.test(val),
        "Post code must be 4 digits",
      )
      .default(""),
  ),
  guardian_village_road: z.preprocess(
    (v) => (v === null ? "" : v),
    z
      .string()
      .max(200)
      .refine(
        (val) => !val || ADDRESS_TEXT.test(val),
        "Only English letters, digits and spaces are allowed",
      )
      .default(""),
  ),

  section: z.string().min(1, "Section is required").default(""),
  roll: z
    .string()
    .min(1, "Roll is required")
    .regex(ROLL_NUMBER, "Invalid roll")
    .default(""),

  prev_school_name: z
    .string()
    .min(1, "Previous School Name is required")
    .default(""),
  prev_school_passing_year: z
    .string()
    .min(1, "Previous School Passing Year is required")
    .default(""),
  section_in_prev_school: z
    .string()
    .min(1, "Section in previous school is required")
    .default(""),
  roll_in_prev_school: z
    .string()
    .min(1, "Roll in previous school is required")
    .regex(ROLL_NUMBER, "Roll must be numeric")
    .default(""),
  prev_school_district: z
    .string()
    .min(1, "Previous School District is required")
    .default(""),
  prev_school_upazila: z
    .string()
    .min(1, "Previous School Upazila is required")
    .default(""),
  nearby_student_info: z
    .string()
    .min(1, "Nearby student information is required")
    .default(""),
  photo: z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.custom<File | string>((val) => {
      if (val instanceof File) return true;
      if (typeof val === "string") return true;
      return false;
    }),
  ),
});

export const registrationSchema = registrationObjectShape.superRefine(
  (data, ctx) => {
    if (
      !data.photo ||
      (typeof data.photo === "string" && data.photo.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Student photo is required",
        path: ["photo"],
      });
    }
    if (data.guardian_is_not_father) {
      console.log("super refine working");
      console.log("superrefine data", data.guardian_is_not_father);

      if (!data.guardian_name || data.guardian_name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian name is required when guardian is not father",
          path: ["guardian_name"],
        });
      }
      if (!data.guardian_phone || data.guardian_phone.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian phone is required when guardian is not father",
          path: ["guardian_phone"],
        });
      } else if (!PHONE_NUMBER.test(data.guardian_phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid Bangladeshi phone number",
          path: ["guardian_phone"],
        });
      }
      if (!data.guardian_relation || data.guardian_relation.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian relation is required when guardian is not father",
          path: ["guardian_relation"],
        });
      }
      if (!data.guardian_nid || data.guardian_nid.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian NID is required",
          path: ["guardian_nid"],
        });
      } else if (!NID.test(data.guardian_nid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian NID must be 10,13 or 17 digits",
          path: ["guardian_nid"],
        });
      }

      if (!data.guardian_address_same_as_permanent) {
        if (!data.guardian_district || data.guardian_district.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Guardian District is required",
            path: ["guardian_district"],
          });
        }
        if (!data.guardian_upazila || data.guardian_upazila.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Guardian Upazila is required",
            path: ["guardian_upazila"],
          });
        }
        if (
          !data.guardian_post_office ||
          data.guardian_post_office.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Guardian Post Office is required",
            path: ["guardian_post_office"],
          });
        }
        if (!data.guardian_post_code || data.guardian_post_code.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Guardian Post Code is required",
            path: ["guardian_post_code"],
          });
        }
        if (
          !data.guardian_village_road ||
          data.guardian_village_road.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Guardian Village/Road is required",
            path: ["guardian_village_road"],
          });
        }
      }
    }
  },
);

export const class6RegistrationStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], {
    message: "Status must be pending, approved, or rejected",
  }),
});

export const class6RegistrationSettingsSchema = z.object({
  a_sec_roll: z.string().nullable().optional(),
  b_sec_roll: z.string().nullable().optional(),
  class6_year: z.union([z.string(), z.number()]).optional(),
  reg_open: z.union([z.string(), z.boolean()]).optional(),
  instruction_for_a: z.string().optional(),
  instruction_for_b: z.string().optional(),
  attachment_instruction: z.string().optional(),
  notice_key: z.string().nullable().optional(),
  classmates: z.string().nullable().optional(),
  classmates_source: z.enum(["default", "custom"]).optional(),
});

export const registrationNoticeUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  filetype: z.string().min(1, "Filetype is required"),
});

export const registrationPhotoUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  filetype: z.string().min(1, "Filetype is required"),
  section: z.string().optional(),
  roll: z.string().optional(),
});

export type Class6Registration = z.infer<typeof registrationSchema>;
export type Class6RegistrationStatusData = z.infer<
  typeof class6RegistrationStatusSchema
>;
export type Class6RegistrationSettingsData = z.infer<
  typeof class6RegistrationSettingsSchema
>;
export type RegistrationNoticeUploadData = z.infer<
  typeof registrationNoticeUploadSchema
>;
export type RegistrationPhotoUploadData = z.infer<
  typeof registrationPhotoUploadSchema
>;

export const registrationDefaultValues: Class6Registration = {
  student_name_bn: "",
  student_name_en: "",
  birth_reg_no: "",
  birth_year: "",
  birth_month: "",
  birth_day: "",
  email: "",
  religion: "",
  father_name_bn: "",
  father_name_en: "",
  father_nid: "",
  father_phone: "",
  mother_name_bn: "",
  mother_name_en: "",
  mother_nid: "",
  mother_phone: "",
  permanent_district: "",
  permanent_upazila: "",
  permanent_post_office: "",
  permanent_post_code: "",
  permanent_village_road: "",
  present_district: "",
  present_upazila: "",
  present_post_office: "",
  present_post_code: "",
  present_village_road: "",
  same_as_permanent: false,
  guardian_is_not_father: false,
  guardian_name: "",
  guardian_phone: "",
  guardian_relation: "",
  guardian_nid: "",
  guardian_address_same_as_permanent: false,
  guardian_district: "",
  guardian_upazila: "",
  guardian_post_office: "",
  guardian_post_code: "",
  guardian_village_road: "",
  section: "",
  roll: "",
  prev_school_name: "",
  prev_school_passing_year: "",
  section_in_prev_school: "",
  roll_in_prev_school: "",
  prev_school_district: "",
  prev_school_upazila: "",
  nearby_student_info: "",
  photo: "",
};

export type Class6RegistrationRecord = Class6Registration & {
  id: string;
  photo?: string | null;
  birth_date?: string | null;
  class6_year?: number | null;
  status?: string | null;
  created_at?: string | null;
};
