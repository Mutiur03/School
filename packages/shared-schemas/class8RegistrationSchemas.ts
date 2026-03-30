import { z } from "zod";
import {
  REGISTRATION_NO,
} from "./regex.js";
import {
  registrationObjectShape,
  registrationSuperRefine,
  class6RegistrationSettingsSchema
} from "./class6RegistrationSchemas.js";

/**
 * Class 8 Registration Schema - extends the common Class 6 registration shape
 * but omits class-specific passing/roll info and adds Class 8 specific fields.
 */
export const registrationSchemaClass8 = registrationObjectShape
  .omit({
    prev_school_passing_year: true,
    section_in_prev_school: true,
    roll_in_prev_school: true,
  })
  .extend({
    registration_no: z
      .string()
      .min(1, "Registration Number is required")
      .regex(REGISTRATION_NO, "Invalid registration number")
      .default(""),
    class6_academic_session: z
      .string()
      .min(1, "Class 6 Academic Session is required")
      .default(""),
    class8_year: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine(registrationSuperRefine);

export const class8RegistrationStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], {
    message: "Status must be pending, approved, or rejected",
  }),
});

/**
 * Class 8 Registration Settings Schema - extends Class 6 settings
 * by replacing the year field.
 */
export const class8RegistrationSettingsSchema = class6RegistrationSettingsSchema
  .omit({ class6_year: true })
  .extend({
    class8_year: z.union([z.string(), z.number()]).optional(),
  });

export type Class8Registration = z.infer<typeof registrationSchemaClass8>;
export type Class8RegistrationStatusData = z.infer<
  typeof class8RegistrationStatusSchema
>;
export type Class8RegistrationSettingsData = z.infer<
  typeof class8RegistrationSettingsSchema
>;

export const registrationDefaultValuesClass8: Class8Registration = {
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
  prev_school_district: "",
  prev_school_upazila: "",
  nearby_student_info: "",
  registration_no: "",
  class6_academic_session: "",
  scout_status: "",
  photo: "",
  class8_year: "",
};

export type Class8RegistrationRecord = Class8Registration & {
  id: string;
  photo?: string | null;
  birth_date?: string | null;
  class8_year?: number | null;
  status?: string | null;
  created_at?: string | null;
};
