import {
  Class6Registration,
  Class8Registration,
  Class9Registration,
  registrationSchema,
  registrationSchemaClass8,
  registrationSchemaClass9,
  registrationDefaultValues,
  registrationDefaultValuesClass8,
  registrationDefaultValuesClass9,
  registrationMetadata,
} from '@school/shared-schemas';
import { REG_PHOTO_SIZE_LABEL } from '@/lib/registrationPhoto';
import {
  Class6ExtraFields,
  Class8ExtraFields,
  Class9ExtraFields,
  type ExtraFieldsProps,
} from './ExtraFields';
import type { ComponentType } from 'react';

export type FormKind = 'class-6' | 'class-8' | 'class-9';

const class6Metadata = {
  section: {
    tooltip: 'Select your section (A or B). Available rolls will be shown based on your selection',
  },
  roll: {
    tooltip: 'Select your roll number from the available options for your section',
  },
  student_name_bn: {
    tooltip:
      "Enter your name exactly as it appears in Student's Primary/Birth Registration Certificate in Bengali",
    instruction: '(প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)',
  },
  student_name_en: {
    tooltip:
      "Enter your name exactly as it appears in Student's Primary/Birth Registration Certificate in English",
    instruction: '(According to Primary/Birth Registration Certificate)',
  },
  birth_reg_no: {
    tooltip:
      'Enter your 17-digit birth registration number. The year will be automatically extracted from this number',
  },
  father_name_bn: {
    tooltip:
      "Enter father's name exactly as it appears in SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in Bengali",
    instruction: '(SSC সনদ/NID/ছাত্রের প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)',
  },
  father_name_en: {
    tooltip:
      "Enter father's name exactly as it appears in SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in English",
    instruction:
      "(According to SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate)",
  },
  father_nid: {
    tooltip: "Enter father's National ID number (10-17 digits)",
  },
  mother_name_bn: {
    tooltip:
      "Enter mother's name exactly as it appears in SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in Bengali",
    instruction: '(SSC সনদ/NID/ছাত্রের প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)',
  },
  mother_name_en: {
    tooltip:
      "Enter mother's name exactly as it appears in SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in English",
    instruction:
      "(According to SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate)",
  },
  mother_nid: {
    tooltip: "Enter mother's National ID number (10-17 digits)",
  },
  photo: {
    tooltip: 'Upload a recent photo. File must be JPG format and less than 2MB',
  },
};

const class9Metadata = {
  ...registrationMetadata,
  section: {
    tooltip: 'Select your current Class 9 section',
    instruction: 'নবম শ্রেণির শাখা নির্বাচন করুন',
  },
  roll: {
    tooltip: 'Select your current Class 9 roll number',
    instruction: 'নবম শ্রেণির রোল নম্বর নির্বাচন করুন',
  },
  student_name_bn: {
    tooltip: "Write student's name in Bangla as per JSC/JDC/Class 8 certificate",
    instruction: 'জেএসসি/জেডিসি সনদ অনুযায়ী ছাত্রের নাম বাংলায় লিখুন',
  },
  student_name_en: {
    tooltip: "Write student's name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
    instruction:
      "Write Student's Name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
  },
  birth_reg_no: {
    tooltip: 'Write 17-digit Birth Registration Number',
    instruction: '১৭ ডিজিটের জন্ম নিবন্ধন নম্বর লিখুন',
  },
  father_name_bn: {
    tooltip: "Write father's name in Bangla as per JSC/JDC/Class 8 certificate",
    instruction: 'জেএসসি/জেডিসি সনদ অনুযায়ী পিতার নাম বাংলায় লিখুন',
  },
  father_name_en: {
    tooltip: "Write father's name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
    instruction:
      "Write Father's Name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
  },
  father_nid: {
    tooltip: 'Write 10, 13 or 17 digit NID number',
    instruction: 'পিতার এনআইডি নম্বর লিখুন',
  },
  mother_name_bn: {
    tooltip: "Write mother's name in Bangla as per JSC/JDC/Class 8 certificate",
    instruction: 'জেএসসি/জেডিসি সনদ অনুযায়ী মাতার নাম বাংলায় লিখুন',
  },
  mother_name_en: {
    tooltip: "Write mother's name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
    instruction:
      "Write Mother's Name in English (Capital Letters) as per JSC/JDC/Class 8 certificate",
  },
  mother_nid: {
    tooltip: 'Write 10, 13 or 17 digit NID number',
    instruction: 'মাতার এনআইডি নম্বর লিখুন',
  },
  photo: {
    tooltip: 'Upload a recent passport size photo in school uniform',
    instruction: `বিদ্যালয় ইউনিফর্ম পরিহিত রঙ্গিন ছবি আপলোড করুন (${REG_PHOTO_SIZE_LABEL})`,
  },
};

