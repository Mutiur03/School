import React, { useEffect, useState } from "react";
import {
    useForm,
    useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { districts, getUpazilasByDistrict } from "@/lib/location";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
    Class6Registration,
    registrationSchema,
    registrationDefaultValues,
} from "@school/shared-schemas";
import { guardianRelations } from "@/lib/guardian";
import { getFileUrl } from "@/lib/backend";
import DuplicateWarning, { Duplicate } from "@/components/Form/DupliacteWarning";
import SectionHeader from "@/components/Form/SectionHeader";
import FieldRow, { Instruction } from "@/components/Form/FieldRow";
import { filterEnglishInput, filterBanglaInput, filterNumericInput, filterAddressInput } from "@school/shared-schemas";

const registrationSchemaBase = registrationSchema;

export default function RegistrationClass6() {
    useEffect(() => {
        document.title = "Class Six Registration Form";
    }, []);
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [permanentUpazilas, setPermanentUpazilas] = useState<any[]>([]);
    const [presentUpazilas, setPresentUpazilas] = useState<any[]>([]);
    const [guardianUpazilas, setGuardianUpazilas] = useState<any[]>([]);
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [availableRolls, setAvailableRolls] = useState<string[]>([]);
    const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
    const {
        register,
        handleSubmit,
        setValue,
        control,
        reset,
        formState: { errors },
    } = useForm<Class6Registration>({
        resolver: zodResolver(registrationSchemaBase) as any,
        mode: "onSubmit",
        reValidateMode: "onChange",
        shouldUnregister: false,
        defaultValues: registrationDefaultValues,
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
    const present_upazila = useWatch({ control, name: "present_upazila" });
    const guardian_is_not_father = useWatch({
        control,
        name: "guardian_is_not_father",
    });
    const guardian_address_same_as_permanent = useWatch({
        control,
        name: "guardian_address_same_as_permanent",
    });
    const guardian_district = useWatch({ control, name: "guardian_district" });
    const guardian_upazila = useWatch({ control, name: "guardian_upazila" });
    const prev_school_district = useWatch({
        control,
        name: "prev_school_district",
    });
    const prev_school_upazila = useWatch({ control, name: "prev_school_upazila" });
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
    const selectedSection = useWatch({
        control,
        name: "section",
    });
    // Unified data initialization
    useEffect(() => {
        const initializeData = async () => {
            try {
                setLoading(true);

                // 1. Fetch Settings
                const settingsRes = await axios.get("/api/reg/class-6");
                let currentSettings = null;
                if (settingsRes.data.success) {
                    if (!settingsRes.data.data.reg_open) {
                        navigate("/", { replace: true });
                        return;
                    }
                    currentSettings = settingsRes.data.data;
                    setSettings(currentSettings);
                }



                // 3. Fetch Registration Data if Edit Mode
                if (isEditMode && id) {
                    const response = await axios.get(`/api/reg/class-6/form/${id}`);
                    if (response.data.success) {
                        const data = response.data.data;

                        // Check status - redirect if not pending
                        if (data.status && data.status !== "pending") {
                            navigate(`/registration/class-6/confirm/${id}`, { replace: true });
                            return;
                        }

                        // Prepare form data
                        const formData: any = { ...data };

                        // Convert nulls to empty strings to avoid controlled/uncontrolled warnings and Zod errors
                        Object.keys(formData).forEach((key) => {
                            if (formData[key] === null) {
                                formData[key] = "";
                            }
                        });

                        // Ensure booleans
                        formData.same_as_permanent = Boolean(data.same_as_permanent);
                        formData.guardian_is_not_father = Boolean(data.guardian_is_not_father);
                        formData.guardian_address_same_as_permanent = Boolean(data.guardian_address_same_as_permanent);

                        // Populate available rolls BEFORE reset so the dropdown has options to match
                        if (currentSettings && data.section) {
                            const rollRange = data.section === "A" ? currentSettings.a_sec_roll : currentSettings.b_sec_roll;
                            const rolls = parseRollRange(rollRange);
                            setAvailableRolls(rolls);
                        }

                        reset(formData);

                        // Explicitly set roll to ensure it's selected once options are ready
                        if (data.roll) {
                            setValue("roll", data.roll, { shouldValidate: true });
                        }

                        // Handle Address Matching Logic
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

                        setValue("same_as_permanent", isSame);
                        setValue("guardian_address_same_as_permanent", isGuardianSameAsPermanent);

                        // Populate Upazilas
                        if (data.guardian_district) {
                            setGuardianUpazilas(getUpazilasByDistrict(data.guardian_district));
                        }
                        if (data.permanent_district) {
                            setPermanentUpazilas(getUpazilasByDistrict(data.permanent_district));
                        }
                        if (data.present_district) {
                            setPresentUpazilas(getUpazilasByDistrict(data.present_district));
                        }
                        if (data.prev_school_district) {
                            setPrevSchoolUpazilas(getUpazilasByDistrict(data.prev_school_district));
                        }

                        // Handle Guardian Logic (from snippet)
                        if (data.guardian_name && data.guardian_name.trim() !== "") {
                            setValue("guardian_is_not_father", true);
                        } else {
                            setValue("guardian_is_not_father", false);
                        }

                        // Photo photoPreview
                        if (data.photo) {
                            setPhotoPreview(getFileUrl(data.photo));
                        }
                    } else {
                        // Registration not found or error
                        navigate("/registration/class-6", { replace: true });
                    }
                }
            } catch (error) {
                console.error("Failed to initialize data:", error);
                navigate("/", { replace: true });
            } finally {
                setLoading(false);
            }
        };

        initializeData();
    }, [isEditMode, id, navigate, reset]);

    // Parse roll range from string like "01-50", "1,10,12-50", or "1,5,10-20,25"
    const parseRollRange = (rollRange: string | null): string[] => {
        if (!rollRange) return [];

        const rolls: Set<number> = new Set();
        const parts = rollRange.split(',').map(p => p.trim());

        for (const part of parts) {
            // Check if it's a range (e.g., "12-50")
            const rangeMatch = part.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                for (let i = start; i <= end; i++) {
                    rolls.add(i);
                }
            } else {
                // It's a single number (e.g., "1" or "10")
                const num = parseInt(part);
                if (!isNaN(num)) {
                    rolls.add(num);
                }
            }
        }

        // Convert to sorted array of padded strings
        return Array.from(rolls)
            .sort((a, b) => a - b)
            .map(num => String(num).padStart(2, "0"));
    };

    // Update available rolls when section changes
    useEffect(() => {
        if (!settings || !selectedSection) {
            setAvailableRolls([]);
            return;
        }
        if (selectedSection === "A") {
            setAvailableRolls(parseRollRange(settings.a_sec_roll));
        } else if (selectedSection === "B") {
            setAvailableRolls(parseRollRange(settings.b_sec_roll));
        } else {
            setAvailableRolls([]);
        }
    }, [selectedSection, settings]);

    useEffect(() => {
        const selectedDistrictId = permanent_district;
        if (!selectedDistrictId) {
            setPermanentUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPermanentUpazilas(upazilas);
        // Only clear the upazila value if it's missing or not present in the new options
        if (!permanent_upazila || !upazilas.some((u: any) => String(u.id) === String(permanent_upazila))) {
            setValue("permanent_upazila", "");
        }
    }, [permanent_district, permanent_upazila]);
    useEffect(() => {
        const selectedDistrictId = present_district;
        if (!selectedDistrictId) {
            setPresentUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPresentUpazilas(upazilas);
        if (!present_upazila || !upazilas.some((u: any) => String(u.id) === String(present_upazila))) {
            setValue("present_upazila", "");
        }
    }, [present_district, present_upazila]);
    useEffect(() => {
        if (!guardian_is_not_father) {
            setGuardianUpazilas([]);
            return;
        }
        const selectedDistrictId = guardian_address_same_as_permanent ? permanent_district : guardian_district;
        if (!selectedDistrictId) {
            setGuardianUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setGuardianUpazilas(upazilas);
        const expectedUpazila = guardian_address_same_as_permanent ? permanent_upazila : guardian_upazila;
        if (!expectedUpazila || !upazilas.some((u: any) => String(u.id) === String(expectedUpazila))) {
            setValue("guardian_upazila", "");
        }
    }, [
        guardian_is_not_father,
        guardian_district,
        guardian_address_same_as_permanent,
        permanent_district,
        permanent_upazila,
        guardian_upazila,
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
    ]);

    useEffect(() => {
        if (guardian_address_same_as_permanent) {
            setValue("guardian_district", permanent_district, {
                shouldValidate: true,
            });
            setValue("guardian_upazila", permanent_upazila, { shouldValidate: true });
            setValue("guardian_post_office", permanent_post_office, {
                shouldValidate: true,
            });
            setValue("guardian_post_code", permanent_post_code, {
                shouldValidate: true,
            });
            setValue("guardian_village_road", permanent_village_road, {
                shouldValidate: true,
            });
        }
    }, [
        guardian_address_same_as_permanent,
        permanent_district,
        permanent_upazila,
        permanent_post_office,
        permanent_post_code,
        permanent_village_road,
    ]);

    useEffect(() => {
        if (!guardian_is_not_father) {
            setValue("guardian_name", "");
            setValue("guardian_phone", "");
            setValue("guardian_relation", "");
            setValue("guardian_nid", "");
            setValue("guardian_address_same_as_permanent", false);
            setValue("guardian_district", "");
            setValue("guardian_upazila", "");
            setValue("guardian_post_office", "");
            setValue("guardian_post_code", "");
            setValue("guardian_village_road", "");
        }
    }, [guardian_is_not_father]);
    useEffect(() => {
        const selectedDistrictId = prev_school_district;
        if (!selectedDistrictId) {
            setPrevSchoolUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setPrevSchoolUpazilas(upazilas);
        if (!prev_school_upazila || !upazilas.some((u: any) => String(u.id) === String(prev_school_upazila))) {
            setValue("prev_school_upazila", "");
        }
    }, [prev_school_district, prev_school_upazila]);
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setValue("photo", file, { shouldValidate: true });
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
    }, [birth_reg_no]);
    const onSubmit = async (data: Class6Registration) => {
        setLoading(true);
        setDuplicates([]);
        try {
            let photo = "";

            // Handle Photo Upload
            if (data.photo instanceof File) {
                // 1. Get upload URL
                const { data: uploadData } = await axios.post("/api/reg/class-6/form/upload-url", {
                    filename: data.photo.name,
                    filetype: data.photo.type,
                    name: data.student_name_en,
                    roll: data.roll,
                    section: data.section,
                    year: data.birth_year
                });

                if (uploadData.success) {
                    // 2. Upload to R2
                    await axios.put(uploadData.url, data.photo, {
                        headers: { "Content-Type": data.photo.type },
                    });
                    photo = uploadData.key;
                }
            } else if (typeof data.photo === "string") {
                photo = data.photo;
            }

            // 3. Submit Registration
            const submissionData = {
                ...data,
                photo,
            };
            // @ts-ignore
            // delete submissionData.photo;

            const endpoint = isEditMode ? `/api/reg/class-6/form/${id}` : "/api/reg/class-6/form";
            const method = isEditMode ? "put" : "post";

            const response = await axios[method](endpoint, submissionData);
            if (response.data.success) {
                navigate(`/registration/class-6/confirm/${response.data.data.id}`);
            }
        } catch (error: any) {
            console.error("Submission error", error);
            if (error.response && error.response.status === 400 && error.response.data.duplicates) {
                setDuplicates(error.response.data.duplicates);
                // Scroll to top to see duplicates
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert(error.response?.data?.message || "Failed to submit registration. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const scrollToFirstError = (errors: any) => {
        if (!errors) return;
        const firstKey = Object.keys(errors)[0];
        if (!firstKey) return;

        // Try to find element by name (React Hook Form sets name on registered inputs)
        let el = document.querySelector(`[name="${firstKey}"]`) as HTMLElement | null;
        if (!el) el = document.getElementById(firstKey) as HTMLElement | null;
        if (!el) {
            // fallback: try to find any element with data-field attribute
            el = document.querySelector(`[data-field="${firstKey}"]`) as HTMLElement | null;
        }
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            try { (el as HTMLElement).focus(); } catch { /* ignore */ }
        } else {
            // If element not found, scroll to top as fallback
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };
    const REQUIRED_FIELDS: ReadonlyArray<keyof Class6Registration> = [
        "student_name_bn",
        "student_name_en",
        "birth_reg_no",
        "birth_year",
        "birth_month",
        "birth_day",
        "religion",
        "father_name_bn",
        "father_name_en",
        "father_nid",
        "father_phone",
        "mother_name_bn",
        "mother_name_en",
        "mother_nid",
        "mother_phone",
        "permanent_district",
        "permanent_upazila",
        "permanent_post_office",
        "permanent_post_code",
        "permanent_village_road",
        "present_district",
        "present_upazila",
        "present_post_office",
        "present_post_code",
        "present_village_road",
        "section",
        "roll",
        "prev_school_name",
        "prev_school_passing_year",
        "section_in_prev_school",
        "roll_in_prev_school",
        "prev_school_district",
        "prev_school_upazila",
        "nearby_student_info",
        "photo",
    ] as const;

    const isRequired = (fieldName: keyof Class6Registration) =>
        REQUIRED_FIELDS.includes(fieldName);



    return (
        <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-blue-100 mb-4 py-2 sm:py-3 px-3 sm:px-4 rounded-t shadow-sm flex flex-col items-center">
                <h2 className="text-xl sm:text-2xl lg:text-3xl text-center font-bold text-blue-700 tracking-tight underline underline-offset-4 mb-1 sm:mb-2">
                    {isEditMode
                        ? `Edit Your Information for Class Six Registration ${settings?.class6_year}`
                        : `Student's Information for Registration of Class Six ${settings?.class6_year}`}
                </h2>
                <span className="text-xs sm:text-sm text-gray-600 text-center px-2">
                    Please fill all required fields. Fields marked{" "}
                    <span className="text-red-600">*</span> are mandatory.
                </span>
            </div>

            {duplicates.length > 0 && <DuplicateWarning duplicates={duplicates} />}

            <form onSubmit={handleSubmit(onSubmit, (errors) => {
                console.log("=== FORM VALIDATION ERRORS ===");
                console.log(errors);
                console.log("Total errors:", Object.keys(errors).length);
                Object.entries(errors).forEach(([field, error]) => {
                    console.log(`${field}:`, error?.message);
                });
                console.log("==============================");
                scrollToFirstError(errors);
            })} className="space-y-10">
                {/* Step 1: Personal Info */}
                <SectionHeader title="Personal Information" >
                    <FieldRow label="Section" isRequired={isRequired("section")} error={errors.section}
                        tooltip="Select your section (A or B). Available rolls will be shown based on your selection">
                        <select {...register("section")} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="">Select Section</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                        </select>
                    </FieldRow>
                    <FieldRow label="Roll" isRequired={isRequired("roll")} error={errors.roll}
                        tooltip="Select your roll number from the available options for your section">
                        <select
                            {...register("roll")}
                            disabled={!selectedSection || availableRolls.length === 0}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="">{!selectedSection ? "Select Section First" : availableRolls.length === 0 ? "No rolls available" : "Select Roll Number"}</option>
                            {availableRolls.map((roll) => (
                                <option key={roll} value={roll}>
                                    {roll}
                                </option>
                            ))}
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
                        </select>
                    </FieldRow>
                    <FieldRow label="ছাত্রের নাম (বাংলায়)" isRequired={isRequired("student_name_bn")} error={errors.student_name_bn}
                        instruction="(প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)"
                        tooltip="Enter your name exactly as it appears in Student's Primary/Birth Registration Certificate in Bengali">
                        <input {...register("student_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(target.value);
                            }}
                            placeholder="ছাত্রের নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Student's Name (in English)" isRequired={isRequired("student_name_en")} error={errors.student_name_en}
                        instruction="(According to Primary/Birth Registration Certificate)"
                        tooltip="Enter your name exactly as it appears in Student's Primary/Birth Registration Certificate in English capital letters">
                        <input {...register("student_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(target.value);
                            }}
                            placeholder="Student Name (in English)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Birth Registration No" isRequired={isRequired("birth_reg_no")} error={errors.birth_reg_no}
                        tooltip="Enter your 17-digit birth registration number. The year will be automatically extracted from this number">
                        <input {...register("birth_reg_no")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(target.value).slice(0, 17);
                            }}
                            maxLength={17}
                            placeholder="17 Digits"
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
                    <FieldRow label="পিতার নাম (বাংলায়)" isRequired={isRequired("father_name_bn")} error={errors.father_name_bn}
                        instruction="(SSC সনদ/NID/ছাত্রের প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)"
                        tooltip="Enter father's name exactly as it appears in  SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in Bengali">
                        <input {...register("father_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(target.value);
                            }}
                            placeholder="পিতার নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Father's Name (in English)" isRequired={isRequired("father_name_en")} error={errors.father_name_en}
                        instruction="(According to SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate)"
                        tooltip="Enter father's name exactly as it appears in  SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in English capital letters">
                        <input {...register("father_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(target.value);
                            }}
                            placeholder="Father's Name (in English)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Father's NID Number" isRequired={isRequired("father_nid")} error={errors.father_nid}
                        tooltip="Enter father's National ID number (10-17 digits)">
                        <input {...register("father_nid")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(target.value).slice(0, 17);
                            }}
                            placeholder="10 Digits/13 Digits/17 Digits"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Father's Mobile Number" isRequired={isRequired("father_phone")} error={errors.father_phone}
                        tooltip="Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input {...register("father_phone")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(target.value).slice(0, 11);
                            }}
                            placeholder="01XXXXXXXXX"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>


                    <FieldRow label="মাতার নাম (বাংলায়)" isRequired={isRequired("mother_name_bn")} error={errors.mother_name_bn}
                        instruction="(SSC সনদ/NID/ছাত্রের প্রাথমিক/জন্মনিবন্ধন সনদ অনুযায়ী)"
                        tooltip="Enter mother's name exactly as it appears in  SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in Bengali">
                        <input {...register("mother_name_bn")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterBanglaInput(target.value);
                            }}
                            placeholder="মাতার নাম (বাংলায়)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Mother's Name (in English)" isRequired={isRequired("mother_name_en")} error={errors.mother_name_en}
                        instruction="(According to SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate)"
                        tooltip="Enter mother's name exactly as it appears in  SSC Certificate/NID Card/Student's Primary/Birth Registration Certificate in English capital letters">
                        <input {...register("mother_name_en")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterEnglishInput(target.value);
                            }}
                            placeholder="Mother's Name (in English)"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Mother's NID Number" isRequired={isRequired("mother_nid")} error={errors.mother_nid}
                        tooltip="Enter mother's National ID number (10-17 digits)">
                        <input {...register("mother_nid")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(target.value).slice(0, 17);
                            }}
                            placeholder="10 Digits/13 Digits/17 Digits"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>
                    <FieldRow label="Mother's Mobile Number" isRequired={isRequired("mother_phone")} error={errors.mother_phone}
                        tooltip="Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)">
                        <input {...register("mother_phone")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterNumericInput(target.value).slice(0, 11);
                            }}
                            placeholder="01XXXXXXXXX"
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" />
                    </FieldRow>

                    <FieldRow label="Email" isRequired={false} error={errors.email}
                        tooltip="Enter a valid email address for communication. This is recommended">
                        <input {...register("email")}
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.replace(/[^\x00-\x7F]/g, "");
                            }}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300" placeholder="example@email.com" />
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
                        isRequired={isRequired("permanent_upazila")}
                        error={errors.permanent_upazila}
                        tooltip="Select the upazila/thana of your permanent address. First select district to see options"
                    >
                        <select
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                            disabled={!permanent_district}
                            {...register("permanent_upazila")}
                        >
                            <option value="">Select Upazila/Thana</option>
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
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterAddressInput(target.value);
                            }}
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
                                target.value = filterNumericInput(target.value);
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
                            onInput={(e) => {
                                const target = e.target as HTMLInputElement;
                                target.value = filterAddressInput(target.value);
                            }}
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
                                isRequired={isRequired("present_upazila")}
                                error={errors.present_upazila}
                            >
                                <select
                                    {...register("present_upazila")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    disabled={!present_district}
                                >
                                    <option value="">Select Upazila/Thana</option>
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
                                    onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.value = filterAddressInput(target.value);
                                    }}
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
                                        target.value = filterNumericInput(target.value);
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
                                    onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.value = filterAddressInput(target.value);
                                    }}
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
                        isRequired={false}
                        error={undefined}
                        tooltip="Check this box only if your guardian is someone other than your father (e.g., mother, uncle, etc.)"
                    >
                        <label className="inline-flex items-start sm:items-center gap-2">
                            <input
                                type="checkbox"
                                id="guardianIsNotFather"
                                {...register("guardian_is_not_father", {
                                    setValueAs: (v) => !!v,
                                })}
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
                                            target.value = filterEnglishInput(target.value);
                                        }}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="Guardian's Name"
                                        aria-invalid={!!errors.guardian_name}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Guardian's NID Number:"
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
                                            target.value = filterNumericInput(target.value);
                                        }}
                                        className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                        placeholder="10 Digits/13 Digits/17 Digits"
                                        aria-invalid={!!errors.guardian_nid}
                                    />
                                </FieldRow>
                                <FieldRow
                                    label="Guardian's Mobile Number:"
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
                                            target.value = filterNumericInput(target.value);
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
                                        isRequired={!guardian_address_same_as_permanent}
                                        error={errors.guardian_upazila}
                                        tooltip="Select the upazila/thana where your guardian lives"
                                    >
                                        <select
                                            {...register("guardian_upazila")}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            disabled={!guardian_district}
                                        >
                                            <option value="">Select Upazila/Thana</option>
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
                                            onInput={(e) => {
                                                const target = e.target as HTMLInputElement;
                                                target.value = filterAddressInput(target.value);
                                            }}
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
                                                target.value = filterNumericInput(target.value).slice(0, 4);
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
                                            onInput={(e) => {
                                                const target = e.target as HTMLInputElement;
                                                target.value = filterAddressInput(target.value);
                                            }}
                                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder="Village/Road/House No"
                                        />
                                    </FieldRow>
                                </div>
                            )}
                        </>
                    )}
                </SectionHeader>
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
                            {Array.from({ length: 3 }, (_, i) =>
                                String(new Date().getFullYear() - 1 - i),
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
                                target.value = filterNumericInput(target.value).slice(0, 6);
                            }}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Roll Number"
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
                <SectionHeader title="Student Information Reference">
                    <FieldRow
                        label="বাসার নিকটবর্তী ষষ্ঠ শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:"
                        isRequired={isRequired("nearby_student_info")}
                        error={errors.nearby_student_info}
                        tooltip="Select a classmate name from the list"
                    >
                        <select
                            {...register("nearby_student_info")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            aria-invalid={!!errors.nearby_student_info}
                        >
                            <option value="">Select Name</option>
                            {settings?.resolvedClassmates && settings.resolvedClassmates.split(',').map((name: string, idx: number) => {
                                const trimmedName = name.trim();
                                return trimmedName ? (
                                    <option key={idx} value={trimmedName}>
                                        {trimmedName}
                                    </option>
                                ) : null;
                            })}
                        </select>
                    </FieldRow>
                </SectionHeader>
                <SectionHeader title="বিদ্যালয়ের ইউনিফর্ম পরিহিত ছাত্রের রঙ্গিন ছবি">
                    <FieldRow
                        label={
                            <span>
                                Photo:
                                {/* {!isEditMode && <span className="text-red-600 ml-1" aria-hidden="true">*</span>} */}
                            </span>
                        }
                        isRequired={isRequired("photo")}
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
