import { z } from "zod";
import {
  registrationObjectShape,
  registrationSuperRefine,
  class6RegistrationSettingsSchema
} from "./class6RegistrationSchemas.js";
import { BANGLA_ONLY } from "./regex.js";

/**
 * Class 9 Registration Schema - extends the common registration shape
 * adds Class 9 specific fields.
 */
export const registrationSchemaClass9 = registrationObjectShape
  .omit({
    prev_school_passing_year: true,
    section_in_prev_school: true,
    roll_in_prev_school: true,
    nearby_student_info: true,
  })
  .extend({
    ssc_batch: z.string().min(1, "SSC Batch is required").default(""),
    student_nick_name_bn: z.string().min(1, "Nickname is required").regex(BANGLA_ONLY, "Only Bangla characters are allowed").default(""),
    blood_group: z.string().optional().or(z.literal("")).default(""),
    jsc_passing_year: z.string().min(1, "JSC Passing Year is required").default(""),
    jsc_board: z.string().min(1, "JSC Board is required").default(""),
    jsc_reg_no: z.string().optional().or(z.literal(""))
      .refine(val => !val || String(val).length === 10, "Registration Number must be exactly 10 digits")
      .default(""),
    jsc_roll_no: z.string().optional().or(z.literal(""))
      .refine(val => !val || String(val).length === 6, "Roll Number must be exactly 6 digits")
      .default(""),
    group_class_nine: z.string().min(1, "Group is required").default(""),
    main_subject: z.string().min(1, "Main Subject is required").default(""),
    fourth_subject: z.string().min(1, "Fourth Subject is required").default(""),
    nearby_nine_student_info: z.string().min(1, "Nearby student information is required").default(""),
    sorkari_brirti: z.enum(["Yes", "No"]).or(z.literal("")).default("No"),
    upobritti: z.enum(["Yes", "No"]).or(z.literal("")).default("No"),
    roll_in_class_8: z.string().min(1, "Roll in Class 8 is required").default(""),
    section_in_class_8: z.string().min(1, "Section in Class 8 is required").default(""),
  })
  .superRefine(registrationSuperRefine);

export const class9RegistrationStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], {
    message: "Status must be pending, approved, or rejected",
  }),
});

/**
 * Class 9 Registration Settings Schema - extends Class 6 settings
 * by replacing the year field.
 */
export const class9RegistrationSettingsSchema = class6RegistrationSettingsSchema
  .omit({ class6_year: true })
  .extend({
    ssc_year: z.union([z.string(), z.number()]).optional(),
  });

export type Class9Registration = z.infer<typeof registrationSchemaClass9>;
export type Class9RegistrationStatusData = z.infer<
  typeof class9RegistrationStatusSchema
>;
export type Class9RegistrationSettingsData = z.infer<
  typeof class9RegistrationSettingsSchema
>;

export const registrationDefaultValuesClass9: Class9Registration = {
  student_name_bn: "",
  student_name_en: "",
  student_nick_name_bn: "",
  birth_reg_no: "",
  birth_year: "",
  birth_month: "",
  birth_day: "",
  blood_group: "",
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
  prev_school_district: "",
  prev_school_upazila: "",
  ssc_batch: "",
  jsc_passing_year: "",
  jsc_board: "",
  jsc_reg_no: "",
  jsc_roll_no: "",
  group_class_nine: "",
  main_subject: "",
  fourth_subject: "",
  nearby_nine_student_info: "",
  sorkari_brirti: "",
  upobritti: "",
  roll_in_class_8: "",
  section_in_class_8: "",
  scout_status: "",
  photo: "",
};

export type Class9RegistrationRecord = Class9Registration & {
  id: string;
  photo_path?: string | null;
  birth_date?: string | null;
  ssc_batch?: string | null;
  ssc_year?: number | null;
  status?: string | null;
  created_at?: string | null;
};