const CLASS6_REQUIRED: ReadonlyArray<keyof Class6Registration> = [
  'student_name_bn',
  'student_name_en',
  'birth_reg_no',
  'birth_year',
  'birth_month',
  'birth_day',
  'religion',
  'father_name_bn',
  'father_name_en',
  'father_nid',
  'father_phone',
  'mother_name_bn',
  'mother_name_en',
  'mother_nid',
  'mother_phone',
  'permanent_district',
  'permanent_upazila',
  'permanent_post_office',
  'permanent_post_code',
  'permanent_village_road',
  'present_district',
  'present_upazila',
  'present_post_office',
  'present_post_code',
  'present_village_road',
  'guardian_name',
  'guardian_relation',
  'guardian_phone',
  'guardian_nid',
  'guardian_district',
  'guardian_upazila',
  'guardian_post_office',
  'guardian_post_code',
  'guardian_village_road',
  'section',
  'roll',
  'prev_school_name',
  'prev_school_passing_year',
  'section_in_prev_school',
  'roll_in_prev_school',
  'prev_school_district',
  'prev_school_upazila',
  'nearby_student_info',
  'scout_status',
  'photo',
];

export type RegistrationFormConfig = {
  kind: FormKind;
  schema:
    typeof registrationSchema | typeof registrationSchemaClass8 | typeof registrationSchemaClass9;
  defaultValues: Class6Registration | Class8Registration | Class9Registration;
  metadata: any;
  ExtraFields: ComponentType<ExtraFieldsProps>;
  needsSchoolConfig: boolean;
  sameSchoolAutofill: boolean;
  showScoutInPersonal: boolean;
  scoutLabel: string;
  studentNameEnLabel: string;
  fatherNameEnLabel: string;
  motherNameEnLabel: string;
  showNickName: boolean;
  showBloodGroup: boolean;
  photoHelp: 'instruction' | 'p';
  loadingText: string;
  passGuardianMetadata: boolean;
  clearBirthMonthDay: boolean;
  clearPhotoOnFail: boolean;
  validationErrorMessage: boolean;
  title: (isEdit: boolean, settings: any) => string;
  yearForUpload: (settings: any, data: any) => Record<string, unknown>;
  yearForSubmit: (settings: any, data: any) => Record<string, unknown>;
  applyCreateDefaults: (setValue: any, settings: any, schoolConfig: any) => void;
  hydrateEditExtras?: (formData: any, settings: any) => void;
  getPhotoPreview: (data: any) => string | null;
  isRequired: (name?: string) => boolean;
};

