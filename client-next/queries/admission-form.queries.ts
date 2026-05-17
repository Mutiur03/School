import { api } from "@/lib/backend";

export type AdmissionFormRecord = Record<string, unknown> & {
  id?: string | number;
  status?: string | null;
};
export type ConfirmationAdmission_Props = {
  id?: string;
  // Personal Information
  student_name_bn?: string | null;
  student_nick_name_bn?: string | null;
  student_name_en?: string | null;
  birth_reg_no?: string | null;
  registration_no?: string | null;

  father_name_bn?: string | null;
  father_name_en?: string | null;
  father_nid?: string | null;
  father_phone?: string | null;

  mother_name_bn?: string | null;
  mother_name_en?: string | null;
  mother_nid?: string | null;
  mother_phone?: string | null;

  birth_date?: string | null;
  birth_year?: string | null;
  birth_month?: string | null;
  birth_day?: string | null;
  blood_group?: string | null;
  email?: string | null;
  religion?: string | null;

  // Address
  present_district?: string | null;
  present_upazila?: string | null;
  present_post_office?: string | null;
  present_post_code?: string | null;
  present_village_road?: string | null;

  permanent_district?: string | null;
  permanent_upazila?: string | null;
  permanent_post_office?: string | null;
  permanent_post_code?: string | null;
  permanent_village_road?: string | null;

  // Guardian
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relation?: string | null;
  guardian_nid?: string | null;
  guardian_district?: string | null;
  guardian_upazila?: string | null;
  guardian_post_office?: string | null;
  guardian_post_code?: string | null;
  guardian_village_road?: string | null;

  // Previous school
  prev_school_name?: string | null;
  prev_school_district?: string | null;
  prev_school_upazila?: string | null;
  section_in_prev_school?: string | null;
  roll_in_prev_school?: string | null;
  prev_school_passing_year?: string | null;

  father_profession?: string | null;
  mother_profession?: string | null;
  parent_income?: string | null;

  // Admission meta
  admission_class?: string | null;
  list_type?: string | null;
  admission_user_id?: string | null;
  serial_no?: string | null;
  qouta?: string | null;
  whatsapp_number?: string | null;
  // Photo
  photo_path?: string | null;

  status?: string | null;
  [key: string]: unknown;
};

export const getAdmissionFormRecord = async (
  id: string,
): Promise<ConfirmationAdmission_Props | null> => {
  const response = await api.get<{
    success: boolean;
    data: ConfirmationAdmission_Props;
  }>(`/api/admission/form/${id}`, { cache: "no-store" });
  return response.data?.data ?? null;
};
