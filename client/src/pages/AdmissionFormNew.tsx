import React, { useEffect, useState } from 'react'
import { z } from "zod"
import { useForm, type FieldError, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { districts, getUpazilasByDistrict } from '@/lib/location'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const admissionSchema = z.object({
    student_name_bn: z.string().min(1, "Student Name in Bangla is required").max(100).regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed"),
    student_nick_name_bn: z.string().min(1, "Student Nickname in Bangla is required").max(50).regex(/^[\u0980-\u09FF\s]*$/, "Only Bangla characters are allowed"),
    student_name_en: z.string().min(1, "Student Name in English is required").max(100).regex(/^[A-Za-z\s]*$/, "Only English characters are allowed"),
    birth_reg_no: z.string().min(1, "Birth Registration Number is required").max(17, "Birth Registration Number must be 17 characters"),
    registration_no: z.string().max(50),

    father_name_bn: z.string().min(1, "Father's Name in Bangla is required").max(100).regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed"),
    father_name_en: z.string().min(1, "Father's Name in English is required").max(100).regex(/^[A-Za-z\s]*$/, "Only English characters are allowed"),
    father_nid: z.string().min(10, "Father's NID is required").max(17).regex(/^\d+$/, "Father's NID must be numeric"),
    father_phone: z.string().length(11, "Phone number must be 11 digits").regex(/^(01[3-9]\d{8})$/, "Invalid Bangladeshi phone number"),

    mother_name_bn: z.string().min(1, "Mother's Name in Bangla is required").max(100).regex(/^[\u0980-\u09FF\s]+$/, "Only Bangla characters are allowed"),
    mother_name_en: z.string().min(1, "Mother's Name in English is required").max(100).regex(/^[A-Za-z\s]*$/, "Only English characters are allowed"),
    mother_nid: z.string().min(10, "Mother's NID is required").max(17).regex(/^\d+$/, "Mother's NID must be numeric"),
    mother_phone: z.string().length(11, "Phone number must be 11 digits").regex(/^(01[3-9]\d{8})$/, "Invalid Bangladeshi phone number"),

    birth_date: z.string().max(10),
    birth_year: z.string().min(1, "Birth Year is required").max(4).regex(/^\d{4}$/, "Year must be 4 digits"),
    birth_month: z.string().min(1, "Birth Month is required").max(2).regex(/^(0[1-9]|1[0-2])$/, "Month must be 01-12"),
    birth_day: z.string().min(1, "Birth Day is required").max(2).regex(/^(0[1-9]|[12]\d|3[01])$/, "Day must be 01-31"),
    blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""]),
    email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email format"),
    religion: z.string().min(1, "Religion is required").max(50),

    present_district: z.string().min(1, "Present District is required").max(50),
    present_upazila: z.string().min(1, "Present Upazila is required").max(50),
    present_post_office: z.string().min(1, "Present Post Office is required").max(100),
    present_post_code: z.string().min(4, "Present Post Code is required").max(4).regex(/^\d{4}$/, "Post code must be 4 digits"),
    present_village_road: z.string().min(1, "Present Village/Road is required").max(200),

    permanent_district: z.string().min(1, "Permanent District is required").max(50),
    permanent_upazila: z.string().min(1, "Permanent Upazila is required").max(50),
    permanent_post_office: z.string().min(1, "Permanent Post Office is required").max(100),
    permanent_post_code: z.string().min(4, "Permanent Post Code is required").max(4).regex(/^\d{4}$/, "Post code must be 4 digits"),
    permanent_village_road: z.string().min(1, "Permanent Village/Road is required").max(200),

    guardian_is_not_father: z.boolean().default(false),
    guardian_name: z.string().max(100).optional().or(z.literal("")),
    guardian_phone: z.string().optional().or(z.literal("")).refine(
        (val) => !val || (val.length === 11 && /^(01[3-9]\d{8})$/.test(val)),
        "Invalid Bangladeshi phone number (must be 11 digits)"
    ),
    guardian_relation: z.string().max(50).optional().or(z.literal("")),
    guardian_nid: z.string().max(17).optional().or(z.literal("")),
    guardian_address_same_as_permanent: z.boolean().default(false),
    guardian_district: z.string().max(50).optional().or(z.literal("")),
    guardian_upazila: z.string().max(50).optional().or(z.literal("")),
    guardian_post_office: z.string().max(100).optional().or(z.literal("")),
    guardian_post_code: z.string().optional().or(z.literal("")).refine(
        (val) => !val || /^\d{4}$/.test(val),
        "Post code must be 4 digits"
    ),
    guardian_village_road: z.string().max(200).optional().or(z.literal("")),

    prev_school_name: z.string().min(1, "Previous School Name is required").max(200),
    prev_school_district: z.string().min(1, "Previous School District is required").max(50),
    prev_school_upazila: z.string().min(1, "Previous School Upazila is required").max(50),
    section_in_prev_school: z.string().min(1, "Section is required").max(10),
    roll_in_prev_school: z.string().min(1, "Roll Number is required").max(20),
    prev_school_passing_year: z.string().min(1, "Passing Year is required").max(4).regex(/^\d{4}$/, "Year must be 4 digits"),

    father_profession: z.string().min(1, "Father's Profession is required").max(100),
    mother_profession: z.string().min(1, "Mother's Profession is required").max(100),
    parent_income: z.string().min(1, "Parent's Annual Income is required").max(100),

    admission_class: z.string().min(1, "Admission Class is required").max(50),
    admission_year: z.number().min(2020).max(2030),
    list_type: z.string().min(1, "List Type is required").max(50),
    admission_user_id: z.string().min(1, "User ID is required").max(50),
    serial_no: z.string().min(1, "Serial No is required").max(50),
    qouta: z.string().min(1, "Qouta is required").max(50),

    photo_path: z.string().min(1, "Photo is required").max(255),
    whatsapp_number: z.string().optional().or(z.literal("")).refine(
        (val) => !val || (val.length === 11 && /^(01[3-9]\d{8})$/.test(val)),
        "Invalid Bangladeshi phone number (must be 11 digits)"
    ),
}).superRefine((data, ctx) => {
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
        } else if (!/^(01[3-9]\d{8})$/.test(data.guardian_phone)) {
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
            if (!data.guardian_post_office || data.guardian_post_office.trim() === "") {
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
            if (!data.guardian_village_road || data.guardian_village_road.trim() === "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Guardian Village/Road is required",
                    path: ["guardian_village_road"],
                });
            }
        }
    }

    if (data.admission_class) {
        const cls = String(data.admission_class).trim().toLowerCase()
        const isEightOrNine = cls === '8' || cls.includes('8') || cls.includes('eight') || cls === '9' || cls.includes('9') || cls.includes('nine')
        if (isEightOrNine) {
            if (!data.registration_no || data.registration_no.length !== 10) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Registration Number must be 10 digits",
                    path: ["registration_no"],
                });
            }
        }
    }
})