export const FORM_CONFIGS: Record<FormKind, RegistrationFormConfig> = {
  'class-6': {
    kind: 'class-6',
    schema: registrationSchema,
    defaultValues: registrationDefaultValues,
    metadata: class6Metadata,
    ExtraFields: Class6ExtraFields,
    needsSchoolConfig: false,
    sameSchoolAutofill: false,
    showScoutInPersonal: true,
    scoutLabel: 'Cub scout/Scout:',
    studentNameEnLabel: "Student's Name (in English)",
    fatherNameEnLabel: "Father's Name (in English)",
    motherNameEnLabel: "Mother's Name (in English)",
    showNickName: false,
    showBloodGroup: false,
    photoHelp: 'instruction',
    loadingText: 'Preparing Form Data',
    passGuardianMetadata: false,
    clearBirthMonthDay: false,
    clearPhotoOnFail: false,
    validationErrorMessage: false,
    title: (isEdit, settings) =>
      isEdit
        ? `Edit Your Information for Class Six Registration ${settings?.class6_year}`
        : `Student's Information for Registration of Class Six ${settings?.class6_year}`,
    yearForUpload: (settings) => ({ class6_year: settings?.class6_year }),
    yearForSubmit: (settings, data) => ({
      class6_year: data.class6_year || settings?.class6_year,
    }),
    applyCreateDefaults: () => {},
    getPhotoPreview: (data) => (typeof data.photo === 'string' && data.photo ? data.photo : null),
    isRequired: (name) => CLASS6_REQUIRED.includes(name as any),
  },
  'class-8': {
    kind: 'class-8',
    schema: registrationSchemaClass8,
    defaultValues: registrationDefaultValuesClass8,
    metadata: registrationMetadata,
    ExtraFields: Class8ExtraFields,
    needsSchoolConfig: true,
    sameSchoolAutofill: true,
    showScoutInPersonal: true,
    scoutLabel: 'Scout:',
    studentNameEnLabel: "Student's Name (in English)",
    fatherNameEnLabel: "Father's Name (in English)",
    motherNameEnLabel: "Mother's Name (in English)",
    showNickName: false,
    showBloodGroup: false,
    photoHelp: 'p',
    loadingText: 'Preparing Form Data',
    passGuardianMetadata: true,
    clearBirthMonthDay: false,
    clearPhotoOnFail: false,
    validationErrorMessage: false,
    title: (isEdit, settings) =>
      isEdit
        ? `Edit Your Information for Class Eight Registration ${settings?.class8_year}`
        : `Student's Information for Registration of Class Eight ${settings?.class8_year}`,
    yearForUpload: (settings) => ({ class8_year: settings?.class8_year }),
    yearForSubmit: (settings) => ({ class8_year: settings?.class8_year }),
    applyCreateDefaults: (setValue, _settings, schoolConfig) => {
      setValue('prev_school_name', schoolConfig.name.en, { shouldValidate: true });
      setValue('prev_school_district', schoolConfig.contact.district, { shouldValidate: true });
    },
    getPhotoPreview: (data) => (typeof data.photo === 'string' && data.photo ? data.photo : null),
    isRequired: () => true,
  },
  'class-9': {
    kind: 'class-9',
    schema: registrationSchemaClass9,
    defaultValues: registrationDefaultValuesClass9,
    metadata: class9Metadata,
    ExtraFields: Class9ExtraFields,
    needsSchoolConfig: true,
    sameSchoolAutofill: true,
    showScoutInPersonal: false,
    scoutLabel: '',
    studentNameEnLabel: "Student's Name (in English) (Capital Letters)",
    fatherNameEnLabel: "Father's Name (in English) (Capital Letters)",
    motherNameEnLabel: "Mother's Name (in English) (Capital Letters)",
    showNickName: true,
    showBloodGroup: true,
    photoHelp: 'p',
    loadingText: 'Preparing Class 9 Form',
    passGuardianMetadata: true,
    clearBirthMonthDay: true,
    clearPhotoOnFail: true,
    validationErrorMessage: true,
    title: (isEdit, settings) =>
      isEdit
        ? `Student's Information for Registration of SSC Exam ${settings?.ssc_year} (Edit)`
        : `Student's Information for Registration of SSC Exam ${settings?.ssc_year}`,
    yearForUpload: (settings, data) => ({
      ssc_batch: data.ssc_batch || settings?.ssc_year?.toString() || '',
    }),
    yearForSubmit: (settings, data) => ({
      ssc_batch: data.ssc_batch || settings?.ssc_year?.toString() || '',
    }),
    applyCreateDefaults: (setValue, settings, schoolConfig) => {
      setValue('ssc_batch', settings?.ssc_year?.toString() || '', { shouldValidate: true });
      setValue('prev_school_name', schoolConfig.name.en, { shouldValidate: true });
      setValue('prev_school_district', schoolConfig.contact.district, { shouldValidate: true });
    },
    hydrateEditExtras: (formData, settings) => {
      formData.ssc_batch = formData.ssc_batch || settings?.ssc_year?.toString() || '';
    },
    getPhotoPreview: (data) => {
      const path = data.photo_path || (typeof data.photo === 'string' ? data.photo : null);
      return path || null;
    },
    isRequired: () => true,
  },
};
