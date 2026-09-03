import { z } from 'zod';
import {
  registrationObjectShape,
  registrationSuperRefine,
  class6RegistrationSettingsSchema,
} from './class6RegistrationSchemas.js';

/**
 * Junior Scholarship Examination form — Class 8 clone with Class Six
 * prev-school split matching SSC (year / board / reg / roll).
 */
export const registrationSchemaJuniorScholarship = registrationObjectShape
  .omit({
    prev_school_passing_year: true,
    section_in_prev_school: true,
    roll_in_prev_school: true,
  })
  .extend({
    class6_passing_year: z.string().min(1, 'Class Six Passing Year is required').default(''),
    class6_board: z.string().min(1, 'Class Six Board is required').default(''),
    class6_reg_no: z
      .string()
      .min(1, 'Class Six Registration Number is required')
      .refine((val) => val.length === 10, 'Registration Number must be exactly 10 digits')
      .default(''),
    class6_roll_no: z
      .string()
      .min(1, 'Class Six ID/Roll Number is required')
      .refine((val) => val.length === 6, 'Class Six ID/Roll Number must be exactly 6 digits')
      .default(''),
    jse_year: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine(registrationSuperRefine);

export const juniorScholarshipRegistrationStatusSchema = z.object({
  status: z.enum(['pending', 'approved'], {
    message: 'Status must be pending or approved',
  }),
});

export const juniorScholarshipRegistrationSettingsSchema = class6RegistrationSettingsSchema
  .omit({ class6_year: true })
  .extend({
    jse_year: z.union([z.string(), z.number()]).optional(),
  });

export type JuniorScholarshipRegistration = z.infer<typeof registrationSchemaJuniorScholarship>;
export type JuniorScholarshipRegistrationStatusData = z.infer<
  typeof juniorScholarshipRegistrationStatusSchema
>;
export type JuniorScholarshipRegistrationSettingsData = z.infer<
  typeof juniorScholarshipRegistrationSettingsSchema
>;

export const registrationDefaultValuesJuniorScholarship: JuniorScholarshipRegistration = {
  student_name_bn: '',
  student_name_en: '',
  birth_reg_no: '',
  birth_year: '',
  birth_month: '',
  birth_day: '',
  email: '',
  religion: '',
  father_name_bn: '',
  father_name_en: '',
  father_nid: '',
  father_phone: '',
  mother_name_bn: '',
  mother_name_en: '',
  mother_nid: '',
  mother_phone: '',
  permanent_district: '',
  permanent_upazila: '',
  permanent_post_office: '',
  permanent_post_code: '',
  permanent_village_road: '',
  present_district: '',
  present_upazila: '',
  present_post_office: '',
  present_post_code: '',
  present_village_road: '',
  same_as_permanent: false,
  guardian_is_not_father: false,
  guardian_name: '',
  guardian_phone: '',
  guardian_relation: '',
  guardian_nid: '',
  guardian_address_same_as_permanent: false,
  guardian_district: '',
  guardian_upazila: '',
  guardian_post_office: '',
  guardian_post_code: '',
  guardian_village_road: '',
  section: '',
  roll: '',
  prev_school_name: '',
  prev_school_district: '',
  prev_school_upazila: '',
  nearby_student_info: '',
  class6_passing_year: '',
  class6_board: '',
  class6_reg_no: '',
  class6_roll_no: '',
  scout_status: '',
  photo: '',
  jse_year: '',
};

export type JuniorScholarshipRegistrationRecord = JuniorScholarshipRegistration & {
  id: string;
  photo?: string | null;
  birth_date?: string | null;
  jse_year?: number | null;
  status?: string | null;
  created_at?: string | null;
};
