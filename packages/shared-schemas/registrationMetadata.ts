export interface FieldMetadata {
  tooltip?: string;
  instruction?: string;
}

export interface RegistrationMetadata {
  section: FieldMetadata;
  roll: FieldMetadata;
  student_name_bn: FieldMetadata;
  student_name_en: FieldMetadata;
  birth_reg_no: FieldMetadata;
  father_name_bn: FieldMetadata;
  father_name_en: FieldMetadata;
  father_nid: FieldMetadata;
  mother_name_bn: FieldMetadata;
  mother_name_en: FieldMetadata;
  mother_nid: FieldMetadata;
  photo: FieldMetadata;
}

export const registrationMetadata: RegistrationMetadata = {
  section: {
    tooltip: "Select your assigned section (A or B)",
  },
  roll: {
    tooltip: "Select your class roll number. Must select section first.",
  },
  student_name_bn: {
    tooltip: "ছাত্রের নাম বাংলায় ষষ্ঠ শ্রেণির রেজিস্ট্রেশন অনুযায়ী",
    instruction: "ষষ্ঠ শ্রেণির রেজিস্ট্রেশন অনুযায়ী",
  },
  student_name_en: {
    tooltip: "Enter student name in English according to Class Six Registration",
    instruction: "According to the Registration of class Six",
  },
  birth_reg_no: {
    tooltip: "Enter your 17-digit birth registration number. The year will be automatically extracted from this number",
  },
  father_name_bn: {
    tooltip: "Enter father's name exactly as it appears in class Six registration in Bengali",
    instruction: "ষষ্ঠ শ্রেণির রেজিস্ট্রেশন অনুযায়ী",
  },
  father_name_en: {
    tooltip: "Enter father's name in English",
    instruction: "According to the Registration of class Six",
  },
  father_nid: {
    tooltip: "Enter 10, 13, or 17 digit NID number",
  },
  mother_name_bn: {
    tooltip: "Enter mother's name exactly as it appears in class Six registration in Bengali",
    instruction: "ষষ্ঠ শ্রেণির রেজিস্ট্রেশন অনুযায়ী",
  },
  mother_name_en: {
    tooltip: "Enter mother's name in English",
    instruction: "According to the Registration of class Six",
  },
  mother_nid: {
    tooltip: "Enter 10, 13, or 17 digit NID number",
  },
  photo: {
    tooltip: "Upload a recent passport size photo in school uniform",
    instruction: "JPG format only, Max 2MB",
  },
};
