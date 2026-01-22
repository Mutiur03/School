import React, { useEffect, useState } from "react";
import { z } from "zod";
import {
  useForm,
  useWatch,
  type FieldError,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { districts, getUpazilasByDistrict } from "@/lib/location";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { getFileUrl } from "@/lib/backend";

const admissionSchema = z
  .object({
    student_name_bn: z
      .string()
      .min(1, "Student Name in Bangla is required")
      .max(100)
      .regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed")
      .default(""),
    student_nick_name_bn: z
      .string()
      .min(1, "Student Nickname in Bangla is required")
      .max(50)
      .regex(/^[\u0980-\u09FF\s]*$/, "Only Bangla characters are allowed")
      .default(""),
    student_name_en: z
      .string()
      .min(1, "Student Name in English is required")
      .max(100)
      .regex(/^[A-Za-z\s]+$/, "Only English characters are allowed")
      .default(""),
    birth_reg_no: z
      .string()
      .min(1, "Birth Registration Number is required")
      .max(17, "Birth Registration Number must be 17 characters")
      .regex(/^\d{17}$/, "Birth Registration Number must be 17 digits")
      .default(""),
    registration_no: z.string().default(""),

    father_name_bn: z
      .string()
      .min(1, "Father's Name in Bangla is required")
      .max(100)
      .regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed")
      .default(""),
    father_name_en: z
      .string()
      .min(1, "Father's Name in English is required")
      .max(100)
      .regex(/^[A-Za-z\s]+$/, "Only English characters are allowed")
      .default(""),
    father_nid: z
      .string()
      .min(10, "Father's NID is required")
      .max(17)
      .regex(/^\d{10,17}$/, "Father's NID must be 10 to 17 digits")
      .default(""),
    father_phone: z
      .string()
      .length(11, "Phone number must be 11 digits")
      .regex(/^01[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
      .default(""),

    mother_name_bn: z
      .string()
      .min(1, "Mother's Name in Bangla is required")
      .max(100)
      .regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed")
      .default(""),
    mother_name_en: z
      .string()
      .min(1, "Mother's Name in English is required")
      .max(100)
      .regex(/^[A-Za-z\s]+$/, "Only English characters are allowed")
      .default(""),
    mother_nid: z
      .string()
      .min(10, "Mother's NID is required")
      .max(17)
      .regex(/^\d{10,17}$/, "Mother's NID must be 10 to 17 digits")
      .default(""),
    mother_phone: z
      .string()
      .length(11, "Phone number must be 11 digits")
      .regex(/^01[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
      .default(""),

    birth_date: z.string().max(10).default(""),
    birth_year: z
      .string()
      .min(1, "Birth Year is required")
      .max(4)
      .regex(/^\d{4}$/, "Year must be 4 digits")
      .default(""),
    birth_month: z
      .string()
      .min(1, "Birth Month is required")
      .max(2)
      .regex(/^(0[1-9]|1[0-2])$/, "Month must be 01-12")
      .default(""),
    birth_day: z
      .string()
      .min(1, "Birth Day is required")
      .max(2)
      .regex(/^(0[1-9]|[12]\d|3[01])$/, "Day must be 01-31")
      .default(""),
    blood_group: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""])
      .default(""),
    email: z.preprocess(
      (v) => (v === null ? "" : v),
      z
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
    ),
    religion: z.string().min(1, "Religion is required").max(50).default(""),

    present_district: z
      .string()
      .min(1, "Present District is required")
      .max(50)
      .default(""),
    present_upazila: z
      .string()
      .min(1, "Present Upazila is required")
      .max(50)
      .default(""),
    present_post_office: z
      .string()
      .min(1, "Present Post Office is required")
      .max(100)
      .default(""),
    present_post_code: z
      .string()
      .min(4, "Present Post Code is required")
      .max(4)
      .regex(/^\d{4}$/, "Post code must be 4 digits")
      .default(""),
    present_village_road: z
      .string()
      .min(1, "Present Village/Road is required")
      .max(200)
      .default(""),

    permanent_district: z
      .string()
      .min(1, "Permanent District is required")
      .max(50)
      .default(""),
    permanent_upazila: z
      .string()
      .min(1, "Permanent Upazila is required")
      .max(50)
      .default(""),
    permanent_post_office: z
      .string()
      .min(1, "Permanent Post Office is required")
      .max(100)
      .default(""),
    permanent_post_code: z
      .string()
      .min(4, "Permanent Post Code is required")
      .max(4)
      .regex(/^\d{4}$/, "Post code must be 4 digits")
      .default(""),
    permanent_village_road: z
      .string()
      .min(1, "Permanent Village/Road is required")
      .max(200)
      .default(""),

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
        .regex(/^$|^01[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
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
        .regex(/^$|^\d{10,17}$/, "Guardian NID must be 10 to 17 digits")
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
      z.string().max(100).default(""),
    ),
    guardian_post_code: z.preprocess(
      (v) => (v === null ? "" : v),
      z
        .string()
        .regex(/^$|^\d{4}$/, "Post code must be 4 digits")
        .default(""),
    ),
    guardian_village_road: z.preprocess(
      (v) => (v === null ? "" : v),
      z.string().max(200).default(""),
    ),

    prev_school_name: z
      .string()
      .min(1, "Previous School Name is required")
      .max(200)
      .default(""),
    prev_school_district: z
      .string()
      .min(1, "Previous School District is required")
      .max(50)
      .default(""),
    prev_school_upazila: z
      .string()
      .min(1, "Previous School Upazila is required")
      .max(50)
      .default(""),
    section_in_prev_school: z
      .string()
      .min(1, "Section is required")
      .max(10)
      .default(""),
    roll_in_prev_school: z
      .string()
      .min(1, "Roll Number is required")
      .max(20)
      .default(""),
    prev_school_passing_year: z
      .string()
      .min(1, "Passing Year is required")
      .max(4)
      .regex(/^\d{4}$/, "Year must be 4 digits")
      .default(""),

    father_profession: z
      .string()
      .min(1, "Father's Profession is required")
      .max(100)
      .default(""),
    mother_profession: z
      .string()
      .min(1, "Mother's Profession is required")
      .max(100)
      .default(""),
    parent_income: z
      .string()
      .min(1, "Parent's Annual Income is required")
      .max(100)
      .default(""),

    admission_class: z
      .string()
      .min(1, "Admission Class is required")
      .max(50)
      .default(""),
    list_type: z.string().min(1, "List Type is required").max(50).default(""),
    admission_user_id: z
      .string()
      .min(1, "User ID is required")
      .max(50)
      .default(""),
    serial_no: z.string().min(1, "Serial No is required").max(50).default(""),
    qouta: z.string().min(1, "Qouta is required").max(50).default(""),

    photo_path: z.string().min(1, "Photo is required").max(255).default(""),
    whatsapp_number: z.preprocess(
      (v) => (v === null ? "" : v),
      z
        .string()
        .max(11)
        .regex(/^$|^01[3-9][0-9]{8}$/, "Invalid Bangladeshi phone number")
        .default(""),
    ),
    admission_year: z.preprocess(
      (v) => (v === null ? undefined : typeof v === "string" ? parseInt(v) : v),
      z.number().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.guardian_is_not_father) {
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
      } else if (!/^01[3-9][0-9]{8}$/.test(data.guardian_phone)) {
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
      } else if (!/^\d{10,17}$/.test(data.guardian_nid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian NID must be 10 to 17 digits",
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

    if (data.admission_class) {
      const cls = String(data.admission_class).trim().toLowerCase();
      const isEightOrNine =
        cls === "8" ||
        cls.includes("8") ||
        cls.includes("eight") ||
        cls === "9" ||
        cls.includes("9") ||
        cls.includes("nine");
      if (isEightOrNine) {
        if (!data.registration_no || !/^\d{10}$/.test(data.registration_no)) {
          if (!data.registration_no || !/^\d{10}$/.test(data.registration_no)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Registration Number must be 10 digits",
              path: ["registration_no"],
            });
          }
        }
      }
    }
  });
type AdmissionFormData = z.infer<typeof admissionSchema>;
const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-gray-900">{children}</p>
);
const Error: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-red-600 text-sm">{children}</div>
);

type Duplicate = {
  message: string;
  existingRecord?: {
    id?: string | number;
  };
};
const DuplicateWarning: React.FC<{ duplicates: Duplicate[] }> = ({
  duplicates,
}) => (
  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
    <div className="flex items-start gap-2">
      <svg
        className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <h3 className="text-yellow-800 font-semibold mb-2">
          Duplicate Information Detected
        </h3>
        <div className="space-y-2">
          {duplicates.map((duplicate, index) => (
            <div key={index} className="text-yellow-700 text-sm">
              <p className="font-medium">{duplicate.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
const FieldRow: React.FC<{
  label: React.ReactNode;
  isRequired: boolean;
  instruction?: React.ReactNode;
  error: FieldError | undefined;
  tooltip?: string;
  children: React.ReactNode;
}> = ({ label, isRequired, instruction, error, tooltip, children }) => (
  <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
    <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 shrink-0">
      <span className="flex items-center gap-1">
        <span>
          {label}
          {isRequired && (
            <span className="text-red-600 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </span>
        {tooltip && (
          <span className="cursor-pointer group relative inline-block align-middle">
            <div className="w-4 h-4 bg-blue-500 border border-blue-400 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-blue-700 transition-colors">
              ?
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs px-2 py-1 rounded bg-gray-800 text-white text-sm opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none z-20 transition-opacity duration-200">
              {tooltip}
            </span>
          </span>
        )}
      </span>
    </div>
    <div className="flex-1 w-full min-w-0">
      {children}
      {instruction && <Instruction>{instruction}</Instruction>}
      {error && <Error>{error.message}</Error>}
    </div>
  </div>
);

function getUserIdListFromSettings(
  settings: AdmissionSettings | null | undefined,
  admission_class?: string | null,
) {
  if (!settings) return [];
  const cls = String(admission_class || "")
    .trim()
    .toLowerCase();
  if (cls === "6" || cls.includes("6") || cls.includes("six"))
    return parseCsvString(settings.user_id_class6);
  if (cls === "7" || cls.includes("7") || cls.includes("seven"))
    return parseCsvString(settings.user_id_class7);
  if (cls === "8" || cls.includes("8") || cls.includes("eight"))
    return parseCsvString(settings.user_id_class8);
  if (cls === "9" || cls.includes("9") || cls.includes("nine"))
    return parseCsvString(settings.user_id_class9);
  return [];
}
function parseCsvString(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  const normalized = String(v).replace(/[–—−]/g, "-");
  return normalized
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
type AdmissionSettings = {
  user_id_class6?: string | null;
  user_id_class7?: string | null;
  user_id_class8?: string | null;
  user_id_class9?: string | null;
  [key: string]: unknown;
};
function Form() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    setError,
    setFocus,
    control,
  } = useForm<AdmissionFormData>({
    resolver: zodResolver(admissionSchema) as Resolver<AdmissionFormData>,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: admissionSchema.parse({}),
  });
  const { id } = useParams();

  const [permanentUpazillas, setPermanentUpazillas] = useState<
    { id: string; name: string }[]
  >([]);
  const [presentUpazillas, setPresentUpazillas] = useState<
    { id: string; name: string }[]
  >([]);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [guardianUpazillas, setGuardianUpazillas] = useState<
    { id: string; name: string }[]
  >([]);
  const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<
    { id: string; name: string }[]
  >([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const isEditMode = Boolean(id);
  const [admission_year, setAdmissionYear] = useState(new Date().getFullYear());
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const classGuidance: Record<
    string,
    Record<string, { instruction?: string; tooltip?: string }>
  > = {
    sixx: {
      studentNameBn: {
        instruction: "(প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)",
        tooltip:
          "Enter your name as shown in Primary/Birth Registration Card in Bengali",
      },
      studentNameEn: {
        instruction: "(According to Primary/Birth Registration Card)",
        tooltip:
          "Enter your name as shown in Primary/Birth Registration Card in English capital letters",
      },
      fatherNameBn: {
        instruction: "(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)",
        tooltip:
          "Enter father's name as shown in SSC Certificate/National ID Card in Bengali",
      },
      fatherNameEn: {
        instruction: "(According to SSC Certificate/National ID Card)",
        tooltip:
          "Enter father's name as shown in SSC Certificate/National ID Card in English capital letters",
      },
      motherNameBn: {
        instruction: "(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)",
        tooltip:
          "Enter mother's name as shown in SSC Certificate/National ID Card in Bengali",
      },
      motherNameEn: {
        instruction: "(According to SSC Certificate/National ID Card)",
        tooltip:
          "Enter mother's name as shown in SSC Certificate/National ID Card in English capital letters",
      },
    },
    seven: {
      studentNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)",
        tooltip:
          "Enter your name as it appears in your Class Six Printout in Bengali",
      },
      studentNameEn: {
        instruction: "(According to Class Six Printout)",
        tooltip:
          "Enter your name as it appears in your Class Six Printout in English capital letters",
      },
      fatherNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)",
        tooltip:
          "Enter father's name as it appears in Class Six Printout in Bengali",
      },
      fatherNameEn: {
        instruction: "(According to Class Six Printout)",
        tooltip:
          "Enter father's name as it appears in Class Six Printout in English capital letters",
      },
      motherNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)",
        tooltip:
          "Enter mother's name as it appears in Class Six Printout in Bengali",
      },
      motherNameEn: {
        instruction: "(According to Class Six Printout)",
        tooltip:
          "Enter mother's name as it appears in Class Six Printout in English capital letters",
      },
    },
    eight: {
      studentNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter your name as it appears in your Class Six Registration Card in Bengali",
      },
      studentNameEn: {
        instruction: "(According to Class Six Registration Card)",
        tooltip:
          "Enter your name as it appears in your Class Six Registration Card in English capital letters",
      },
      fatherNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter father's name as it appears in Class Six Registration Card in Bengali",
      },
      fatherNameEn: {
        instruction: "(According to Class Six Registration Card)",
        tooltip:
          "Enter father's name as it appears in Class Six Registration Card in English capital letters",
      },
      motherNameBn: {
        instruction: "(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter mother's name as it appears in Class Six Registration Card in Bengali",
      },
      motherNameEn: {
        instruction: "(According to Class Six Registration Card)",
        tooltip:
          "Enter mother's name as it appears in Class Six Registration Card in English capital letters",
      },
    },
    nine: {
      studentNameBn: {
        instruction:
          "(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in Bengali",
      },
      studentNameEn: {
        instruction: "(According to JSC Printout/Class Six Registration Card)",
        tooltip:
          "Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in English capital letters",
      },
      fatherNameBn: {
        instruction:
          "(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali",
      },
      fatherNameEn: {
        instruction: "(According to JSC Printout/Class Six Registration Card)",
        tooltip:
          "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters",
      },
      motherNameBn: {
        instruction:
          "(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)",
        tooltip:
          "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali",
      },
      motherNameEn: {
        instruction: "(According to JSC Printout/Class Six Registration Card)",
        tooltip:
          "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters",
      },
    },
  };
  const [classListOptions, setClassListOptions] = useState<string[]>([]);
  const [listTypeOptions, setListTypeOptions] = useState<string[]>([]);
  const [admissionSettings, setAdmissionSettings] =
    useState<AdmissionSettings | null>(null);
  const [userIdOptions, setUserIdOptions] = useState<string[]>([]);
  const [serialNoOptions, setSerialNoOptions] = useState<string[]>([]);
  const [admissionClosed, setAdmissionClosed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [tempDataonEdit, setTempDataOnEdit] = useState<Record<string, string>>(
    {},
  );
  const admission_class = useWatch({ control, name: "admission_class" });
  const permanent_district = useWatch({ control, name: "permanent_district" });
  const permanent_upazila = useWatch({ control, name: "permanent_upazila" });
  const permanent_post_office = useWatch({
    control,
    name: "permanent_post_office",
  });
  const permanent_post_code = useWatch({
    control,
    name: "permanent_post_code",
  });
  const permanent_village_road = useWatch({
    control,
    name: "permanent_village_road",
  });
  const present_district = useWatch({ control, name: "present_district" });
  const guardian_is_not_father = useWatch({
    control,
    name: "guardian_is_not_father",
  });
  const guardian_address_same_as_permanent = useWatch({
    control,
    name: "guardian_address_same_as_permanent",
  });
  const guardian_district = useWatch({ control, name: "guardian_district" });
  const prev_school_district = useWatch({
    control,
    name: "prev_school_district",
  });
  const birth_year = useWatch({ control, name: "birth_year" });
  const birth_month = useWatch({ control, name: "birth_month" });
  const birth_reg_no = useWatch({ control, name: "birth_reg_no" });
  const father_profession = useWatch({ control, name: "father_profession" });
  const mother_profession = useWatch({ control, name: "mother_profession" });
  const admission_user_id = useWatch({ control, name: "admission_user_id" });

  function getGuidance(fieldKey: string) {
    const clsKey = normalizeClassKey(admission_class);
    if (!clsKey)
      return {
        instruction: undefined as string | undefined,
        tooltip: undefined as string | undefined,
      };
    const data = classGuidance[clsKey];
    if (!data)
      return {
        instruction: undefined as string | undefined,
        tooltip: undefined as string | undefined,
      };
    return (
      data[fieldKey] || {
        instruction: undefined as string | undefined,
        tooltip: undefined as string | undefined,
      }
    );
  }
  function normalizeClassKey(c?: string | null) {
    if (!c) return "";
    const s = String(c).trim().toLowerCase();
    if (s === "6" || s.includes("6") || s.includes("six")) return "sixx";
    if (s === "7" || s.includes("7") || s.includes("seven")) return "seven";
    if (s === "8" || s.includes("8") || s.includes("eight")) return "eight";
    if (s === "9" || s.includes("9") || s.includes("nine")) return "nine";
    return "";
  }
  useEffect(() => {
    const selectedDistrictId = permanent_district;
    if (!selectedDistrictId) {
      setPermanentUpazillas([]);
      return;
    }
    const upazilas = getUpazilasByDistrict(selectedDistrictId);
    setPermanentUpazillas(upazilas);
  }, [permanent_district]);
  useEffect(() => {
    const selectedDistrictId = present_district;
    if (!selectedDistrictId) {
      setPresentUpazillas([]);
      return;
    }
    const upazilas = getUpazilasByDistrict(selectedDistrictId);
    setPresentUpazillas(upazilas);
  }, [present_district]);
  useEffect(() => {
    if (!guardian_is_not_father || guardian_address_same_as_permanent) {
      setGuardianUpazillas([]);
      return;
    }
    const selectedDistrictId = guardian_district;
    if (!selectedDistrictId) {
      setGuardianUpazillas([]);
      return;
    }
    const upazilas = getUpazilasByDistrict(selectedDistrictId);
    setGuardianUpazillas(upazilas);
  }, [
    guardian_is_not_father,
    guardian_district,
    guardian_address_same_as_permanent,
  ]);
  useEffect(() => {
    if (sameAsPermanent) {
      setValue("present_district", permanent_district, {
        shouldValidate: true,
      });
      setValue("present_upazila", permanent_upazila, { shouldValidate: true });
      setValue("present_post_office", permanent_post_office, {
        shouldValidate: true,
      });
      setValue("present_post_code", permanent_post_code, {
        shouldValidate: true,
      });
      setValue("present_village_road", permanent_village_road, {
        shouldValidate: true,
      });
    }
  }, [
    sameAsPermanent,
    permanent_district,
    permanent_upazila,
    permanent_post_office,
    permanent_post_code,
    permanent_village_road,
    setValue,
  ]);
  useEffect(() => {
    if (!guardian_is_not_father || guardian_address_same_as_permanent) {
      setValue("guardian_district", "", { shouldValidate: true });
      setValue("guardian_upazila", "", { shouldValidate: true });
      setValue("guardian_post_office", "", { shouldValidate: true });
      setValue("guardian_post_code", "", { shouldValidate: true });
      setValue("guardian_village_road", "", { shouldValidate: true });
    }
  }, [guardian_is_not_father, guardian_address_same_as_permanent, setValue]);
  useEffect(() => {
    const selectedDistrictId = prev_school_district;
    if (!selectedDistrictId) {
      setPrevSchoolUpazilas([]);
      return;
    }
    const upazilas = getUpazilasByDistrict(selectedDistrictId);
    setPrevSchoolUpazilas(upazilas);
  }, [prev_school_district]);
  function isClassEightOrNine(c?: string | null) {
    const k = normalizeClassKey(c);
    return k === "eight" || k === "nine";
  }
  const requiredFields: Array<keyof AdmissionFormData> = [
    "student_name_bn",
    "student_nick_name_bn",
    "student_name_en",
    "birth_reg_no",
    "father_name_bn",
    "father_name_en",
    "father_nid",
    "father_phone",
    "mother_name_bn",
    "mother_name_en",
    "mother_nid",
    "mother_phone",
    "birth_year",
    "birth_month",
    "birth_day",
    "religion",
    "present_district",
    "present_upazila",
    "present_post_office",
    "present_post_code",
    "present_village_road",
    "permanent_district",
    "permanent_upazila",
    "permanent_post_office",
    "permanent_post_code",
    "permanent_village_road",
    "prev_school_name",
    "prev_school_district",
    "prev_school_upazila",
    "section_in_prev_school",
    "roll_in_prev_school",
    "prev_school_passing_year",
    "father_profession",
    "mother_profession",
    "parent_income",
    "admission_class",
    "list_type",
    "admission_user_id",
    "serial_no",
    "qouta",
    "photo_path",
  ];
  const isRequired = (field: keyof AdmissionFormData) =>
    requiredFields.includes(field);
  function expandSerialList(tokens: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of tokens) {
      const m = String(t).match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
      if (m) {
        let a = Number(m[1]);
        let b = Number(m[2]);
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        if (a > b) [a, b] = [b, a];
        for (let i = a; i <= b; i++) {
          const s = String(i);
          if (!seen.has(s)) {
            seen.add(s);
            result.push(s);
          }
        }
      } else {
        const s = String(t).trim();
        if (!s) continue;
        if (!seen.has(s)) {
          seen.add(s);
          result.push(s);
        }
      }
    }
    return result;
  }

  useEffect(() => {
    const initializeData = async () => {
      try {
        setInitialLoading(true);

        const admissionStatusResponse = await axios.get("/api/admission");
        if (admissionStatusResponse.data) {
          const { admission_open } = admissionStatusResponse.data;
          setAdmissionYear(Number(admissionStatusResponse.data.admission_year));
          setAdmissionSettings(admissionStatusResponse.data);
          const clsList = parseCsvString(
            admissionStatusResponse.data.class_list,
          );
          if (clsList.length) setClassListOptions(clsList);
          if (!admission_open) {
            setAdmissionClosed(true);
            setInitialLoading(false);
            return;
          }
          if (!isEditMode) {
            setValue(
              "admission_year",
              Number(admissionStatusResponse.data.admission_year),
            );
          }
        } else {
          navigate("/", { replace: true });
          return;
        }
        if (isEditMode && id) {
          const response = await axios.get(`/api/admission/form/${id}`);
          if (response.data.success) {
            const data = response.data.data;
            if (data.status !== "pending") {
              setShouldNavigate(true);
              navigate("/admission/form/confirm/" + id, { replace: true });
              return;
            }
            if (data) {
              reset(data);
              if (data.guardian_name && data.guardian_name.trim() !== "") {
                setValue("guardian_is_not_father", true);
              } else {
                setValue("guardian_is_not_father", false);
              }
              const isSame =
                data.present_district === data.permanent_district &&
                data.present_upazila === data.permanent_upazila &&
                data.present_post_office === data.permanent_post_office &&
                data.present_post_code === data.permanent_post_code &&
                data.present_village_road === data.permanent_village_road;
              const isGuardianSameAsPermanent =
                data.guardian_district === data.permanent_district &&
                data.guardian_upazila === data.permanent_upazila &&
                data.guardian_post_office === data.permanent_post_office &&
                data.guardian_post_code === data.permanent_post_code &&
                data.guardian_village_road === data.permanent_village_road;
              setValue(
                "guardian_address_same_as_permanent",
                isGuardianSameAsPermanent,
              );
              setSameAsPermanent(isSame);

              setGuardianUpazillas(
                getUpazilasByDistrict(data.guardian_district),
              );
              setPermanentUpazillas(
                getUpazilasByDistrict(data.permanent_district),
              );
              setPresentUpazillas(getUpazilasByDistrict(data.present_district));
              setPrevSchoolUpazilas(
                getUpazilasByDistrict(data.prev_school_district),
              );
              setValue("guardian_upazila", data.guardian_upazila);
              setValue("present_upazila", data.present_upazila);
              setValue("permanent_upazila", data.permanent_upazila);
              setValue("prev_school_upazila", data.prev_school_upazila);
              setTempDataOnEdit({
                list_type: data.list_type,
                serial_no: data.serial_no,
              });
            }

            if (data.photo_path) {
              try {
                setPhotoPreview(`${getFileUrl(data.photo_path)}`);
              } catch (photoError) {
                console.warn("Could not load existing photo:", photoError);
              }
            }
          } else {
            setShouldNavigate(true);
            navigate("/admission/form", { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error("Failed to initialize data:", error);
        if (isEditMode) {
          setShouldNavigate(true);
          navigate("/admission/form", { replace: true });
          return;
        } else {
          setShouldNavigate(true);
          navigate("/", { replace: true });
          return;
        }
      } finally {
        setInitialLoading(false);
      }
    };

    initializeData();
  }, [isEditMode, id, navigate, reset, setValue]);
  useEffect(() => {
    if (!admissionSettings || initialLoading) return;
    if (!isClassEightOrNine(admission_class)) {
      setValue("registration_no", "", { shouldValidate: true });
    }
    const list = getUserIdListFromSettings(admissionSettings, admission_class);
    setUserIdOptions(list);
    const cls = String(admission_class || "")
      .trim()
      .toLowerCase();
    const getSetting = (k: string) =>
      (admissionSettings as Record<string, unknown>)[k];
    let listTypeTokens: string[] = [];
    let serialRawTokens: string[] = [];
    let user_id_list: string[] = [];
    if (cls === "6" || cls.includes("6") || cls.includes("six")) {
      listTypeTokens = parseCsvString(
        getSetting("list_type_class6") ??
          getSetting("listTypeClass6") ??
          getSetting("list_type") ??
          getSetting("listType"),
      );
      serialRawTokens = parseCsvString(
        getSetting("serial_no_class6") ??
          getSetting("serialNoClass6") ??
          getSetting("serial_no") ??
          getSetting("serialNo"),
      );
      user_id_list = getUserIdListFromSettings(
        admissionSettings,
        admission_class,
      );
    } else if (cls === "7" || cls.includes("7") || cls.includes("seven")) {
      listTypeTokens = parseCsvString(
        getSetting("list_type_class7") ??
          getSetting("listTypeClass7") ??
          getSetting("list_type") ??
          getSetting("listType"),
      );
      serialRawTokens = parseCsvString(
        getSetting("serial_no_class7") ??
          getSetting("serialNoClass7") ??
          getSetting("serial_no") ??
          getSetting("serialNo"),
      );
      user_id_list = getUserIdListFromSettings(
        admissionSettings,
        admission_class,
      );
    } else if (cls === "8" || cls.includes("8") || cls.includes("eight")) {
      listTypeTokens = parseCsvString(
        getSetting("list_type_class8") ??
          getSetting("listTypeClass8") ??
          getSetting("list_type") ??
          getSetting("listType"),
      );
      serialRawTokens = parseCsvString(
        getSetting("serial_no_class8") ??
          getSetting("serialNoClass8") ??
          getSetting("serial_no") ??
          getSetting("serialNo"),
      );
      user_id_list = getUserIdListFromSettings(
        admissionSettings,
        admission_class,
      );
    } else if (cls === "9" || cls.includes("9") || cls.includes("nine")) {
      listTypeTokens = parseCsvString(
        getSetting("list_type_class9") ??
          getSetting("listTypeClass9") ??
          getSetting("list_type") ??
          getSetting("listType"),
      );
      serialRawTokens = parseCsvString(
        getSetting("serial_no_class9") ??
          getSetting("serialNoClass9") ??
          getSetting("serial_no") ??
          getSetting("serialNo"),
      );
      user_id_list = getUserIdListFromSettings(
        admissionSettings,
        admission_class,
      );
    } else {
      listTypeTokens = parseCsvString(
        getSetting("list_type") ?? getSetting("listType"),
      );
      serialRawTokens = parseCsvString(
        getSetting("serial_no") ?? getSetting("serialNo"),
      );
      user_id_list = getUserIdListFromSettings(
        admissionSettings,
        admission_class,
      );
    }

    if (listTypeTokens.length) {
      setListTypeOptions(listTypeTokens);
    } else {
      setListTypeOptions([]);
    }
    if (user_id_list.length) {
      setUserIdOptions(user_id_list);
    } else {
      setUserIdOptions([]);
    }
    const serialList = expandSerialList(serialRawTokens);
    if (serialList.length) setSerialNoOptions(serialList);
    else setSerialNoOptions([]);
  }, [admissionSettings, admission_class, initialLoading]);
  useEffect(() => {
    if (
      isEditMode &&
      !initialLoading &&
      tempDataonEdit.list_type &&
      tempDataonEdit.serial_no &&
      listTypeOptions.length > 0 &&
      userIdOptions.length > 0
    ) {
      setValue("list_type", tempDataonEdit.list_type, { shouldValidate: true });
      setValue("serial_no", tempDataonEdit.serial_no, { shouldValidate: true });
    }
  }, [
    isEditMode,
    initialLoading,
    tempDataonEdit,
    setValue,
    listTypeOptions,
    userIdOptions,
  ]);
  function filterEnglishInput(e: React.FormEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    return target.value.replace(/[^A-Za-z.()\s]/g, "");
  }

  function filterBanglaInput(e: React.FormEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    return target.value.replace(/[^\u0980-\u09FF.()\s]/g, "");
  }
  function filterNumericInput(e: React.FormEvent<HTMLInputElement>) {
    const target = e.target as HTMLInputElement;
    return target.value.replace(/[^\d]/g, "");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { files } = e.target;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (
      !file.type.includes("jpeg") &&
      !file.type.includes("jpg") &&
      file.type !== "image/jpeg"
    ) {
      alert("Only JPG format is allowed");
      if (e.target) e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File must be smaller than 2MB");
      if (e.target) e.target.value = "";
      return;
    }
    setPhoto(file);
    setValue("photo_path", file.name, { shouldValidate: true });
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  const onSubmit = async (data: AdmissionFormData) => {
    if (
      userIdOptions.length > 0 &&
      admission_user_id &&
      !userIdOptions.includes(admission_user_id)
    ) {
      setError("admission_user_id", {
        type: "manual",
        message: "Invalid User ID for the selected class",
      });
      setFocus("admission_user_id");
      return;
    }

    let photoKey = null;
    if (photo) {
      // console.log(photo);

      try {
        const uploadRes = await axios.post("/api/admission/form/upload-url", {
          filename: photo.name,
          filetype: photo.type,
          year: data.admission_year || admissionSettings?.admission_year,
          admissionClass: data.admission_class,
          listType: data.list_type,
          serialNo: data.serial_no,
          name: data.student_name_en,
        });

        if (uploadRes.data.success) {
          const { url, key } = uploadRes.data;
          await axios.put(url, photo, {
            headers: { "Content-Type": photo.type },
          });
          photoKey = key;
        }
      } catch (err) {
        console.error("Photo upload failed:", err);
        setErrorMessage(
          "Failed to upload photo. Please try again or check your connection.",
        );
        return;
      }
    }
    try {
      // Prepare payload
      const payload: any = { ...data };

      if (photoKey) {
        payload.photo_path = photoKey;
      } else if (data.photo_path) {
        // Keep existing photo path if we didn't upload a new one
        payload.photo_path = data.photo_path;
      }

      if (isEditMode && id) {
        payload.id = id;
      }

      const url = isEditMode
        ? `/api/admission/form/${id}`
        : "/api/admission/form";
      const method = isEditMode ? "put" : "post";
      const response = await axios({
        method: method,
        url: url,
        data: payload,
        headers: { "Content-Type": "application/json" },
      });
      const result = response.data || {};
      if (result.success) {
        const successMessage = isEditMode
          ? `Admission updated successfully! Admission ID: ${id}`
          : `Admission submitted successfully! Your admission ID is: ${result.data.id}. Status: ${result.data.status}`;

        setSuccess(successMessage);
        if (!isEditMode) {
          setPhotoPreview(null);
          setErrorMessage(null);
          setDuplicates([]);
          reset();
          navigate(`/admission/form/confirm/${result.data.id}`);
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
          navigate(`/admission/form/confirm/${result.data.id}`);
        }
      } else {
        if (result.duplicates && result.duplicates.length > 0) {
          setDuplicates(result.duplicates);
        }
        if (result.error) {
          let msg = "";
          if (typeof result.error === "string") {
            msg = result.error;
          } else if (typeof result.error === "object" && result.error.message) {
            msg = result.error.message;
          } else {
            msg = JSON.stringify(result.error);
          }
          setErrorMessage(msg);
        } else {
          const errorMessage = isEditMode
            ? "Update failed. Please try again."
            : "Admission failed. Please try again.";
          setErrorMessage(result.message || errorMessage);
        }
        if (result.duplicates && result.duplicates.length > 0) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    } catch (error) {
      console.error("Admission submission error:", error);

      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data;

        if (errorData.duplicates && errorData.duplicates.length > 0) {
          setDuplicates(errorData.duplicates);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }

        if (errorData.error) {
          let msg = "";
          if (typeof errorData.error === "string") {
            msg = errorData.error;
          } else if (
            typeof errorData.error === "object" &&
            errorData.error.message
          ) {
            msg = errorData.error.message;
          } else {
            msg = JSON.stringify(errorData.error);
          }
          setErrorMessage(msg);
        } else {
          const errorMessage = isEditMode
            ? "Update failed. Please try again."
            : "Admission failed. Please try again.";
          setErrorMessage(errorData.message || errorMessage);
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }
  };
  const currentYear = new Date().getFullYear();
  const earliestYear = 1900;
  const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, i) =>
    String(currentYear - i),
  );
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];
  function getDaysInMonth(year: string, month: string) {
    if (!year || !month) return [];
    const days = new Date(Number(year), Number(month), 0).getDate();
    return Array.from({ length: days }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
  }
  let days: string[] = [];
  let monthOptions = months;
  let disableMonth = false;
  let disableDay = false;
  if (birth_year && years.includes(birth_year)) {
    monthOptions = months;
    disableMonth = false;
    if (birth_month) {
      days = getDaysInMonth(birth_year, birth_month);
      disableDay = false;
    } else {
      days = [];
      disableDay = true;
    }
  } else {
    days = [];
    disableMonth = true;
    disableDay = true;
  }
  useEffect(() => {
    if (birth_reg_no && birth_reg_no.length >= 4) {
      const year = birth_reg_no.slice(0, 4);
      const yearNum = Number(year);
      if (
        /^\d{4}$/.test(year) &&
        yearNum >= earliestYear &&
        yearNum <= currentYear
      ) {
        setValue("birth_year", year, { shouldValidate: true });
      } else {
        setValue("birth_year", "", { shouldValidate: true });
      }
    } else if (birth_year !== "") {
      setValue("birth_year", "", { shouldValidate: true });
    }
  }, [birth_reg_no, currentYear, birth_year, setValue]);
  const bloodGroups = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-1">
              {shouldNavigate
                ? "Redirecting..."
                : isEditMode
                  ? "Loading Admission Data..."
                  : "Initializing Admission Form..."}
            </h3>
            <p className="text-sm text-gray-500">
              Please wait while we prepare everything for you
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (admissionClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-xl w-full bg-white border border-gray-200 rounded-lg p-6 text-center shadow">
          <svg
            className="mx-auto mb-4 w-12 h-12 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Admissions are currently closed
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Admission is not open at the moment. Please check back later or
            contact the school administration for updates.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Homepage
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-blue-100 mb-4 py-2 sm:py-3 px-3 sm:px-4 rounded-t shadow-sm flex flex-col items-center">
        <h2 className="text-xl sm:text-2xl lg:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1 sm:mb-2">
          {isEditMode
            ? "Edit Admission"
            : `Student's Information for Admission ${admission_year}`}
        </h2>
        <span className="text-xs sm:text-sm text-gray-600 text-center px-2">
          Please fill all required fields. Fields marked{" "}
          <span className="text-red-600">*</span> are mandatory.
        </span>
      </div>

      {success && (
        <div className="mb-4 p-3 sm:p-4 bg-green-100 text-green-800 rounded text-sm sm:text-base animate-fade-in shadow">
          {success}
        </div>
      )}

      {duplicates.length > 0 && <DuplicateWarning duplicates={duplicates} />}

      {errorMessage && (
        <div className="mb-4 p-3 sm:p-4 bg-red-100 text-red-800 rounded text-sm sm:text-base animate-fade-in shadow">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 sm:space-y-6"
      >
        {Object.keys(errors).length > 0 && (
          <div
            style={{
              background: "#fff3cd",
              color: "#856404",
              border: "1px solid #ffeeba",
              borderRadius: "4px",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <strong>Validation Errors:</strong>
            <ul style={{ fontSize: "12px", margin: 0, paddingLeft: "18px" }}>
              {Object.entries(errors).map(([field, error]) => {
                let message = error?.message;
                if (!message && Array.isArray(error?.types)) {
                  message = (error as any).types[0]?.message;
                }
                return (
                  <li key={field} style={{ marginBottom: 2 }}>
                    <strong>{field}:</strong> {message || "Invalid value"}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Personal Information</strong>
          </legend>

          <FieldRow
            label="Admit to Class:"
            isRequired={isRequired("admission_class")}
            error={errors.admission_class}
            tooltip="Select the class from the admission settings"
          >
            <select
              {...register("admission_class")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Select Class</option>
              {classListOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow
            label="List Type:"
            isRequired={isRequired("list_type")}
            error={errors.list_type}
            tooltip="Select list type from settings"
          >
            <select
              {...register("list_type")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Select List Type</option>
              {listTypeOptions.map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Serial No:"
            isRequired={isRequired("serial_no")}
            error={errors.serial_no}
            tooltip="Select serial number from settings"
          >
            <select
              {...register("serial_no")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Select Serial No</option>
              {serialNoOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="User ID:"
            isRequired={isRequired("admission_user_id")}
            error={errors.admission_user_id}
            tooltip="Select user id from settings"
          >
            <input
              list="admission-userid-list"
              {...register("admission_user_id")}
              disabled={!admission_class}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.replace(/[^A-Za-z0-9]/g, "");
              }}
              placeholder={
                admission_class
                  ? "Type or select User ID"
                  : "Select class first"
              }
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoComplete="off"
            />
            <datalist id="admission-userid-list">
              {userIdOptions.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </FieldRow>

          <FieldRow
            label="Qouta:"
            isRequired={isRequired("qouta")}
            error={errors.qouta}
            tooltip="Enter applicable quota (if any)"
          >
            <select
              {...register("qouta")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
            >
              <option value="">Select Qouta</option>
              <option value="(GEN)">সাধারণ (GEN)</option>
              <option value="(DIS) ">বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS) </option>
              <option value="(FF)">মুক্তিযোদ্ধার সন্তান (FF)</option>
              <option value="(GOV)">
                সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)
              </option>
              <option value="(ME)">
                শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)
              </option>
              <option value="(SIB)">সহোদর ভাই (SIB)</option>
              <option value="(TWN)">যমজ (TWN)</option>
              <option value="(Mutual Transfer)">
                পারস্পরিক বদলি (Mutual Transfer)
              </option>
              <option value="(Govt. Transfer)">
                সরকারি বদলি (Govt. Transfer)
              </option>
            </select>
          </FieldRow>
          <FieldRow
            label="Religion:"
            isRequired={isRequired("religion")}
            error={errors.religion}
            tooltip="Select your religion"
          >
            <select
              {...register("religion")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-invalid={!!errors.religion}
            >
              <option value="">Select Religion</option>
              <option value="Islam">Islam</option>
              <option value="Hinduism">Hinduism</option>
              <option value="Christianity">Christianity</option>
              <option value="Buddhism">Buddhism</option>
              <option value="Other">Other</option>
            </select>
          </FieldRow>
          <FieldRow
            label="Student Name (Bangla):"
            isRequired={isRequired("student_name_bn")}
            instruction={
              getGuidance("studentNameBn").instruction ||
              "(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
            }
            error={errors.student_name_bn}
            tooltip={
              getGuidance("studentNameBn").tooltip ||
              "Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"
            }
          >
            <input
              type="text"
              id="student_name_bn"
              {...register("student_name_bn")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterBanglaInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="ছাত্রের নাম (বাংলায়)"
              aria-invalid={!!errors.student_name_bn}
            />
          </FieldRow>
          <FieldRow
            label="ডাকনাম (এক শব্দে/বাংলায়):"
            isRequired={isRequired("student_nick_name_bn")}
            error={errors.student_nick_name_bn}
            tooltip="Enter your nickname in Bengali, use only one word"
          >
            <input
              type="text"
              id="student_nick_name_bn"
              {...register("student_nick_name_bn")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterBanglaInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="ডাকনাম (এক শব্দে/বাংলায়)"
              aria-invalid={!!errors.student_nick_name_bn}
            />
          </FieldRow>
          <FieldRow
            label="Student's Name (in English):"
            isRequired={isRequired("student_name_en")}
            instruction={
              getGuidance("studentNameEn").instruction ||
              "(According to Primary/Birth Registration Card)"
            }
            error={errors.student_name_en}
            tooltip={
              getGuidance("studentNameEn").tooltip ||
              "Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"
            }
          >
            <input
              type="text"
              id="student_name_en"
              {...register("student_name_en")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterEnglishInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Student Name (in English)"
              aria-invalid={!!errors.student_name_en}
            />
          </FieldRow>

          <FieldRow
            label="Birth Registration Number:"
            isRequired={isRequired("birth_reg_no")}
            error={errors.birth_reg_no}
            tooltip="Enter your 17-digit birth registration number. The year will be automatically extracted from this number"
          >
            <input
              type="text"
              id="birth_reg_no"
              {...register("birth_reg_no")}
              inputMode="numeric"
              minLength={17}
              maxLength={17}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="20XXXXXXXXXXXXXXX"
              aria-invalid={!!errors.birth_reg_no}
            />
          </FieldRow>

          <FieldRow
            label="Date of Birth:"
            isRequired={isRequired("birth_date")}
            error={errors.birth_year || errors.birth_month || errors.birth_day}
            tooltip="Birth year is auto-filled from birth registration number. Select month and day manually"
          >
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <input
                type="text"
                id="birth_year"
                {...register("birth_year")}
                maxLength={4}
                readOnly
                disabled
                className="border rounded px-3 py-2 bg-gray-100 w-full sm:w-32 text-sm sm:text-base"
                placeholder="Year"
                tabIndex={-1}
                aria-invalid={!!errors.birth_year}
              />

              <select
                id="birth_month"
                {...register("birth_month")}
                className="border rounded px-3 py-2 w-full sm:w-40 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                disabled={disableMonth || !birth_year}
                aria-invalid={!!errors.birth_month}
              >
                <option value="">Month</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                id="birth_day"
                {...register("birth_day")}
                className="border rounded px-3 py-2 w-full sm:w-28 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                disabled={disableDay}
              >
                <option value="">Day</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </FieldRow>
          <FieldRow
            label="পিতার নাম (বাংলায়):"
            isRequired={isRequired("father_name_bn")}
            instruction={
              getGuidance("fatherNameBn").instruction ||
              "(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
            }
            error={errors.father_name_bn}
            tooltip={
              getGuidance("fatherNameBn").tooltip ||
              "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"
            }
          >
            <input
              type="text"
              id="father_name_bn"
              {...register("father_name_bn")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterBanglaInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="পিতার নাম (বাংলায়)"
              aria-invalid={!!errors.father_name_bn}
            />
          </FieldRow>
          <FieldRow
            label="Father's Name (in English):"
            isRequired={isRequired("father_name_en")}
            instruction={
              getGuidance("fatherNameEn").instruction ||
              "(According to Primary/Birth Registration Card)"
            }
            error={errors.father_name_en}
            tooltip={
              getGuidance("fatherNameEn").tooltip ||
              "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"
            }
          >
            <input
              type="text"
              id="father_name_en"
              {...register("father_name_en")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterEnglishInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Father's Name (in English)"
              aria-invalid={!!errors.father_name_en}
            />
          </FieldRow>
          <FieldRow
            label="Father's NID:"
            isRequired={isRequired("father_nid")}
            error={errors.father_nid}
            tooltip="Enter father's National ID number (10-17 digits)"
          >
            <input
              type="text"
              id="father_nid"
              {...register("father_nid")}
              inputMode="numeric"
              minLength={10}
              maxLength={17}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="1234567890"
              aria-invalid={!!errors.father_nid}
            />
          </FieldRow>
          <FieldRow
            label="Father's Mobile No:"
            isRequired={isRequired("father_phone")}
            error={errors.father_phone}
            tooltip="Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)"
          >
            <input
              type="text"
              id="father_phone"
              {...register("father_phone")}
              inputMode="numeric"
              maxLength={11}
              minLength={11}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="01XXXXXXXXX"
              aria-invalid={!!errors.father_phone}
            />
          </FieldRow>
          <FieldRow
            label="মাতার নাম (বাংলায়):"
            isRequired={isRequired("mother_name_bn")}
            instruction={
              getGuidance("motherNameBn").instruction ||
              "(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
            }
            error={errors.mother_name_bn}
            tooltip={
              getGuidance("motherNameBn").tooltip ||
              "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"
            }
          >
            <input
              type="text"
              id="mother_name_bn"
              {...register("mother_name_bn")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterBanglaInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="মাতার নাম (বাংলায়)"
              aria-invalid={!!errors.mother_name_bn}
            />
          </FieldRow>
          <FieldRow
            label="Mother's Name (in English):"
            isRequired={isRequired("mother_name_en")}
            instruction={
              getGuidance("motherNameEn").instruction ||
              "(According to Primary/Birth Registration Card)"
            }
            error={errors.mother_name_en}
            tooltip={
              getGuidance("motherNameEn").tooltip ||
              "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"
            }
          >
            <input
              type="text"
              id="mother_name_en"
              {...register("mother_name_en")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterEnglishInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Mother's Name (in English)"
              aria-invalid={!!errors.mother_name_en}
            />
          </FieldRow>
          <FieldRow
            label="Mother's NID:"
            isRequired={isRequired("mother_nid")}
            error={errors.mother_nid}
            tooltip="Enter mother's National ID number (10-17 digits)"
          >
            <input
              type="text"
              {...register("mother_nid")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              inputMode="numeric"
              minLength={10}
              maxLength={17}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="1234567890"
              aria-invalid={!!errors.mother_nid}
            />
          </FieldRow>
          <FieldRow
            label="Mother's Mobile No:"
            isRequired={isRequired("mother_phone")}
            error={errors.mother_phone}
            tooltip="Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)"
          >
            <input
              type="text"
              id="mother_phone"
              {...register("mother_phone")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              inputMode="numeric"
              maxLength={11}
              minLength={11}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="01XXXXXXXXX"
              aria-invalid={!!errors.mother_phone}
            />
          </FieldRow>
          <FieldRow
            label="Blood Group:"
            isRequired={isRequired("blood_group")}
            error={errors.blood_group}
            tooltip="Select your blood group if known. This isut helpful for medical emergencies"
          >
            <select
              id="blood_group"
              {...register("blood_group")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              aria-invalid={!!errors.blood_group}
            >
              {bloodGroups.map((group) => (
                <option key={group} value={group}>
                  {group || "Select Blood Group"}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Email:"
            isRequired={isRequired("email")}
            error={errors.email}
            tooltip="Enter a valid email address for communication. This is recommended"
          >
            <input
              type="email"
              id="email"
              {...register("email")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="example@gmail.com"
              aria-invalid={!!errors.email}
            />
          </FieldRow>
          <FieldRow
            label="Whatsapp Number:"
            isRequired={isRequired("whatsapp_number")}
            error={errors.whatsapp_number}
            tooltip="Optional — enter WhatsApp mobile number in 11-digit format (e.g., 01XXXXXXXXX)"
          >
            <input
              {...register("whatsapp_number")}
              type="text"
              inputMode="numeric"
              maxLength={11}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="01XXXXXXXXX"
              aria-invalid={!!errors.whatsapp_number}
            />
          </FieldRow>
        </fieldset>
        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Address</strong>
          </legend>
          <h4 className="font-semibold mb-2 text-sm sm:text-base">
            Permanent Address:
          </h4>

          <FieldRow
            label="District:"
            isRequired={isRequired("permanent_district")}
            error={errors.permanent_district}
            tooltip="Select the district of your permanent address"
          >
            <select
              id="permanent_district"
              {...register("permanent_district")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select district</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Upazila/Thana:"
            isRequired={isRequired("permanent_upazila")}
            error={errors.permanent_upazila}
            tooltip="Select the upazila/thana of your permanent address. First select district to see options"
          >
            <select
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={!permanent_district}
              {...register("permanent_upazila")}
            >
              <option value="">Select upazila/thana</option>
              {permanentUpazillas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Post Office:"
            isRequired={isRequired("permanent_post_office")}
            error={errors.permanent_post_office}
            tooltip="Enter the name of your nearest post office"
          >
            <input
              type="text"
              id="permanent_post_office"
              {...register("permanent_post_office")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Post Office Name"
            />
          </FieldRow>
          <FieldRow
            label="Post Code:"
            isRequired={isRequired("permanent_post_code")}
            error={errors.permanent_post_code}
            tooltip="Enter the 4-digit postal code of your area"
          >
            <input
              id="permanent_post_code"
              {...register("permanent_post_code")}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e);
              }}
              type="text"
              inputMode="numeric"
              maxLength={4}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="1234"
              aria-invalid={!!errors.permanent_post_code}
            />
          </FieldRow>
          <FieldRow
            label="Village/Road/House No:"
            isRequired={isRequired("permanent_village_road")}
            error={errors.permanent_village_road}
            tooltip="Enter your village name, road name, and house number"
          >
            <input
              type="text"
              id="permanent_village_road"
              {...register("permanent_village_road")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Village/Road/House No"
            />
          </FieldRow>

          <div className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="sameAsPermanent"
              checked={sameAsPermanent}
              onChange={(e) => setSameAsPermanent(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm">Same as Permanent Address</span>
          </div>

          {!sameAsPermanent && (
            <div className="space-y-2">
              <h4 className="font-semibold mb-2 text-sm sm:text-base">
                Present Address:
              </h4>
              <FieldRow
                label="District:"
                isRequired={isRequired("present_district")}
                error={errors.present_district}
              >
                <select
                  id="present_district"
                  {...register("present_district")}
                  className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select district</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow
                label="Upazila/Thana:"
                isRequired={isRequired("present_upazila")}
                error={errors.present_upazila}
              >
                <select
                  {...register("present_upazila")}
                  className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={!present_district}
                >
                  <option value="">Select upazila/thana</option>
                  {presentUpazillas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow
                label="Post Office:"
                isRequired={isRequired("present_post_office")}
                error={errors.present_post_office}
              >
                <input
                  {...register("present_post_office")}
                  className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Post Office Name"
                />
              </FieldRow>
              <FieldRow
                label="Post Code:"
                isRequired={isRequired("present_post_code")}
                error={errors.present_post_code}
              >
                <input
                  {...register("present_post_code")}
                  onInput={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.value = filterNumericInput(e);
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="1234"
                  aria-invalid={!!errors.present_post_code}
                />
              </FieldRow>
              <FieldRow
                label="Village/Road/House No:"
                isRequired={isRequired("present_village_road")}
                error={errors.present_village_road}
              >
                <input
                  {...register("present_village_road")}
                  className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Village/Road/House No"
                />
              </FieldRow>
            </div>
          )}
        </fieldset>

        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Guardian Information</strong>
          </legend>
          <FieldRow
            label="Guardian is not the father:"
            isRequired={isRequired("guardian_is_not_father")}
            error={undefined}
            tooltip="Check this box only if your guardian is someone other than your father (e.g., mother, uncle, etc.)"
          >
            <label className="inline-flex items-start sm:items-center gap-2">
              <input
                type="checkbox"
                id="guardianIsNotFather"
                {...register("guardian_is_not_father")}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm leading-relaxed">
                Check if guardian is not father (can be mother or others)
              </span>
            </label>
          </FieldRow>
          {guardian_is_not_father && (
            <>
              <div className="space-y-2">
                <FieldRow
                  label="Guardian's Name:"
                  isRequired={true}
                  error={errors.guardian_name}
                  tooltip="Enter the full name of your guardian in English capital letters"
                >
                  <input
                    type="text"
                    {...register("guardian_name")}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    placeholder="Guardian's Name"
                    aria-invalid={!!errors.guardian_name}
                  />
                </FieldRow>
                <FieldRow
                  label="Guardian's NID:"
                  isRequired={true}
                  error={errors.guardian_nid}
                  tooltip="Enter guardian's National ID number (10-17 digits)"
                >
                  <input
                    {...register("guardian_nid")}
                    type="text"
                    inputMode="numeric"
                    minLength={10}
                    maxLength={17}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.value = filterNumericInput(e);
                    }}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    placeholder="Guardian's NID"
                    aria-invalid={!!errors.guardian_nid}
                  />
                </FieldRow>
                <FieldRow
                  label="Guardian's Mobile No:"
                  isRequired={true}
                  error={errors.guardian_phone}
                  tooltip="Enter guardian's mobile number in 11-digit format"
                >
                  <input
                    {...register("guardian_phone")}
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.value = filterNumericInput(e);
                    }}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    placeholder="01XXXXXXXXX"
                    aria-invalid={!!errors.guardian_phone}
                  />
                </FieldRow>
                <FieldRow
                  label="Relationship with Guardian:"
                  isRequired={true}
                  error={errors.guardian_relation}
                  tooltip="Select your relationship with the guardian from the dropdown"
                >
                  <select
                    {...register("guardian_relation")}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    aria-invalid={!!errors.guardian_relation}
                  >
                    <option value="">
                      Select Relationship / সম্পর্ক নির্বাচন করুন
                    </option>
                    <option value="Mother">Mother (মা)</option>
                    <option value="Paternal Uncle">
                      Paternal Uncle (চাচা/কাকা)
                    </option>
                    <option value="Paternal Aunt">
                      Paternal Aunt (চাচী/কাকী)
                    </option>
                    <option value="Maternal Uncle">
                      Maternal Uncle (মামা)
                    </option>
                    <option value="Maternal Aunt">Maternal Aunt (মামী)</option>
                    <option value="Paternal Grandfather">
                      Paternal Grandfather (দাদা)
                    </option>
                    <option value="Maternal Grandfather">
                      Maternal Grandfather (নানা)
                    </option>
                    <option value="Paternal Grandmother">
                      Paternal Grandmother (দাদী)
                    </option>
                    <option value="Maternal Grandmother">
                      Maternal Grandmother (নানী)
                    </option>
                    <option value="Cousin">
                      Cousin (চাচাতো/মামাতো ভাই/বোন)
                    </option>
                    <option value="Brother">Brother (ভাই)</option>
                    <option value="Sister">Sister (বোন)</option>
                    <option value="Other">Other (অন্যান্য)</option>
                  </select>
                </FieldRow>
              </div>

              <FieldRow
                label="Guardian's Address:"
                isRequired={false}
                error={undefined}
                tooltip="Check if guardian's address is same as permanent address, otherwise fill separately"
              >
                <label className="inline-flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    {...register("guardian_address_same_as_permanent")}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm">Same as Permanent Address</span>
                </label>
              </FieldRow>
              {!guardian_address_same_as_permanent && (
                <div className="space-y-2">
                  <FieldRow
                    label="District:"
                    isRequired={true}
                    error={errors.guardian_district}
                    tooltip="Select the district where your guardian lives"
                  >
                    <select
                      {...register("guardian_district")}
                      className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select district</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow
                    label="Upazila/Thana:"
                    isRequired={true}
                    error={errors.guardian_upazila}
                    tooltip="Select the upazila/thana where your guardian lives"
                  >
                    <select
                      {...register("guardian_upazila")}
                      className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                      disabled={!guardian_district}
                    >
                      <option value="">Select upazila/thana</option>
                      {guardianUpazillas.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow
                    label="Post Office:"
                    isRequired={isRequired("guardian_post_office")}
                    error={errors.guardian_post_office}
                    tooltip="Enter the name of your guardian's nearest post office"
                  >
                    <input
                      {...register("guardian_post_office")}
                      className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Post Office Name"
                    />
                  </FieldRow>
                  <FieldRow
                    label="Post Code:"
                    isRequired={isRequired("guardian_post_code")}
                    error={errors.guardian_post_code}
                    tooltip="Enter the 4-digit postal code of your guardian's area"
                  >
                    <input
                      {...register("guardian_post_code")}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="1234"
                      aria-invalid={!!errors.guardian_post_code}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Village/Road/House No:"
                    isRequired={isRequired("guardian_village_road")}
                    error={errors.guardian_village_road}
                    tooltip="Enter your guardian's village name, road name, and house number"
                  >
                    <input
                      {...register("guardian_village_road")}
                      className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Village/Road/House No"
                    />
                  </FieldRow>
                </div>
              )}
            </>
          )}
        </fieldset>

        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Previous School Information</strong>
          </legend>
          <FieldRow
            label="Name of Previous School :"
            isRequired={isRequired("prev_school_name")}
            error={errors.prev_school_name}
            tooltip="Enter the full name of your previous school"
          >
            <input
              {...register("prev_school_name")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Enter the name of your previous school"
              aria-invalid={!!errors.prev_school_name}
            />
          </FieldRow>
          {isClassEightOrNine(admission_class) && (
            <FieldRow
              label="Registration Number:"
              isRequired={isRequired("registration_no")}
              error={errors.registration_no}
              tooltip="Enter your Registration Number from the registration card (required for Class 8 & 9)"
            >
              <input
                {...register("registration_no")}
                minLength={10}
                maxLength={10}
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = filterNumericInput(e).slice(0, 10);
                }}
                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="10-digit Registration Number"
                aria-invalid={!!errors.registration_no}
              />
            </FieldRow>
          )}
          <FieldRow
            label="Passing Year:"
            isRequired={isRequired("prev_school_passing_year")}
            error={errors.prev_school_passing_year}
            tooltip="Select the year you passed from your previous school"
          >
            <select
              {...register("prev_school_passing_year")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-invalid={!!errors.prev_school_passing_year}
            >
              <option value="">Select Year</option>
              {Array.from({ length: 5 }, (_, i) =>
                String(new Date().getFullYear() - i),
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow
            label="Section:"
            isRequired={isRequired("section_in_prev_school")}
            error={errors.section_in_prev_school}
            tooltip="Select which section you were in during previous school"
          >
            <select
              {...register("section_in_prev_school")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-invalid={!!errors.section_in_prev_school}
            >
              <option value="">Select Section</option>
              {["No section", "A", "B", "C", "D", "E", "F"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow
            label="Roll:"
            isRequired={isRequired("roll_in_prev_school")}
            error={errors.roll_in_prev_school}
            tooltip="Enter your roll number in previous school"
          >
            <input
              {...register("roll_in_prev_school")}
              inputMode="numeric"
              maxLength={6}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = filterNumericInput(e).slice(0, 6);
              }}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Roll number"
              aria-invalid={!!errors.roll_in_prev_school}
            />
          </FieldRow>
          <FieldRow
            label="District:"
            isRequired={isRequired("prev_school_district")}
            error={errors.prev_school_district}
            tooltip="Select the district where your previous school is located"
          >
            <select
              {...register("prev_school_district")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-invalid={!!errors.prev_school_district}
            >
              <option value="">Select District</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Upazila/Thana:"
            isRequired={isRequired("prev_school_upazila")}
            error={errors.prev_school_upazila}
            tooltip="Select the upazila/thana where your previous school is located"
          >
            <select
              {...register("prev_school_upazila")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
              disabled={!prev_school_district}
              aria-invalid={!!errors.prev_school_upazila}
            >
              <option value="">Select Upazila/Thana</option>
              {prevSchoolUpazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FieldRow>
        </fieldset>
        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Additional Information</strong>
          </legend>
          <FieldRow
            label="Father's Profession:"
            isRequired={isRequired("father_profession")}
            error={errors.father_profession}
            tooltip="Select father's profession"
          >
            <div>
              <select
                value={
                  [
                    "Govt. Service",
                    "Non-Govt. Service",
                    "Private Job",
                  ].includes(father_profession || "") || !father_profession
                    ? father_profession || ""
                    : "Other"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setValue(
                    "father_profession",
                    val === "Other" ? "Other" : val,
                    { shouldValidate: true },
                  );
                }}
                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              >
                <option value="">Select Profession</option>
                <option value="Govt. Service">Govt. Service</option>
                <option value="Non-Govt. Service">Non-Govt. Service</option>
                <option value="Private Job">Private Job</option>
                <option value="Other">Other</option>
              </select>

              {((![
                "Govt. Service",
                "Non-Govt. Service",
                "Private Job",
              ].includes(father_profession || "") &&
                !!father_profession) ||
                father_profession === "Other") && (
                <div className="mt-2">
                  <input
                    {...register("father_profession")}
                    value={
                      father_profession === "Other"
                        ? ""
                        : father_profession || ""
                    }
                    onChange={(e) =>
                      setValue("father_profession", e.target.value, {
                        shouldValidate: true,
                      })
                    }
                    placeholder="Please specify father's profession"
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                    aria-invalid={!!errors.father_profession}
                  />
                </div>
              )}
            </div>
          </FieldRow>

          <FieldRow
            label="Mother's Profession:"
            isRequired={isRequired("mother_profession")}
            error={errors.mother_profession}
            tooltip="Select mother's profession"
          >
            <div>
              <select
                value={
                  [
                    "Housewife",
                    "Govt. Service",
                    "Non-Govt. Service",
                    "Private Job",
                  ].includes(mother_profession || "") || !mother_profession
                    ? mother_profession || ""
                    : "Other"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setValue(
                    "mother_profession",
                    val === "Other" ? "Other" : val,
                    { shouldValidate: true },
                  );
                }}
                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              >
                <option value="">Select Profession</option>
                <option value="Housewife">Housewife</option>
                <option value="Govt. Service">Govt. Service</option>
                <option value="Non-Govt. Service">Non-Govt. Service</option>
                <option value="Private Job">Private Job</option>
                <option value="Other">Other</option>
              </select>

              {((![
                "Housewife",
                "Govt. Service",
                "Non-Govt. Service",
                "Private Job",
              ].includes(mother_profession || "") &&
                !!mother_profession) ||
                mother_profession === "Other") && (
                <div className="mt-2">
                  <input
                    {...register("mother_profession")}
                    value={
                      mother_profession === "Other"
                        ? ""
                        : mother_profession || ""
                    }
                    onChange={(e) =>
                      setValue("mother_profession", e.target.value, {
                        shouldValidate: true,
                      })
                    }
                    placeholder="Please specify mother's profession"
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                    aria-invalid={!!errors.mother_profession}
                  />
                </div>
              )}
            </div>
          </FieldRow>

          <FieldRow
            label="Parent's Annual Income Range:"
            isRequired={isRequired("parent_income")}
            tooltip="Select guardian's annual income range"
            error={errors.parent_income}
          >
            <select
              {...register("parent_income")}
              className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
            >
              <option value="">Select Income Range</option>
              <option value="below_50000">0 - 50,000</option>
              <option value="50000_100000">50,000 - 100,000</option>
              <option value="100001_200000">100,001 - 200,000</option>
              <option value="200001_500000">200,001 - 500,000</option>
              <option value="above_500000">Above 500,000</option>
            </select>
          </FieldRow>
        </fieldset>

        <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
          <legend>
            <strong>Additional Information</strong>
          </legend>

          <FieldRow
            label={
              <span>
                Photo:
                {/* {!isEditMode && <span className="text-red-600 ml-1" aria-hidden="true">*</span>} */}
              </span>
            }
            isRequired={true}
            tooltip="Upload a recent photo. File must be JPG format and less than 2MB"
            error={errors.photo_path}
          >
            <div className="flex flex-col lg:flex-row items-start gap-4">
              <div className="shrink-0">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 overflow-hidden">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="photo preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-2">
                      <div className="text-xs sm:text-sm text-gray-500">
                        {isEditMode ? "Current photo" : "No photo uploaded"}
                      </div>
                    </div>
                  )}

                  <input
                    id="photo-input"
                    type="file"
                    name="photo"
                    accept=".jpg,.jpeg,image/jpeg"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label
                    htmlFor="photo-input"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 cursor-pointer text-sm sm:text-base"
                  >
                    {photoPreview ? "Change Photo" : "Choose Photo"}
                  </label>

                  {(photoPreview || photo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                        setValue("photo_path", "", { shouldValidate: true });
                        const input = document.getElementById(
                          "photo-input",
                        ) as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded bg-white text-sm sm:text-base hover:bg-gray-50"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <Instruction>
                  JPG only. Max file size 2MB. Click the box or "Choose Photo"
                  to upload.
                </Instruction>
              </div>
            </div>
          </FieldRow>
        </fieldset>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 sm:mt-8">
          <button
            type="submit"
            className={`px-6 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition font-semibold flex items-center justify-center gap-2 text-sm sm:text-base ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <svg
                className="animate-spin h-5 w-5 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            )}
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Submitting..."
              : isEditMode
                ? "Update Admission"
                : "Submit Admission"}
          </button>

          {!isEditMode && (
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition text-sm sm:text-base"
              onClick={() => reset()}
              disabled={isSubmitting}
            >
              Reset
            </button>
          )}

          {isEditMode && (
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 rounded shadow bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition text-sm sm:text-base"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <style>{`   
                .animate-fade-in {
                    animation: fadeIn 0.7s;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px);}
                    to { opacity: 1; transform: none;}
                }
            `}</style>
    </div>
  );
}

export default Form;
