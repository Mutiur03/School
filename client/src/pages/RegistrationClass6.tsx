import React, { useEffect, useState } from "react";
import { z } from "zod";
import {
    useForm,
    useWatch,
    type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { districts, getUpazilasByDistrict } from "@/lib/location";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { schoolConfig } from "@/lib/info";
import {
    BANGLA_ONLY,
    BANGLA_OPTIONAL,
    ENGLISH_ONLY,
    PHONE_NUMBER,
    NID,
    BIRTH_REG_NO,
    POST_CODE,
    ROLL_NUMBER,
    filterNumericInput,
    filterEnglishInput,
    filterBanglaInput,
} from "@/lib/regex";
import { bloodGroups } from "./AdmissionFormNew";
import { guardianRelations } from "@/lib/guardian";

const registrationSchema = z.object({
    student_name_bn: z.string().min(1, "Student Name in Bangla is required").regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
    student_nick_name_bn: z.string().min(1, "Nickname in Bangla is required").regex(BANGLA_OPTIONAL, "Only Bangla characters are allowed"),
    student_name_en: z.string().min(1, "Student Name in English is required").regex(ENGLISH_ONLY, "Only English characters are allowed"),
    birth_reg_no: z.string().min(1, "Birth Registration Number is required").regex(BIRTH_REG_NO, "Must be 17 digits"),
    birth_year: z.string().min(1, "Year is required"),
    birth_month: z.string().min(1, "Month is required"),
    birth_day: z.string().min(1, "Day is required"),
    blood_group: z.enum(bloodGroups).default("").optional(),
    email: z.preprocess((v) => (v === null ? "" : v), z.string().default("")
        .refine((val) => !val || /^[\x00-\x7F]+$/.test(val), "Email must contain only English characters",)
        .refine((val) => !val || z.string().email().safeParse(val).success, "Invalid email format",),
    ),
    religion: z.string().min(1, "Religion is required"),

    father_name_bn: z.string().min(1, "Father's Name in Bangla is required").regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
    father_name_en: z.string().min(1, "Father's Name in English is required").regex(ENGLISH_ONLY, "Only English characters are allowed"),
    father_nid: z.string().min(1, "Father's NID is required").regex(NID, "Must be 10-17 digits"),
    father_phone: z.string().min(1, "Father's Phone is required").regex(PHONE_NUMBER, "Invalid phone number"),

    mother_name_bn: z.string().min(1, "Mother's Name in Bangla is required").regex(BANGLA_ONLY, "Only Bangla characters are allowed"),
    mother_name_en: z.string().min(1, "Mother's Name in English is required").regex(ENGLISH_ONLY, "Only English characters are allowed"),
    mother_nid: z.string().min(1, "Mother's NID is required").regex(NID, "Must be 10-17 digits"),
    mother_phone: z.string().min(1, "Mother's Phone is required").regex(PHONE_NUMBER, "Invalid phone number"),

    permanent_district: z.string().min(1, "District is required"),
    permanent_upazila: z.string().min(1, "Upazila is required"),
    permanent_post_office: z.string().min(1, "Post Office is required"),
    permanent_post_code: z.string().min(1, "Post Code is required").regex(POST_CODE, "Must be 4 digits"),
    permanent_village_road: z.string().min(1, "Village/Road is required"),

    present_district: z.string().min(1, "District is required"),
    present_upazila: z.string().min(1, "Upazila is required"),
    present_post_office: z.string().min(1, "Post Office is required"),
    present_post_code: z.string().min(1, "Post Code is required").regex(POST_CODE, "Must be 4 digits"),
    present_village_road: z.string().min(1, "Village/Road is required"),
    same_as_permanent: z.boolean().default(false),
    guardian_is_not_father: z.boolean().default(false),
    guardian_name: z.string().optional(),
    guardian_phone: z.string().optional(),
    guardian_relation: z.string().optional(),
    guardian_nid: z.string().optional(),
    guardian_address_same_as_permanent: z.boolean().default(false),
    guardian_district: z.string().optional(),
    guardian_upazila: z.string().optional(),
    guardian_post_office: z.string().optional(),
    guardian_post_code: z.string().optional(),
    guardian_village_road: z.string().optional(),

    section: z.string().min(1, "Section is required"),
    roll: z.string().min(1, "Roll is required").regex(ROLL_NUMBER, "Invalid roll"),
    upobritti: z.string().min(1, "This field is required"),
    sorkari_brirti: z.string().min(1, "This field is required"),

    prev_school_name: z.string().min(1, "Previous School Name is required"),
    prev_school_passing_year: z.string().min(1, "Previous School Passing Year is required"),
    section_in_prev_school: z.string().min(1, "Section in previous school is required"),
    roll_in_prev_school: z.string().min(1, "Roll in previous school is required").regex(ROLL_NUMBER, "Roll must be numeric"),
    prev_school_district: z.string().min(1, "Previous School District is required"),
    prev_school_upazila: z.string().min(1, "Previous School Upazila is required"),

    photo: z.any().optional(),
}).superRefine((data, ctx) => {
    if (data.guardian_is_not_father) {
        if (!data.guardian_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_name"] });
        if (!data.guardian_phone || !PHONE_NUMBER.test(data.guardian_phone)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid Phone", path: ["guardian_phone"] });
        if (!data.guardian_relation) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_relation"] });
        if (!data.guardian_nid || !NID.test(data.guardian_nid)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid NID", path: ["guardian_nid"] });

        if (!data.guardian_address_same_as_permanent) {
            if (!data.guardian_district) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_district"] });
            if (!data.guardian_upazila) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_upazila"] });
            if (!data.guardian_post_office) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_post_office"] });
            if (!data.guardian_post_code || !POST_CODE.test(data.guardian_post_code)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid Post Code", path: ["guardian_post_code"] });
            if (!data.guardian_village_road) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: ["guardian_village_road"] });
        }
    }
});

type RegistrationFormData = z.infer<typeof registrationSchema>;
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
    error: any;
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

const SectionHeader: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <fieldset className="border border-gray-300 rounded-sm p-4 sm:p-6">
        <legend>
            <strong>{title}</strong>
        </legend>
        {children}
    </fieldset>
);

export default function RegistrationClass6() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [permanentUpazilas, setPermanentUpazilas] = useState<any[]>([]);
    const [presentUpazilas, setPresentUpazilas] = useState<any[]>([]);
    const [guardianUpazilas, setGuardianUpazilas] = useState<any[]>([]);
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<any[]>([]);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors },
    } = useForm<RegistrationFormData>({
        resolver: zodResolver(registrationSchema) as Resolver<RegistrationFormData>,
        defaultValues: {
            guardian_is_not_father: false,
            guardian_address_same_as_permanent: false,
            blood_group: "",
        },
    });

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
    const sameAsPermanent = useWatch({
        control,
        name: "same_as_permanent",
    });
    const photo = useWatch({
        control,
        name: "photo",
    });
    useEffect(() => {
        const selectedDistrictId = permanent_district;
        if (!selectedDistrictId) {
            setPermanentUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPermanentUpazilas(upazilas);
    }, [permanent_district]);
    useEffect(() => {
        const selectedDistrictId = present_district;
        if (!selectedDistrictId) {
            setPresentUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPresentUpazilas(upazilas);
    }, [present_district]);
    useEffect(() => {
        if (!guardian_is_not_father || guardian_address_same_as_permanent) {
            setGuardianUpazilas([]);
            return;
        }
        const selectedDistrictId = guardian_district;
        if (!selectedDistrictId) {
            setGuardianUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setGuardianUpazilas(upazilas);
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
        const selectedDistrictId = prev_school_district;
        if (!selectedDistrictId) {
            setPrevSchoolUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPrevSchoolUpazilas(upazilas);
    }, [prev_school_district]);
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setValue("photo", file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
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
    const onSubmit = async (data: RegistrationFormData) => {
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (key === "photo" && value instanceof File) {
                    formDataToSend.append("photo", value);
                } else {
                    formDataToSend.append(key, String(value));
                }
            });

            const endpoint = isEditMode ? `/api/reg/class-6/${id}` : "/api/reg/class-6";
            const method = isEditMode ? "put" : "post";

            const response = await axios[method](endpoint, formDataToSend);
            if (response.data.success) {
                navigate(`/registration/class-6/confirm/${response.data.id}`);
            }
        } catch (error) {
            console.error("Submission error", error);
        } finally {
            setLoading(false);
        }
    };
    const isRequired = (
        fieldName: keyof RegistrationFormData
    ) => {
        const field = registrationSchema.shape[fieldName];
        if (field instanceof z.ZodOptional) return false;

        return true;
    };



    return (
        <div className="max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-xl my-10">
            <div className="text-center mb-8 border-b-2 border-blue-600 pb-4">
                <h1 className="text-3xl font-bold text-blue-900 truncate px-4">
                    {isEditMode ? "Edit Registration (Class 6)" : "Class Six Registration Form"}
                </h1>
                <p className="text-gray-600 mt-1">{schoolConfig.name.en}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                {/* Step 1: Personal Info */}
                <SectionHeader title="Personal Information" >
                    <FieldRow label="Section" isRequired={isRequired("section")} error={errors.section}>
                        <select {...register("section")} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="">Select Section</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                        </select>
                    </FieldRow>
                    <FieldRow label="Roll" isRequired={isRequired("roll")} error={errors.roll}>
                        <input {...register("roll")} placeholder="Roll Number" className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow label="Student's Name (English)" isRequired={isRequired("student_name_en")} error={errors.student_name_en}
                        instruction="(According to Primary/Birth Registration Card)"
                        tooltip="Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters">
                        <input {...register("student_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e).toUpperCase();
                            }}
                            placeholder="Student Name (in English)"
                            className="w-full border p-2 rounded uppercase focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow label="Email" isRequired={isRequired("email")} error={errors.email}
                        tooltip="Enter a valid email address for communication. This is recommended">
                        <input {...register("email")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^\x00-\x7F]/g, "");
                            }}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" placeholder="example@email.com" />
                    </FieldRow>

                    <FieldRow label="ছাত্রের নাম (বাংলা)" isRequired={isRequired("student_name_bn")} error={errors.student_name_bn}
                        instruction="(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
                        tooltip="Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali">
                        <input {...register("student_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            placeholder="ছাত্রের নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow label="ডাকনাম (বাংলা)" isRequired={isRequired("student_nick_name_bn")} error={errors.student_nick_name_bn}
                        tooltip="Enter your nickname in Bengali, use only one word">
                        <input {...register("student_nick_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            placeholder="ডাকনাম (এক শব্দে/বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow label="Birth Registration No" isRequired={isRequired("birth_reg_no")} error={errors.birth_reg_no}
                        tooltip="Enter your 17-digit birth registration number. The year will be automatically extracted from this number">
                        <input {...register("birth_reg_no")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e).slice(0, 17);
                            }}
                            maxLength={17}
                            placeholder="20XXXXXXXXXXXXXXX"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow
                        label="Date of Birth:"
                        isRequired={isRequired("birth_year")}
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

                    <FieldRow label="Religion" isRequired={isRequired("religion")} error={errors.religion}>
                        <select {...register("religion")} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300">
                            <option value="">Select</option>
                            <option value="Islam">Islam</option>
                            <option value="Hinduism">Hinduism</option>
                            <option value="Christianity">Christianity</option>
                            <option value="Buddhism">Buddhism</option>
                        </select>
                    </FieldRow>
                    <FieldRow label="Blood Group" isRequired={isRequired("blood_group")} error={errors.blood_group}>
                        <select {...register("blood_group")} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300">
                            <option value="">Select</option>
                            {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                    </FieldRow>


                    <FieldRow label="Father's Name (English)" isRequired={isRequired("father_name_en")} error={errors.father_name_en}
                        instruction="(According to Primary/Birth Registration Card)"
                        tooltip="Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters">
                        <input {...register("father_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e).toUpperCase();
                            }}
                            placeholder="Father's Name (in English)"
                            className="w-full border p-2 rounded uppercase focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="পিতার নাম (বাংলা)" isRequired={isRequired("father_name_bn")} error={errors.father_name_bn}
                        instruction="(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
                        tooltip="Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali">
                        <input {...register("father_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            placeholder="পিতার নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Father's NID" isRequired={isRequired("father_nid")} error={errors.father_nid}
                        tooltip="Enter father's National ID number (10-17 digits)">
                        <input {...register("father_nid")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e).slice(0, 17);
                            }}
                            placeholder="1234567890"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Father's Phone" isRequired={isRequired("father_phone")} error={errors.father_phone}
                        tooltip="Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input {...register("father_phone")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e).slice(0, 11);
                            }}
                            placeholder="01XXXXXXXXX"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>


                    <FieldRow label="Mother's Name (English)" isRequired={isRequired("mother_name_en")} error={errors.mother_name_en}
                        instruction="(According to Primary/Birth Registration Card)"
                        tooltip="Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters">
                        <input {...register("mother_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e).toUpperCase();
                            }}
                            placeholder="Mother's Name (in English)"
                            className="w-full border p-2 rounded uppercase focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="মাতার নাম (বাংলা)" isRequired={isRequired("mother_name_bn")} error={errors.mother_name_bn}
                        instruction="(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)"
                        tooltip="Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali">
                        <input {...register("mother_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            placeholder="মাতার নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Mother's NID" isRequired={isRequired("mother_nid")} error={errors.mother_nid}
                        tooltip="Enter mother's National ID number (10-17 digits)">
                        <input {...register("mother_nid")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e).slice(0, 17);
                            }}
                            placeholder="1234567890"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Mother's Phone" isRequired={isRequired("mother_phone")} error={errors.mother_phone}
                        tooltip="Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input {...register("mother_phone")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e).slice(0, 11);
                            }}
                            placeholder="01XXXXXXXXX"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                </SectionHeader>

                {/* Step 2: Address */}
                <SectionHeader title="Address Information">
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
                            {permanentUpazilas.map((u) => (
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
                            onChange={(e) => setValue("same_as_permanent", e.target.checked)}
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
                                    {presentUpazilas.map((u) => (
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
                </SectionHeader>

                {/* Step 3: Guardian */}
                <SectionHeader title="Guardian Information">
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
                                    isRequired={guardian_is_not_father}
                                    error={errors.guardian_name}
                                    tooltip="Enter the full name of your guardian in English capital letters"
                                >
                                    <input
                                        type="text"
                                        {...register("guardian_name")}
                                        onInput={(e) => {
                                            const target = e.target as HTMLInputElement;
                                            target.value = filterEnglishInput(e).toUpperCase();
                                        }}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's Name"
                                        aria-invalid={!!errors.guardian_name}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Guardian's NID:"
                                    isRequired={guardian_is_not_father}
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
                                    isRequired={guardian_is_not_father}
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
                                    isRequired={guardian_is_not_father}
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
                                        {guardianRelations.map((relation) => (
                                            <option key={relation.value} value={relation.value}>
                                                {relation.label}
                                            </option>
                                        ))}
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
                                        isRequired={!guardian_address_same_as_permanent}
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
                                        isRequired={!guardian_address_same_as_permanent}
                                        error={errors.guardian_upazila}
                                        tooltip="Select the upazila/thana where your guardian lives"
                                    >
                                        <select
                                            {...register("guardian_upazila")}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            disabled={!guardian_district}
                                        >
                                            <option value="">Select upazila/thana</option>
                                            {guardianUpazilas.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </FieldRow>
                                    <FieldRow
                                        label="Post Office:"
                                        isRequired={!guardian_address_same_as_permanent}
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
                                        isRequired={!guardian_address_same_as_permanent}
                                        error={errors.guardian_post_code}
                                        tooltip="Enter the 4-digit postal code of your guardian's area"
                                    >
                                        <input
                                            {...register("guardian_post_code")}
                                            onInput={(e) => {
                                                const target = e.target as HTMLInputElement;
                                                target.value = filterNumericInput(e).slice(0, 4);
                                            }}
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
                                        isRequired={!guardian_address_same_as_permanent}
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
                </SectionHeader>

                {/* Step 4: Photo */}
                <SectionHeader title="Student Photo">
                    <FieldRow
                        label={
                            <span>
                                Photo:
                                {/* {!isEditMode && <span className="text-red-600 ml-1" aria-hidden="true">*</span>} */}
                            </span>
                        }
                        isRequired={true}
                        tooltip="Upload a recent photo. File must be JPG format and less than 2MB"
                        error={errors.photo}
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
                                        onChange={handlePhotoChange}
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
                                                setPhotoPreview(null);
                                                setValue("photo", "", { shouldValidate: true });
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
                </SectionHeader>

                {/* Step 5: Previous School */}
                <SectionHeader title="Previous School Information (Class 5)">
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
                </SectionHeader>

                {/* Step 6: Stipend Info */}
                <section>
                    <SectionHeader title="Stipend & Scholarship">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FieldRow label="Govt Scholarship?" isRequired error={errors.sorkari_brirti}>
                                <select {...register("sorkari_brirti")} className="w-full border p-2 rounded">
                                    <option value="">Select</option>
                                    <option value="Talentpool">Talentpool</option>
                                    <option value="General">General</option>
                                </select>
                            </FieldRow>
                            <FieldRow label="Upobritti?" isRequired error={errors.upobritti}>
                                <select {...register("upobritti")} className="w-full border p-2 rounded">
                                    <option value="">Select</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </FieldRow>
                        </div>
                    </SectionHeader>
                </section>

                <div className="pt-10 border-t-2 border-gray-100 flex justify-center">
                    <button
                        type="submit"
                        disabled={loading}
                        className={`px-12 py-4 rounded-xl text-xl font-bold text-white shadow-2xl transition-all
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
                    >
                        {loading ? "Submitting..." : isEditMode ? "Update Registration" : "Submit Registration"}
                    </button>
                </div>
            </form>
        </div >
    );
}