type AdmissionFormData = z.infer<typeof admissionSchema>
const Instruction: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-gray-900">{children}</p>
)
const Error: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-red-600 text-sm">{children}</div>
)

// type Duplicate = {
//     message: string
//     existingRecord?: {
//         id?: string | number
//     }
// }
// const DuplicateWarning: React.FC<{ duplicates: Duplicate[] }> = ({ duplicates }) => (
//     <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//         <div className="flex items-start gap-2">
//             <svg className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
//             </svg>
//             <div className="flex-1">
//                 <h3 className="text-yellow-800 font-semibold mb-2">Duplicate Information Detected</h3>
//                 <div className="space-y-2">
//                     {duplicates.map((duplicate, index) => (
//                         <div key={index} className="text-yellow-700 text-sm">
//                             <p className="font-medium">{duplicate.message}</p>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </div>
//     </div>
// )
const FieldRow: React.FC<{
    label: React.ReactNode
    isRequired: boolean
    instruction?: React.ReactNode
    error: FieldError | undefined
    tooltip?: string
    children: React.ReactNode
}> = ({ label, isRequired, instruction, error, tooltip, children }) => (
    <div className="flex flex-col lg:flex-row items-start gap-1 lg:gap-4 py-2 w-full">
        <div className="w-full lg:w-60 text-left text-sm font-medium select-none mb-1 lg:mb-0 shrink-0">
            <span className="flex items-center gap-1">
                <span>{label}{isRequired && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}</span>
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
)
function getUserIdListFromSettings(settings: AdmissionSettings | null | undefined, admission_class?: string | null) {
    if (!settings) return []
    const cls = String(admission_class || '').trim().toLowerCase()
    if (cls === '6' || cls.includes('6') || cls.includes('six')) return parseCsvString(settings.user_id_class6)
    if (cls === '7' || cls.includes('7') || cls.includes('seven')) return parseCsvString(settings.user_id_class7)
    if (cls === '8' || cls.includes('8') || cls.includes('eight')) return parseCsvString(settings.user_id_class8)
    if (cls === '9' || cls.includes('9') || cls.includes('nine')) return parseCsvString(settings.user_id_class9)
    return []
}
function parseCsvString(v: unknown): string[] {
    if (v === undefined || v === null) return []
    const normalized = String(v).replace(/[–—−]/g, '-')
    return normalized
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
}
type AdmissionSettings = {
    user_id_class6?: string | null
    user_id_class7?: string | null
    user_id_class8?: string | null
    user_id_class9?: string | null
    [key: string]: unknown
}
function Form() {
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        watch,
        setValue
    } = useForm<AdmissionFormData>({
        resolver: zodResolver(admissionSchema) as Resolver<AdmissionFormData>,
        mode: 'onBlur',
        reValidateMode: 'onChange'
    })
    const form = watch()
    const [permanentUpazillas, setPermanentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [presentUpazillas, setPresentUpazillas] = useState<{ id: string; name: string }[]>([])
    const [sameAsPermanent, setSameAsPermanent] = useState(false)
    const [guardianUpazillas, setGuardianUpazillas] = useState<{ id: string; name: string }[]>([])
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<{ id: string; name: string }[]>([])
    const [photo, setPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const isEditMode = false
    const [admission_year, setAdmissionYear] = useState(new Date().getFullYear())
    const classGuidance: Record<string, Record<string, { instruction?: string; tooltip?: string }>> = {
        sixx: {
            studentNameBn: { instruction: '(প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)', tooltip: 'Enter your name as shown in Primary/Birth Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to Primary/Birth Registration Card)', tooltip: 'Enter your name as shown in Primary/Birth Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)', tooltip: "Enter father's name as shown in SSC Certificate/National ID Card in Bengali" },
            fatherNameEn: { instruction: '(According to SSC Certificate/National ID Card)', tooltip: "Enter father's name as shown in SSC Certificate/National ID Card in English capital letters" },
            motherNameBn: { instruction: '(এস‌এসসি সনদ/জাতীয় পরিচয়পত্র (NID) অনুযায়ী)', tooltip: "Enter mother's name as shown in SSC Certificate/National ID Card in Bengali" },
            motherNameEn: { instruction: '(According to SSC Certificate/National ID Card)', tooltip: "Enter mother's name as shown in SSC Certificate/National ID Card in English capital letters" },
        },
        seven: {
            studentNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: 'Enter your name as it appears in your Class Six Printout in Bengali' },
            studentNameEn: { instruction: '(According to Class Six Printout)', tooltip: 'Enter your name as it appears in your Class Six Printout in English capital letters' },
            fatherNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: "Enter father's name as it appears in Class Six Printout in Bengali" },
            fatherNameEn: { instruction: '(According to Class Six Printout)', tooltip: "Enter father's name as it appears in Class Six Printout in English capital letters" },
            motherNameBn: { instruction: '(ষষ্ঠ শ্রেণির প্রিন্ট‌আউট অনুযায়ী)', tooltip: "Enter mother's name as it appears in Class Six Printout in Bengali" },
            motherNameEn: { instruction: '(According to Class Six Printout)', tooltip: "Enter mother's name as it appears in Class Six Printout in English capital letters" },
        },
        eight: {
            studentNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: 'Enter your name as it appears in your Class Six Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: 'Enter your name as it appears in your Class Six Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter father's name as it appears in Class Six Registration Card in Bengali" },
            fatherNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: "Enter father's name as it appears in Class Six Registration Card in English capital letters" },
            motherNameBn: { instruction: '(ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter mother's name as it appears in Class Six Registration Card in Bengali" },
            motherNameEn: { instruction: '(According to Class Six Registration Card)', tooltip: "Enter mother's name as it appears in Class Six Registration Card in English capital letters" },
        },
        nine: {
            studentNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: 'Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in Bengali' },
            studentNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: 'Enter your name exactly as it appears in your JSC Printout/Class Six Registration Card in English capital letters' },
            fatherNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali" },
            fatherNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: "Enter father's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters" },
            motherNameBn: { instruction: '(অষ্টম শ্রেণির প্রিন্ট আউট/ষষ্ঠ শ্রেণির রেজিস্ট্রেশন কার্ড অনুযায়ী)', tooltip: "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in Bengali" },
            motherNameEn: { instruction: '(According to JSC Printout/Class Six Registration Card)', tooltip: "Enter mother's name exactly as it appears in JSC Printout/Class Six Registration Card in English capital letters" },
        }
    }
    const [classListOptions, setClassListOptions] = useState<string[]>([])
    const [listTypeOptions, setListTypeOptions] = useState<string[]>([])
    const [admissionSettings, setAdmissionSettings] = useState<AdmissionSettings | null>(null)
    const [userIdOptions, setUserIdOptions] = useState<string[]>([])
    const [serialNoOptions, setSerialNoOptions] = useState<string[]>([])
    const [admissionClosed, setAdmissionClosed] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const navigate = useNavigate()
    function getGuidance(fieldKey: string) {
        const clsKey = normalizeClassKey(form.admission_class)
        if (!clsKey) return { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
        const data = classGuidance[clsKey]
        if (!data) return { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
        return data[fieldKey] || { instruction: undefined as string | undefined, tooltip: undefined as string | undefined }
    }
    function normalizeClassKey(c?: string | null) {
        if (!c) return ''
        const s = String(c).trim().toLowerCase()
        if (s === '6' || s.includes('6') || s.includes('six')) return 'sixx'
        if (s === '7' || s.includes('7') || s.includes('seven')) return 'seven'
        if (s === '8' || s.includes('8') || s.includes('eight')) return 'eight'
        if (s === '9' || s.includes('9') || s.includes('nine')) return 'nine'
        return ''
    }
    useEffect(() => {
        const selectedDistrictId = form.permanent_district
        if (!selectedDistrictId) {
            setPermanentUpazillas([])
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPermanentUpazillas(upazilas)
    }, [form.permanent_district])
    useEffect(() => {
        const selectedDistrictId = form.present_district
        if (!selectedDistrictId) {
            setPresentUpazillas([])
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPresentUpazillas(upazilas)

    }, [form.present_district])
    useEffect(() => {
        if (!form.guardian_is_not_father || form.guardian_address_same_as_permanent) {
            setGuardianUpazillas([])
            return
        }
        const selectedDistrictId = form.guardian_district
        if (!selectedDistrictId) {
            setGuardianUpazillas([])
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setGuardianUpazillas(upazilas)
    }, [form.guardian_is_not_father, form.guardian_district, form.guardian_address_same_as_permanent])
    useEffect(() => {
        if (sameAsPermanent) {
            setValue('present_district', form.permanent_district)
            setValue('present_upazila', form.permanent_upazila)
            setValue('present_post_office', form.permanent_post_office)
            setValue('present_post_code', form.permanent_post_code)
            setValue('present_village_road', form.permanent_village_road)
        } else {
            setValue('present_district', '')
            setValue('present_upazila', '')
            setValue('present_post_office', '')
            setValue('present_post_code', '')
            setValue('present_village_road', '')
        }
    }, [sameAsPermanent, form.permanent_district, form.permanent_upazila, form.permanent_post_office, form.permanent_post_code, form.permanent_village_road, setValue])
    useEffect(() => {
        const selectedDistrictId = form.prev_school_district
        if (!selectedDistrictId) {
            setPrevSchoolUpazilas([])
            return
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId)
        setPrevSchoolUpazilas(upazilas)
    }, [form.prev_school_district])
    function isClassEightOrNine(c?: string | null) {
        const k = normalizeClassKey(c)
        return k === 'eight' || k === 'nine'
    }
    const isRequired = (field: keyof AdmissionFormData) => {
        const shape = admissionSchema.shape[field];
        return (shape)._zod.optin !== "optional";
    };
    function expandSerialList(tokens: string[]): string[] {
        const seen = new Set<string>()
        const result: string[] = []
        for (const t of tokens) {
            const m = String(t).match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)
            if (m) {
                let a = Number(m[1])
                let b = Number(m[2])
                if (Number.isNaN(a) || Number.isNaN(b)) continue
                if (a > b) [a, b] = [b, a]
                for (let i = a; i <= b; i++) {
                    const s = String(i)
                    if (!seen.has(s)) {
                        seen.add(s)
                        result.push(s)
                    }
                }
            } else {
                const s = String(t).trim()
                if (!s) continue
                if (!seen.has(s)) {
                    seen.add(s)
                    result.push(s)
                }
            }
        }
        return result
    }
    const fetchClasses = async () => {
        const admissionStatusResponse = await axios.get('/api/admission')
        if (admissionStatusResponse.data) {
            const { admission_open } = admissionStatusResponse.data
            setAdmissionYear(admissionStatusResponse.data.admission_year || '');
            setAdmissionSettings(admissionStatusResponse.data)
            const clsList = parseCsvString(admissionStatusResponse.data.class_list)
            if (clsList.length) setClassListOptions(clsList)
            if (!admission_open) {
                setAdmissionClosed(true)
                setInitialLoading(false)
                return
            }
            setInitialLoading(false)
        } else {
            navigate('/', { replace: true })
            return
        }
    }

    React.useEffect(() => {
        fetchClasses()
    }, [initialLoading])
    useEffect(() => {
        if (!admissionSettings) return
        const list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        setUserIdOptions(list)
        const cls = String(form.admission_class || '').trim().toLowerCase()
        const getSetting = (k: string) => (admissionSettings as Record<string, unknown>)[k]
        let listTypeTokens: string[] = []
        let serialRawTokens: string[] = []
        let user_id_list: string[] = []
        if (cls === '6' || cls.includes('6') || cls.includes('six')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class6') ?? getSetting('listTypeClass6') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class6') ?? getSetting('serialNoClass6') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        } else if (cls === '7' || cls.includes('7') || cls.includes('seven')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class7') ?? getSetting('listTypeClass7') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class7') ?? getSetting('serialNoClass7') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        } else if (cls === '8' || cls.includes('8') || cls.includes('eight')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class8') ?? getSetting('listTypeClass8') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class8') ?? getSetting('serialNoClass8') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        } else if (cls === '9' || cls.includes('9') || cls.includes('nine')) {
            listTypeTokens = parseCsvString(getSetting('list_type_class9') ?? getSetting('listTypeClass9') ?? getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no_class9') ?? getSetting('serialNoClass9') ?? getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        } else {
            listTypeTokens = parseCsvString(getSetting('list_type') ?? getSetting('listType'))
            serialRawTokens = parseCsvString(getSetting('serial_no') ?? getSetting('serialNo'))
            user_id_list = getUserIdListFromSettings(admissionSettings, form.admission_class)
        }

        if (listTypeTokens.length) {
            setListTypeOptions(listTypeTokens)
        } else {
            setListTypeOptions([])
        }
        if (user_id_list.length) {
            setUserIdOptions(user_id_list)
        } else {
            setUserIdOptions([])
        }
        const serialList = expandSerialList(serialRawTokens)
        if (serialList.length) setSerialNoOptions(serialList)
        else setSerialNoOptions([])
        if (form.list_type && listTypeTokens.length > 0 && !listTypeTokens.includes(String(form.list_type))) {
            setValue('list_type', '', { shouldValidate: true })
        }
        if (form.serial_no && serialList.length > 0 && !serialList.includes(String(form.serial_no))) {
            setValue('serial_no', '', { shouldValidate: true })
        }
        if (form.admission_user_id && user_id_list.length > 0 && !user_id_list.includes(String(form.admission_user_id))) {
            setValue('admission_user_id', '', { shouldValidate: true })
        }
    }, [admissionSettings, form.admission_class, form.list_type, form.serial_no, form.admission_user_id, setValue])
    function filterEnglishInput(e: React.FormEvent<HTMLInputElement>) {
        const target = e.target as HTMLInputElement;
        return target.value.replace(/[^A-Za-z.()\s]/g, '')
    }

    function filterBanglaInput(e: React.FormEvent<HTMLInputElement>) {
        const target = e.target as HTMLInputElement;
        return target.value.replace(/[^\u0980-\u09FF.()\s]/g, '')
    }
    function filterNumericInput(e: React.FormEvent<HTMLInputElement>) {
        const target = e.target as HTMLInputElement;
        return target.value.replace(/[^\d]/g, '')
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { files } = e.target
        if (!files || files.length === 0) return
        const file = files[0]

        if (!file.type.includes('jpeg') && !file.type.includes('jpg') && file.type !== 'image/jpeg') {
            alert('Only JPG format is allowed')
            if (e.target) e.target.value = ''
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('File must be smaller than 2MB')
            if (e.target) e.target.value = ''
            return
        }
        setPhoto(file)
        setValue('photo_path', file.name, { shouldValidate: true })
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const onSubmit = async (data: AdmissionFormData) => {
        try {
            console.log(errors);

            // 1) Upload photo first if present
            let storedPhotoPath = data.photo_path
            if (photo) {
                const fd = new FormData()
                fd.append('file', photo)
                // Optionally include a desired path or metadata
                fd.append('originalName', photo.name)

                const uploadRes = await axios.post('/api/upload/photo', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                // Expect backend to return { path: '/uploads/xyz.jpg' }
                storedPhotoPath = uploadRes?.data?.path || photo.name
            }

            // 2) Submit full form with photo_path from upload
            const payload = { ...data, photo_path: storedPhotoPath }
            const submitRes = await axios.post('/api/admission/submit', payload)

            console.log('Submission successful:', submitRes.data)
            alert('Application submitted successfully!')
            // reset()
        } catch (err: any) {
            console.error('Submission failed:', err)
            const msg = err?.response?.data?.message || 'Failed to submit application'
            alert(msg)
        }
    }
    const currentYear = new Date().getFullYear()
    const earliestYear = 1900
    const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, i) => String(currentYear - i))
    const months = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
        { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ]
    function getDaysInMonth(year: string, month: string) {
        if (!year || !month) return []
        const days = new Date(Number(year), Number(month), 0).getDate()
        return Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, '0'))
    }
    let days: string[] = []
    let monthOptions = months
    let disableMonth = false
    let disableDay = false
    if (form.birth_year && years.includes(form.birth_year)) {
        monthOptions = months
        disableMonth = false
        if (form.birth_month) {
            days = getDaysInMonth(form.birth_year, form.birth_month)
            disableDay = false
        } else {
            days = []
            disableDay = true
        }
    } else {
        days = []
        disableMonth = true
        disableDay = true
    }
    const birthRegNo = watch("birth_reg_no")
    useEffect(() => {
        if (birthRegNo && birthRegNo.length >= 4) {
            const year = birthRegNo.slice(0, 4)
            const yearNum = Number(year)
            if (/^\d{4}$/.test(year) && yearNum >= earliestYear && yearNum <= currentYear) {
                setValue('birth_year', year, { shouldValidate: true })
            } else {
                setValue('birth_year', '', { shouldValidate: true })
            }

        } else if (form.birth_year !== '') {
            setValue('birth_year', '', { shouldValidate: true })
        }
    }, [birthRegNo, currentYear, form.birth_reg_no, form.birth_year, setValue])
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
                            {/* {shouldNavigate
                                ? 'Redirecting...'
                                : isEditMode
                                    ? 'Loading Admission Data...'
                                    : 'Initializing Admission Form...'
                            } */}
                        </h3>
                        <p className="text-sm text-gray-500">Please wait while we prepare everything for you</p>
                    </div>
                </div>
            </div>
        )
    }

    if (admissionClosed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-xl w-full bg-white border border-gray-200 rounded-lg p-6 text-center shadow">
                    <svg className="mx-auto mb-4 w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Admissions are currently closed</h3>
                    <p className="text-sm text-gray-600 mb-4">Admission is not open at the moment. Please check back later or contact the school administration for updates.</p>
                    <div className="flex justify-center gap-3">
                        <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Go to Homepage</button>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded">Refresh</button>
                    </div>
                </div>
            </div>
        )
    }
    return (
        <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-blue-100 mb-4 py-2 sm:py-3 px-3 sm:px-4 rounded-t shadow-sm flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl lg:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1 sm:mb-2">
                    {isEditMode ? 'Edit Admission' : `Student's Information for Admission ${admission_year}`}
                </h2>
                <span className="text-xs sm:text-sm text-gray-600 text-center px-2">
                    Please fill all required fields. Fields marked <span className="text-red-600">*</span> are mandatory.
                </span>
            </div>

            {/* {success && (
                <div className="mb-4 p-3 sm:p-4 bg-green-100 text-green-800 rounded text-sm sm:text-base animate-fade-in shadow">
                    {success}
                </div>
            )}

            {duplicates.length > 0 && (
                <DuplicateWarning duplicates={duplicates} />
            )} */}

            {/* {errors.general && (
                <div className="mb-4 p-3 sm:p-4 bg-red-100 text-red-800 rounded text-sm sm:text-base animate-fade-in shadow">
                    {errors.general}
                </div>
            )} */}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">

                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Personal Information</strong></legend>

                    <FieldRow label="Admit to Class:" isRequired={isRequired("admission_class")} error={errors.admission_class} tooltip="Select the class from the admission settings">
                        <select
                            {...register("admission_class")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="">Select Class</option>
                            {classListOptions.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </FieldRow>

                    <FieldRow label="List Type:" isRequired={isRequired("list_type")} error={errors.list_type} tooltip="Select list type from settings">
                        <select
                            {...register("list_type")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="">Select List Type</option>
                            {listTypeOptions.map((lt) => (
                                <option key={lt} value={lt}>{lt}</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="Serial No:" isRequired={isRequired("serial_no")} error={errors.serial_no} tooltip="Select serial number from settings">
                        <select
                            {...register("serial_no")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="">Select Serial No</option>
                            {serialNoOptions.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="User ID:" isRequired={isRequired("admission_user_id")} error={errors.admission_user_id} tooltip="Select user id from settings">
                        <input
                            list="admission-userid-list"
                            {...register("admission_user_id")}
                            disabled={!form.admission_class}
                            placeholder={form.admission_class ? 'Type or select User ID' : 'Select class first'}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            autoComplete="off"
                        />
                        <datalist id="admission-userid-list">
                            {userIdOptions.map((u) => (
                                <option key={u} value={u} />
                            ))}
                        </datalist>
                    </FieldRow>


                    <FieldRow label="Qouta:" isRequired={isRequired("qouta")} error={errors.qouta} tooltip="Enter applicable quota (if any)">
                        <select
                            {...register("qouta")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                        >
                            <option value="">Select Qouta</option>
                            <option value="(GEN)">সাধারণ (GEN)</option>
                            <option value="(DIS) ">বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS) </option>
                            <option value="(FF)">মুক্তিযোদ্ধার সন্তান (FF)</option>
                            <option value="(GOV)">সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)</option>
                            <option value="(ME)">শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)</option>
                            <option value="(SIB)">সহোদর ভাই (SIB)</option>
                            <option value="(TWN)">যমজ (TWN)</option>
                            <option value="(Mutual Transfer)">পারস্পরিক বদলি (Mutual Transfer)</option>
                            <option value="(Govt. Transfer)">সরকারি বদলি (Govt. Transfer)</option>
                        </select>
                    </FieldRow>
                    <FieldRow label="Religion:" isRequired={isRequired("religion")} error={errors.religion} tooltip="Select your religion">
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
                    <FieldRow label="Student Name (Bangla):" isRequired={isRequired("student_name_bn")} instruction={getGuidance('studentNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.student_name_bn} tooltip={getGuidance('studentNameBn').tooltip || 'Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali'}>
                        <input
                            type="text"
                            id="student_name_bn"
                            {...register("student_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="ছাত্রের নাম (বাংলায়)" aria-invalid={!!errors.student_name_bn}
                        />
                    </FieldRow >
                    <FieldRow label="ডাকনাম (এক শব্দে/বাংলায়):" isRequired={isRequired("student_nick_name_bn")} error={errors.student_nick_name_bn} tooltip="Enter your nickname in Bengali, use only one word">
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
                    <FieldRow label="Student's Name (in English):" isRequired={isRequired("student_name_en")} instruction={getGuidance('studentNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.student_name_en} tooltip={getGuidance('studentNameEn').tooltip || "Enter your name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                        <input
                            type="text"
                            id="student_name_en"
                            {...register("student_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Student Name (in English)" aria-invalid={!!errors.student_name_en}
                        />
                    </FieldRow>

                    <FieldRow label="Birth Registration Number:" isRequired={isRequired("birth_reg_no")} error={errors.birth_reg_no} tooltip="Enter your 17-digit birth registration number. The year will be automatically extracted from this number">
                        <input
                            type="text"
                            id="birth_reg_no"
                            {...register("birth_reg_no")}
                            inputMode="numeric"
                            pattern="\d{17}"
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

                    <FieldRow label="Date of Birth:" isRequired={isRequired("birth_date")} error={errors.birth_year || errors.birth_month || errors.birth_day} tooltip="Birth year is auto-filled from birth registration number. Select month and day manually">
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
                                disabled={disableMonth || !form.birth_year}
                                aria-invalid={!!errors.birth_month}
                            >
                                <option value="">Month</option>
                                {monthOptions.map((month) => (
                                    <option key={month.value} value={month.value}>{month.label}</option>
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
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>
                    </FieldRow>
                    <FieldRow label="পিতার নাম (বাংলায়):" isRequired={isRequired("father_name_bn")} instruction={getGuidance('fatherNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.father_name_bn} tooltip={getGuidance('fatherNameBn').tooltip || "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"}>
                        <input
                            type="text"
                            id="father_name_bn"
                            {...register("father_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="পিতার নাম (বাংলায়)" aria-invalid={!!errors.father_name_bn}
                        />
                    </FieldRow>
                    <FieldRow label="Father's Name (in English):" isRequired={isRequired("father_name_en")} instruction={getGuidance('fatherNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.father_name_en} tooltip={getGuidance('fatherNameEn').tooltip || "Enter father's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                        <input
                            type="text"
                            id="father_name_en"
                            {...register("father_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Father's Name (in English)" aria-invalid={!!errors.father_name_en}
                        />
                    </FieldRow>
                    <FieldRow label="Father's NID:" isRequired={isRequired("father_nid")} error={errors.father_nid} tooltip="Enter father's National ID number (10-17 digits)">
                        <input
                            type="text"
                            id="father_nid"
                            {...register("father_nid")}
                            inputMode="numeric"
                            pattern="\d{10,17}"
                            minLength={10}
                            maxLength={17}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^0-9]/g, '');
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="1234567890"
                            aria-invalid={!!errors.father_nid}
                        />
                    </FieldRow>
                    <FieldRow label="Father's Mobile No:" isRequired={isRequired("father_phone")} error={errors.father_phone} tooltip="Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input
                            type="text"
                            id="father_phone"
                            {...register("father_phone")}
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={11}
                            minLength={11}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^0-9]/g, '');
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Father's Phone"
                            aria-invalid={!!errors.father_phone}
                        />
                    </FieldRow>
                    <FieldRow label="মাতার নাম (বাংলায়):" isRequired={isRequired("mother_name_bn")} instruction={getGuidance('motherNameBn').instruction || '(প্রাথমিক/জন্মনিবন্ধন সনদ (BRC) অনুযায়ী)'} error={errors.mother_name_bn} tooltip={getGuidance('motherNameBn').tooltip || "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in Bengali"}>
                        <input
                            type="text"
                            id="mother_name_bn"
                            {...register("mother_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="মাতার নাম (বাংলায়)"
                            aria-invalid={!!errors.mother_name_bn}
                        />
                    </FieldRow>
                    <FieldRow label="Mother's Name (in English):" isRequired={isRequired("mother_name_en")} instruction={getGuidance('motherNameEn').instruction || '(According to Primary/Birth Registration Card)'} error={errors.mother_name_en} tooltip={getGuidance('motherNameEn').tooltip || "Enter mother's name exactly as it appears in your Primary/Birth Registration (BRC) document in English capital letters"}>
                        <input
                            type="text"
                            id="mother_name_en"
                            {...register("mother_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(e);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Mother's Name (in English)"
                            aria-invalid={!!errors.mother_name_en} />
                    </FieldRow>
                    <FieldRow label="Mother's NID:" isRequired={isRequired("mother_nid")} error={errors.mother_nid} tooltip="Enter mother's National ID number (10-17 digits)">
                        <input
                            type="text"
                            id="mother_nid"
                            {...register("mother_nid")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e);
                            }}
                            name="motherNid"
                            inputMode="numeric"
                            pattern="\d{10,17}"
                            minLength={10}
                            maxLength={17}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="1234567890"
                            aria-invalid={!!errors.mother_nid}
                        />
                    </FieldRow>
                    <FieldRow label="Mother's Mobile No:" isRequired={isRequired("mother_phone")} error={errors.mother_phone} tooltip="Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input
                            type="text"
                            id="mother_phone"
                            {...register("mother_phone")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e);
                            }}
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={11}
                            minLength={11}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="01XXXXXXXXX"
                            aria-invalid={!!errors.mother_phone}
                        />
                    </FieldRow>
                    <FieldRow label="Blood Group:" isRequired={isRequired("blood_group")} error={errors.blood_group} tooltip="Select your blood group if known. This isut helpful for medical emergencies">

                        <select
                            id="blood_group"
                            {...register("blood_group")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200" aria-invalid={!!errors.blood_group}
                        >
                            {bloodGroups.map((group) => (
                                <option key={group} value={group}>{group || "Select Blood Group"}</option>
                            ))}

                        </select>
                    </FieldRow>
                    <FieldRow label="Email:" isRequired={isRequired("email")} error={errors.email} tooltip="Enter a valid email address for communication. This is recommended">
                        <input
                            type="email"
                            id="email"
                            {...register("email")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder='example@gmail.com' aria-invalid={!!errors.email}
                        />
                    </FieldRow>
                    <FieldRow label="Whatsapp Number:" isRequired={isRequired('whatsapp_number')} error={errors.whatsapp_number} tooltip="Optional — enter WhatsApp mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input
                            {...register("whatsapp_number")}
                            type="text"
                            inputMode="numeric"
                            pattern="01\d{9}"
                            maxLength={11}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="01XXXXXXXXX"
                            aria-invalid={!!errors.whatsapp_number}
                        />
                    </FieldRow>



                </fieldset>
                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Address</strong></legend>
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">Permanent Address:</h4>

                    <FieldRow label="District:" isRequired={isRequired("permanent_district")} error={errors.permanent_district} tooltip="Select the district of your permanent address">
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
                    <FieldRow label="Upazila/Thana:" isRequired={isRequired("permanent_upazila")} error={errors.permanent_upazila} tooltip="Select the upazila/thana of your permanent address. First select district to see options">
                        <select
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                            disabled={!form.permanent_district}
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
                    <FieldRow label="Post Office:" isRequired={isRequired("permanent_post_office")} error={errors.permanent_post_office} tooltip="Enter the name of your nearest post office">
                        <input
                            type="text"
                            id="permanent_post_office"
                            {...register("permanent_post_office")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Post Office Name"
                        />

                    </FieldRow>
                    <FieldRow label="Post Code:" isRequired={isRequired("permanent_post_code")} error={errors.permanent_post_code} tooltip="Enter the 4-digit postal code of your area">
                        <input
                            id="permanent_post_code"
                            {...register("permanent_post_code")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(e);
                            }}
                            type='text'
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="1234"
                            aria-invalid={!!errors.permanent_post_code}
                        />
                    </FieldRow>
                    <FieldRow label="Village/Road/House No:" isRequired={isRequired("permanent_village_road")} error={errors.permanent_village_road} tooltip="Enter your village name, road name, and house number">
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
                            <h4 className="font-semibold mb-2 text-sm sm:text-base">Present Address:</h4>
                            <FieldRow label="District:" isRequired={isRequired("present_district")} error={errors.present_district}>
                                <select
                                    id='present_district'
                                    {...register("present_district")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200">
                                    <option value="">Select district</option>
                                    {districts.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </FieldRow>
                            <FieldRow label="Upazila/Thana:" isRequired={isRequired("present_upazila")} error={errors.present_upazila}>
                                <select
                                    {...register("present_upazila")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    disabled={!form.present_district}
                                >
                                    <option value="">Select upazila/thana</option>
                                    {presentUpazillas.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </FieldRow>
                            <FieldRow label="Post Office:" isRequired={isRequired("present_post_office")} error={errors.present_post_office}>
                                <input
                                    {...register("present_post_office")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Post Office Name"
                                />
                            </FieldRow>
                            <FieldRow label="Post Code:" isRequired={isRequired("present_post_code")} error={errors.present_post_code}>
                                <input
                                    {...register("present_post_code")}
                                    onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.value = filterNumericInput(e);
                                    }}
                                    type='text'
                                    inputMode="numeric"
                                    pattern="\d{4}"
                                    maxLength={4}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="1234"
                                    aria-invalid={!!errors.present_post_code}
                                />
                            </FieldRow>
                            <FieldRow label="Village/Road/House No:" isRequired={isRequired("present_village_road")} error={errors.present_village_road}>
                                <input
                                    {...register("present_village_road")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Village/Road/House No"
                                />
                            </FieldRow>
                        </div>
                    )}
                </fieldset>



                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Guardian Information</strong></legend>
                    <FieldRow label="Guardian is not the father:" isRequired={isRequired("guardian_is_not_father")} error={errors.guardian_is_not_father} tooltip="Check this box only if your guardian is someone other than your father (e.g., mother, uncle, etc.)">
                        <label className="inline-flex items-start sm:items-center gap-2">
                            <input
                                type="checkbox"
                                id="guardianIsNotFather"
                                {...register("guardian_is_not_father")}
                                className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm leading-relaxed">Check if guardian is not father (can be mother or others)</span>
                        </label>
                    </FieldRow>
                    {form.guardian_is_not_father && (
                        <>
                            <div className="space-y-2">
                                <FieldRow label="Guardian's Name:" isRequired={true} error={errors.guardian_name} tooltip="Enter the full name of your guardian in English capital letters">
                                    <input
                                        type="text"
                                        {...register("guardian_name")}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's Name"
                                        aria-invalid={!!errors.guardian_name}
                                    />
                                </FieldRow>
                                <FieldRow label="Guardian's NID:" isRequired={true} error={errors.guardian_nid} tooltip="Enter guardian's National ID number (10-17 digits)">
                                    <input
                                        {...register("guardian_nid")}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{10,17}"
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
                                <FieldRow label="Guardian's Mobile No:" isRequired={true} error={errors.guardian_phone} tooltip="Enter guardian's mobile number in 11-digit format">
                                    <input
                                        {...register("guardian_phone")}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="01\d{9}"
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
                                <FieldRow label="Relationship with Guardian:" isRequired={true} error={errors.guardian_relation} tooltip="Select your relationship with the guardian from the dropdown">
                                    <select
                                        {...register("guardian_relation")}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        aria-invalid={!!errors.guardian_relation}
                                    >
                                        <option value="">Select Relationship / সম্পর্ক নির্বাচন করুন</option>
                                        <option value="Mother">Mother (মা)</option>
                                        <option value="Paternal Uncle">Paternal Uncle (চাচা/কাকা)</option>
                                        <option value="Paternal Aunt">Paternal Aunt (চাচী/কাকী)</option>
                                        <option value="Maternal Uncle">Maternal Uncle (মামা)</option>
                                        <option value="Maternal Aunt">Maternal Aunt (মামী)</option>
                                        <option value="Paternal Grandfather">Paternal Grandfather (দাদা)</option>
                                        <option value="Maternal Grandfather">Maternal Grandfather (নানা)</option>
                                        <option value="Paternal Grandmother">Paternal Grandmother (দাদী)</option>
                                        <option value="Maternal Grandmother">Maternal Grandmother (নানী)</option>
                                        <option value="Cousin">Cousin (চাচাতো/মামাতো ভাই/বোন)</option>
                                        <option value="Brother">Brother (ভাই)</option>
                                        <option value="Sister">Sister (বোন)</option>
                                        <option value="Other">Other (অন্যান্য)</option>
                                    </select>
                                </FieldRow>
                            </div>

                            <FieldRow label="Guardian's Address:" isRequired={false} error={errors.guardian_district} tooltip="Check if guardian's address is same as permanent address, otherwise fill separately">
                                <label className="inline-flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        {...register("guardian_address_same_as_permanent")}
                                        className="w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-sm">Same as Permanent Address</span>
                                </label>
                            </FieldRow>
                            {!form.guardian_address_same_as_permanent && (
                                <div className="space-y-2">
                                    <FieldRow label="District:" isRequired={true} error={errors.guardian_district} tooltip="Select the district where your guardian lives">
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
                                    <FieldRow label="Upazila/Thana:" isRequired={true} error={errors.guardian_upazila} tooltip="Select the upazila/thana where your guardian lives">
                                        <select
                                            {...register("guardian_upazila")}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            disabled={!form.guardian_district}
                                        >
                                            <option value="">Select upazila/thana</option>
                                            {guardianUpazillas.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </FieldRow>
                                    <FieldRow label="Post Office:" isRequired={isRequired("guardian_post_office")} error={errors.guardian_post_office} tooltip="Enter the name of your guardian's nearest post office">
                                        <input
                                            {...register("guardian_post_office")}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder="Post Office Name"
                                        />
                                    </FieldRow>
                                    <FieldRow label="Post Code:" isRequired={isRequired("guardian_post_code")} error={errors.guardian_post_code} tooltip="Enter the 4-digit postal code of your guardian's area">
                                        <input
                                            {...register("guardian_post_code")}
                                            type='text'
                                            inputMode="numeric"
                                            pattern="\d{4}"
                                            maxLength={4}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder="1234"
                                            aria-invalid={!!errors.guardian_post_code}
                                        />
                                    </FieldRow>
                                    <FieldRow label="Village/Road/House No:" isRequired={isRequired("guardian_village_road")} error={errors.guardian_village_road} tooltip="Enter your guardian's village name, road name, and house number">
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

                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Previous School Information</strong></legend>
                    <FieldRow label="Name of Previous School :" isRequired={isRequired("prev_school_name")} error={errors.prev_school_name} tooltip="Enter the full name of your previous school">
                        <input
                            {...register("prev_school_name")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Enter the name of your previous school"
                            aria-invalid={!!errors.prev_school_name}
                        />
                    </FieldRow>
                    {isClassEightOrNine(form.admission_class) && (
                        <FieldRow label="Registration Number:" isRequired={isRequired("registration_no")} error={errors.registration_no} tooltip="Enter your Registration Number from the registration card (required for Class 8 & 9)">
                            <input
                                name="registrationNo"
                                type="text"
                                inputMode="numeric"
                                pattern="\\d{10}"
                                minLength={10}
                                maxLength={10}
                                onInput={(e) => {
                                    const target = e.target as HTMLInputElement
                                    target.value = filterNumericInput(e).slice(0, 10)
                                }}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="10-digit Registration Number"
                                aria-invalid={!!errors.registration_no}
                            />
                        </FieldRow>
                    )}
                    <FieldRow label="Passing Year:" isRequired={isRequired("prev_school_passing_year")} error={errors.prev_school_passing_year} tooltip="Select the year you passed from your previous school">
                        <select
                            {...register("prev_school_passing_year")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            aria-invalid={!!errors.prev_school_passing_year}
                        >
                            <option value="">Select Year</option>
                            {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </FieldRow>

                    <FieldRow label="Section:" isRequired={isRequired("section_in_prev_school")} error={errors.section_in_prev_school} tooltip="Select which section you were in during previous school">
                        <select
                            {...register("section_in_prev_school")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            aria-invalid={!!errors.section_in_prev_school}
                        >
                            <option value="">Select Section</option>
                            {["No section", 'A', 'B', 'C', 'D', 'E', 'F'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FieldRow>

                    <FieldRow label="Roll:" isRequired={isRequired('roll_in_prev_school')} error={errors.roll_in_prev_school} tooltip="Enter your roll number in previous school">
                        <input
                            {...register("roll_in_prev_school")}
                            inputMode="numeric"
                            maxLength={6}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Roll number"
                            aria-invalid={!!errors.roll_in_prev_school}
                        />
                    </FieldRow>
                    <FieldRow label="District:" isRequired={isRequired("prev_school_district")} error={errors.prev_school_district} tooltip="Select the district where your previous school is located">
                        <select
                            {...register("prev_school_district")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            aria-invalid={!!errors.prev_school_district}
                        >
                            <option value="">Select District</option>
                            {districts.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="Upazila/Thana:" isRequired={isRequired("prev_school_upazila")} error={errors.prev_school_upazila} tooltip="Select the upazila/thana where your previous school is located">
                        <select
                            {...register("prev_school_upazila")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            disabled={!form.prev_school_district}
                            aria-invalid={!!errors.prev_school_upazila}
                        >
                            <option value="">Select Upazila/Thana</option>
                            {prevSchoolUpazilas.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </FieldRow>
                </fieldset>
                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Admission Information</strong></legend>
                    <FieldRow label="Father's Profession:" isRequired={isRequired("father_profession")} error={errors.father_profession} tooltip="Select father's profession">
                        <div>
                            <select
                                value={(["Govt. Service", "Non-Govt. Service", "Private Job"].includes(form.father_profession || '') || !form.father_profession) ? (form.father_profession || '') : 'Other'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setValue("father_profession", val === 'Other' ? 'Other' : val, { shouldValidate: true });
                                }}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                            >
                                <option value="">Select Profession</option>
                                <option value="Govt. Service">Govt. Service</option>
                                <option value="Non-Govt. Service">Non-Govt. Service</option>
                                <option value="Private Job">Private Job</option>
                                <option value="Other">Other</option>
                            </select>

                            {((!["Govt. Service", "Non-Govt. Service", "Private Job"].includes(form.father_profession || '') && !!form.father_profession) || form.father_profession === 'Other') && (
                                <div className="mt-2">
                                    <input
                                        {...register("father_profession")}
                                        value={form.father_profession === 'Other' ? '' : (form.father_profession || '')}
                                        onChange={(e) => setValue("father_profession", e.target.value, { shouldValidate: true })}
                                        placeholder="Please specify father's profession"
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                        aria-invalid={!!errors.father_profession}
                                    />
                                </div>
                            )}
                        </div>
                    </FieldRow>

                    <FieldRow label="Mother's Profession:" isRequired={isRequired("mother_profession")} error={errors.mother_profession || errors.mother_profession} tooltip="Select mother's profession">
                        <div>
                            <select
                                value={(["Housewife", "Govt. Service", "Non-Govt. Service", "Private Job"].includes(form.mother_profession || '') || !form.mother_profession) ? (form.mother_profession || '') : 'Other'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setValue("mother_profession", val === 'Other' ? 'Other' : val, { shouldValidate: true });
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

                            {((!["Housewife", "Govt. Service", "Non-Govt. Service", "Private Job"].includes(form.mother_profession || '') && !!form.mother_profession) || form.mother_profession === 'Other') && (
                                <div className="mt-2">
                                    <input
                                        {...register("mother_profession")}
                                        value={form.mother_profession === 'Other' ? '' : (form.mother_profession || '')}
                                        onChange={(e) => setValue("mother_profession", e.target.value, { shouldValidate: true })}
                                        placeholder="Please specify mother's profession"
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                                        aria-invalid={!!errors.mother_profession}
                                    />
                                </div>
                            )}
                        </div>
                    </FieldRow>

                    <FieldRow label="Parent's Annual Income Range:" isRequired={isRequired("parent_income")} tooltip="Select guardian's annual income range" error={errors.parent_income}>
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

                <fieldset style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <legend><strong>Additional Information</strong></legend>

                    <FieldRow
                        label={
                            <span>
                                Photo:
                                {!isEditMode && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
                            </span>
                        }
                        isRequired={!isEditMode}
                        tooltip="Upload a recent photo. File must be JPG format and less than 2MB"
                        error={errors.photo_path}
                    >
                        <div className="flex flex-col lg:flex-row items-start gap-4">
                            <div className="shrink-0">
                                <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 overflow-hidden">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="photo preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center px-2">
                                            <div className="text-xs sm:text-sm text-gray-500">
                                                {isEditMode ? 'Current photo' : 'No photo uploaded'}
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
                                    <label htmlFor="photo-input" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 cursor-pointer text-sm sm:text-base">
                                        {photoPreview ? 'Change Photo' : 'Choose Photo'}
                                    </label>

                                    {(photoPreview || photo) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPhoto(null)
                                                setPhotoPreview(null)
                                                setValue('photo_path', '', { shouldValidate: true })
                                                const input = document.getElementById('photo-input') as HTMLInputElement | null
                                                if (input) input.value = ''
                                            }}
                                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded bg-white text-sm sm:text-base hover:bg-gray-50"
                                        >
                                            Remove Photo
                                        </button>
                                    )}
                                </div>

                                <Instruction>
                                    JPG only. Max file size 2MB. Click the box or "Choose Photo" to upload.
                                </Instruction>
                            </div>
                        </div>
                    </FieldRow>
                </fieldset>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                    <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Submit Application
                    </button>
                    <button type='button' onClick={() => reset()} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Reset Form
                    </button>
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
    )
}

export default Form
