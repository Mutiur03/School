import React, { useEffect, useState, useMemo } from "react";
import {
    useForm,
    useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getUpazilasByDistrict } from "@/lib/location";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
    Class9Registration,
    registrationSchemaClass9,
    registrationDefaultValuesClass9,
} from "@school/shared-schemas";
import { getFileUrl } from "@/lib/backend";
import DuplicateWarning, { Duplicate } from "@/components/Form/DupliacteWarning";
import SectionHeader from "@/components/Form/SectionHeader";
import FieldRow from "@/components/Form/FieldRow";
import AddressFields from "@/components/Form/AddressFields";
import GuardianSection from "@/components/Form/GuardianSection";
import FormInput from "@/components/Form/FormInput";
import { useSchoolConfig } from "@/index";

const registrationMetadata = {
    section: {
        tooltip: "Select your বর্তমান Class 9 section",
        instruction: "ভর্তিকৃত শাখা নির্বাচন করুন"
    },
    roll: {
        tooltip: "Select your current Class 9 roll number",
        instruction: "ভর্তিকৃত রোল নম্বর নির্বাচন করুন"
    },
    student_name_bn: {
        tooltip: "Write student's name in Bangla as per JSC/JDC certificate",
        instruction: "জেএসসি/জেডিসি সনদ অনুযায়ী ছাত্রের নাম বাংলায় লিখুন"
    },
    student_name_en: {
        tooltip: "Write student's name in English (Capital Letters) as per JSC/JDC certificate",
        instruction: "Write Student's Name in English (Capital Letters) as per JSC/JDC certificate"
    },
    birth_reg_no: {
        tooltip: "Write 17-digit Birth Registration Number",
        instruction: "১৭ ডিজিটের জন্ম নিবন্ধন নম্বর লিখুন"
    },
    father_name_bn: {
        tooltip: "Write father's name in Bangla as per JSC/JDC certificate",
        instruction: "জেএসসি/জেডিসি সনদ অনুযায়ী পিতার নাম বাংলায় লিখুন"
    },
    father_name_en: {
        tooltip: "Write father's name in English (Capital Letters) as per JSC/JDC certificate",
        instruction: "Write Father's Name in English (Capital Letters) as per JSC/JDC certificate"
    },
    father_nid: {
        tooltip: "Write 10, 13 or 17 digit NID number",
        instruction: "পিতার এনআইডি নম্বর লিখুন"
    },
    mother_name_bn: {
        tooltip: "Write mother's name in Bangla as per JSC/JDC certificate",
        instruction: "জেএসসি/জেডিসি সনদ অনুযায়ী মাতার নাম বাংলায় লিখুন"
    },
    mother_name_en: {
        tooltip: "Write mother's name in English (Capital Letters) as per JSC/JDC certificate",
        instruction: "Write Mother's Name in English (Capital Letters) as per JSC/JDC certificate"
    },
    mother_nid: {
        tooltip: "Write 10, 13 or 17 digit NID number",
        instruction: "মাতার এনআইডি নম্বর লিখুন"
    },
    jsc_reg_no: {
        tooltip: "Write your JSC/JDC Registration Number",
        instruction: "জেএসসি/জেডিসি রেজিস্ট্রেশন নম্বর লিখুন"
    },
    jsc_roll_no: {
        tooltip: "Write your JSC/JDC Roll Number",
        instruction: "জেএসসি/জেডিসি রোল নম্বর লিখুন"
    },
    photo: {
        tooltip: "Upload a recent passport size photo in school uniform",
        instruction: "বিদ্যালয় ইউনিফর্ম পরিহিত রঙ্গিন ছবি আপলোড করুন (Portrait 15:19 ratio)"
    }
};

const subjectOptionsByGroup = {
    Science: {
        main: [
            {
                value: "Higher Mathematics",
                label: "উচ্চতর গণিত (Higher Mathematics) Code-126",
            },
            { value: "Biology", label: "জীববিজ্ঞান (Biology) Code-138" },
        ],
        fourth: [
            {
                value: "Higher Mathematics",
                label: "উচ্চতর গণিত (Higher Mathematics) Code-126",
            },
            { value: "Biology", label: "জীববিজ্ঞান (Biology) Code-138" },
            {
                value: "Agricultural Studies",
                label: "কৃষিশিক্ষা (Agricultural Studies) Code-134",
            },
            {
                value: "Geography & Environment",
                label: "ভূগোল ও পরিবেশ (Geography & Environment) Code-110",
            },
        ],
    },
    Humanities: {
        main: [
            { value: "Civics", label: "পৌরনীতি ও নাগরিকতা (Civics) Code-140" },
        ],
        fourth: [
            {
                value: "Agricultural Studies",
                label: "কৃষিশিক্ষা (Agricultural Studies) Code-134",
            },
        ],
    },
    "Business Studies": {
        main: [
            { value: "Accounting", label: "হিসাববিজ্ঞান (Accounting) Code-146" },
            { value: "Finance & Banking", label: "ফিন্যান্স ও ব্যাংকিং (Finance & Banking) Code-152" },
            { value: "Business Ent.", label: "ব্যবসায় উদ্যোগ (Business Ent.) Code-143" },
        ],
        fourth: [
            {
                value: "Agricultural Studies",
                label: "কৃষিশিক্ষা (Agricultural Studies) Code-134"
            },
            {
                value: "Geography & Environment",
                label: "ভূগোল ও পরিবেশ (Geography & Environment) Code-110"
            }
        ],
    },
};

const metadata = registrationMetadata;

export default function RegistrationClass9() {
    useEffect(() => {
        document.title = "Class Nine Registration Form";
    }, []);
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [permanentUpazilas, setPermanentUpazilas] = useState<any[]>([]);
    const [presentUpazilas, setPresentUpazilas] = useState<any[]>([]);
    const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [availableRolls, setAvailableRolls] = useState<string[]>([]);
    const [initialRoll, setInitialRoll] = useState<string | null>(null);
    const [initialRollApplied, setInitialRollApplied] = useState(false);
    const [initialPermanentUpazila, setInitialPermanentUpazila] = useState<string | null>(null);
    const [initialPresentUpazila, setInitialPresentUpazila] = useState<string | null>(null);
    const [initialPrevSchoolUpazila, setInitialPrevSchoolUpazila] = useState<string | null>(null);
    const [initialUpazilasApplied, setInitialUpazilasApplied] = useState(false);
    const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
    const schoolConfig = useSchoolConfig();
    const [prevSchoolOption, setPrevSchoolOption] = useState(schoolConfig.name.en);
    const [nearbyOption, setNearbyOption] = useState("");

    const nearbyOptions = useMemo(() => {
        if (!settings?.classmates) return [];
        return settings.classmates.split("\n").map((s: string) => s.trim()).filter(Boolean);
    }, [settings?.classmates]);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        clearErrors,
        reset,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<Class9Registration>({
        resolver: zodResolver(registrationSchemaClass9) as any,
        mode: "onSubmit",
        reValidateMode: "onChange",
        shouldUnregister: false,
        defaultValues: registrationDefaultValuesClass9,
    });

    const permanent_district = useWatch({ control, name: "permanent_district" });
    const permanent_upazila = useWatch({ control, name: "permanent_upazila" });
    const permanent_post_office = useWatch({ control, name: "permanent_post_office" });
    const permanent_post_code = useWatch({ control, name: "permanent_post_code" });
    const permanent_village_road = useWatch({ control, name: "permanent_village_road" });

    const present_district = useWatch({ control, name: "present_district" });
    const prev_school_district = useWatch({ control, name: "prev_school_district" });
    const birth_year = useWatch({ control, name: "birth_year" });
    const birth_month = useWatch({ control, name: "birth_month" });
    const birth_reg_no = useWatch({ control, name: "birth_reg_no" });
    const sameAsPermanent = useWatch({ control, name: "same_as_permanent" });
    const photo = useWatch({ control, name: "photo" });
    const selectedSection = useWatch({ control, name: "section" });
    const group_class_nine = useWatch({ control, name: "group_class_nine" });
    const main_subject = useWatch({ control, name: "main_subject" });
    const nearby_nine_student_info = useWatch({ control, name: "nearby_nine_student_info" });

    const permanentAddress = useMemo(() => ({
        district: permanent_district,
        upazila: permanent_upazila,
        post_office: permanent_post_office,
        post_code: permanent_post_code,
        village_road: permanent_village_road,
    }), [
        permanent_district,
        permanent_upazila,
        permanent_post_office,
        permanent_post_code,
        permanent_village_road
    ]);

    useEffect(() => {
        const initializeData = async () => {
            try {
                setLoading(true);

                const settingsRes = await axios.get("/api/reg/class-9");
                let currentSettings = null;
                if (settingsRes.data.success) {
                    if (!settingsRes.data.data.reg_open) {
                        navigate("/", { replace: true });
                        return;
                    }
                    currentSettings = settingsRes.data.data;
                    setSettings(currentSettings);
                }

                if (isEditMode && id) {
                    const response = await axios.get(`/api/reg/class-9/form/${id}`);
                    if (response.data.success) {
                        const data = response.data.data;
                        if (data.status && data.status !== "pending") {
                            navigate(`/registration/class-9/confirm/${id}`, { replace: true });
                            return;
                        }
                        const formData: any = { ...data };

                        Object.keys(formData).forEach((key) => {
                            if (formData[key] === null) {
                                formData[key] = "";
                            }
                        });
                        if (currentSettings && data.section) {
                            const rollRange = data.section === "A" ? currentSettings.a_sec_roll : currentSettings.b_sec_roll;
                            const rolls = parseRollRange(rollRange);
                            setAvailableRolls(rolls);
                        }
                        if (data.roll) {
                            setInitialRoll(data.roll);
                            setInitialRollApplied(false);
                        } else {
                            setInitialRollApplied(true);
                        }
                        if (data.permanent_district) {
                            setPermanentUpazilas(getUpazilasByDistrict(data.permanent_district));
                            setInitialPermanentUpazila(data.permanent_upazila || "");
                        }
                        if (data.present_district) {
                            setPresentUpazilas(getUpazilasByDistrict(data.present_district));
                            setInitialPresentUpazila(data.present_upazila || "");
                        }
                        if (data.prev_school_district) {
                            setPrevSchoolUpazilas(getUpazilasByDistrict(data.prev_school_district));
                            setInitialPrevSchoolUpazila(data.prev_school_upazila || "");
                        }
                        const hasDistrictsToSync = Boolean(data.permanent_district || data.present_district || data.prev_school_district);
                        setInitialUpazilasApplied(!hasDistrictsToSync);
                        reset(formData);

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
                        if (data.guardian_name && data.guardian_name.trim() !== "") {
                            setValue("guardian_is_not_father", true);
                        } else {
                            setValue("guardian_is_not_father", false);
                        }
                        if (data.photo) {
                            setPhotoPreview(getFileUrl(data.photo));
                        }
                    } else {
                        navigate("/reg/class-9", { replace: true });
                    }
                } else {
                    // Pre-populate default school for new registration
                    setValue("prev_school_name", schoolConfig.name.en, { shouldValidate: true });
                    setValue("prev_school_district", schoolConfig.contact.district, { shouldValidate: true });
                }
            } catch (error) {
                console.error("Failed to initialize data:", error);
                navigate("/", { replace: true });
            } finally {
                setLoading(false);
            }
        };

        initializeData();
    }, [isEditMode, id, navigate, reset, setValue]);

    const prev_school_name = useWatch({ control, name: "prev_school_name" });

    useEffect(() => {
        if (prev_school_name === schoolConfig.name.en) {
            setPrevSchoolOption(schoolConfig.name.en);
        } else if (prev_school_name && prev_school_name !== "") {
            setPrevSchoolOption("Others");
        }
    }, [prev_school_name, schoolConfig.name.en]);

    useEffect(() => {
        if (nearby_nine_student_info && nearbyOptions.includes(nearby_nine_student_info)) {
            setNearbyOption(nearby_nine_student_info);
        } else if (nearby_nine_student_info && nearby_nine_student_info !== "") {
            setNearbyOption("Others");
        } else {
            setNearbyOption("");
        }
    }, [nearby_nine_student_info, nearbyOptions]);

    const handleNearbyOptionChange = (value: string) => {
        setNearbyOption(value);
        if (value !== "Others" && value !== "") {
            setValue("nearby_nine_student_info", value, { shouldValidate: true });
        } else if (value === "") {
            setValue("nearby_nine_student_info", "");
        }
    };

    const handlePrevSchoolOptionChange = (value: string) => {
        setPrevSchoolOption(value);
        if (value === schoolConfig.name.en) {
            setValue("prev_school_name", schoolConfig.name.en, { shouldValidate: true });
            setValue("prev_school_district", schoolConfig.contact.district, { shouldValidate: true });
        } else if (value === "Others") {
            setValue("prev_school_name", "");
            setValue("prev_school_district", "");
            setValue("prev_school_upazila", "");
        }
    };


    const parseRollRange = (rollRange: string | null): string[] => {
        if (!rollRange) return [];
        const rolls: Set<number> = new Set();
        const parts = rollRange.split(',').map(p => p.trim());
        for (const part of parts) {
            const rangeMatch = part.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                for (let i = start; i <= end; i++) {
                    rolls.add(i);
                }
            } else {
                const num = parseInt(part);
                if (!isNaN(num)) {
                    rolls.add(num);
                }
            }
        }
        return Array.from(rolls)
            .sort((a, b) => a - b)
            .map(num => String(num).padStart(2, "0"));
    };

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

    const paddedInitialRoll = useMemo(() => {
        if (!initialRoll) return null;
        const num = parseInt(initialRoll);
        return isNaN(num) ? initialRoll : String(num).padStart(2, "0");
    }, [initialRoll]);

    useEffect(() => {
        if (availableRolls.length > 0 && paddedInitialRoll && !initialRollApplied) {
            const timer = setTimeout(() => {
                setValue("roll", paddedInitialRoll, { shouldValidate: true });
                setInitialRollApplied(true);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [availableRolls, paddedInitialRoll, initialRollApplied, setValue]);

    useEffect(() => {
        if (!isEditMode || initialUpazilasApplied) return;
        const hasOptions = permanentUpazilas.length > 0 || presentUpazilas.length > 0 || prevSchoolUpazilas.length > 0;
        if (hasOptions) {
            const timer = setTimeout(() => {
                if (initialPermanentUpazila) setValue("permanent_upazila", initialPermanentUpazila, { shouldValidate: true });
                if (initialPresentUpazila) setValue("present_upazila", initialPresentUpazila, { shouldValidate: true });
                if (initialPrevSchoolUpazila) setValue("prev_school_upazila", initialPrevSchoolUpazila, { shouldValidate: true });
                setInitialUpazilasApplied(true);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [permanentUpazilas, presentUpazilas, prevSchoolUpazilas, initialPermanentUpazila, initialPresentUpazila, initialPrevSchoolUpazila, initialUpazilasApplied, isEditMode, setValue]);

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
        if (sameAsPermanent) {
            setValue("present_district", permanent_district);
            setValue("present_upazila", permanent_upazila);
            setValue("present_post_office", permanent_post_office);
            setValue("present_post_code", permanent_post_code);
            setValue("present_village_road", permanent_village_road);
        }
    }, [
        sameAsPermanent,
        permanent_district,
        permanent_upazila,
        permanent_post_office,
        permanent_post_code,
        permanent_village_road,
        setValue
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

    useEffect(() => {
        // If default school is selected and district matches, auto-fill upazila when options are available
        if (prevSchoolOption === schoolConfig.name.en &&
            prev_school_district === schoolConfig.contact.district &&
            prevSchoolUpazilas.length > 0) {

            const currentUpazila = getValues("prev_school_upazila");
            if (!currentUpazila || currentUpazila === "") {
                const targetUpazila = schoolConfig.contact.upazila;
                const exists = prevSchoolUpazilas.some(u => u.id === targetUpazila);
                if (exists) {
                    setValue("prev_school_upazila", targetUpazila, { shouldValidate: true });
                }
            }
        }
    }, [prevSchoolUpazilas, prev_school_district, prevSchoolOption, schoolConfig, setValue, getValues]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert("File is too large! Maximum allowed size is 2MB.");
                e.target.value = "";
                return;
            }

            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const width = img.width;
                const height = img.height;
                const ratio = width / height;
                const targetRatio = 15 / 19;

                // Allow a small tolerance (5%)
                const tolerance = 0.05;
                if (Math.abs(ratio - targetRatio) > tolerance) {
                    alert("Image aspect ratio MUST be 15:19 (Portrait). Please resize your image.");
                    e.target.value = "";
                    return;
                }

                setValue("photo", file, { shouldValidate: true });
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPhotoPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            };
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
    }, [birth_reg_no, birth_year, setValue]);

    const onSubmit = async (data: Class9Registration) => {
        setDuplicates([]);
        try {
            let photo = "";
            if (data.photo instanceof File) {
                const { data: uploadData } = await axios.post("/api/reg/class-9/form/upload-url", {
                    filename: data.photo.name,
                    filetype: data.photo.type,
                    name: data.student_name_en,
                    roll: data.roll,
                    section: data.section,
                    year: data.birth_year
                });
                if (uploadData.success) {
                    await axios.put(uploadData.data.uploadUrl, data.photo, {
                        headers: { "Content-Type": data.photo.type },
                    });
                    photo = uploadData.data.key;
                }
            } else if (typeof data.photo === "string") {
                photo = data.photo;
            }
            const submissionData = {
                ...data,
                photo,
                ssc_batch: data.ssc_batch || settings?.ssc_year?.toString() || "",
            };
            const endpoint = isEditMode ? `/api/reg/class-9/form/${id}` : "/api/reg/class-9/form";
            const method = isEditMode ? "put" : "post";
            const response = await axios[method](endpoint, submissionData);
            if (response.data.success) {
                navigate(`/registration/class-9/confirm/${response.data.data.id}`);
            }
        } catch (error: any) {
            console.error("Submission error", error);
            if (error.response && error.response.status === 400 && error.response.data.duplicates) {
                setDuplicates(error.response.data.duplicates);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert(error.response?.data?.message || "Failed to submit registration. Please try again.");
            }
        }
    };

    const scrollToFirstError = (errors: any) => {
        if (!errors) return;
        const firstKey = Object.keys(errors)[0];
        if (!firstKey) return;
        let el = document.querySelector(`[name="${firstKey}"]`) as HTMLElement | null;
        if (!el) el = document.getElementById(firstKey) as HTMLElement | null;
        if (!el) {
            el = document.querySelector(`[data-field="${firstKey}"]`) as HTMLElement | null;
        }
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            try { (el as HTMLElement).focus(); } catch { }
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const isRequired = () => true;

    if (loading || !settings || (isEditMode && (!initialRollApplied || !initialUpazilasApplied))) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md">
                <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24">
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-100 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div className="mt-6 text-xl font-bold text-gray-800 tracking-tight">
                        Preparing Class 9 Form
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
                        ? `Student's Information for Registration of SSC Exam ${settings?.ssc_year} (Edit)`
                        : `Student's Information for Registration of SSC Exam ${settings?.ssc_year}`}
                </h2>
                <span className="text-xs sm:text-sm text-gray-600 text-center px-2">
                    Please fill all required fields. Fields marked{" "}
                    <span className="text-red-600">*</span> are mandatory.
                </span>
            </div>

            {duplicates.length > 0 && <DuplicateWarning duplicates={duplicates} />}

            <form onSubmit={handleSubmit(onSubmit, (errors) => {
                scrollToFirstError(errors);
            })} className="space-y-10">
                <SectionHeader title="Personal Information" >
                    <FieldRow
                        label="Section"
                        isRequired
                        error={errors.section}
                        tooltip={metadata.section.tooltip}
                        instruction={metadata.section.instruction}
                    >
                        <select {...register("section")} className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="">Select Section</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                        </select>
                    </FieldRow>
                    <FieldRow
                        label="Roll"
                        isRequired
                        error={errors.roll}
                        tooltip={metadata.roll.tooltip}
                        instruction={metadata.roll.instruction}
                    >
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
                        isRequired
                        error={errors.religion}
                    >
                        <select
                            {...register("religion")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="">Select Religion</option>
                            <option value="Islam">Islam</option>
                            <option value="Hinduism">Hinduism</option>
                            <option value="Christianity">Christianity</option>
                            <option value="Buddhism">Buddhism</option>
                        </select>
                    </FieldRow>
                    <FormInput
                        label="ছাত্রের নাম (বাংলায়)"
                        name="student_name_bn"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="bangla"
                        placeholder="ছাত্রের নাম (বাংলায়)"
                        tooltip={metadata.student_name_bn.tooltip}
                        instruction={metadata.student_name_bn.instruction}
                    />
                    <FormInput
                        label="ডাকনাম (এক শব্দে/বাংলায়)"
                        name="student_nick_name_bn"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="bangla"
                        placeholder="ডাকনাম (বাংলায়)"
                    />
                    <FormInput
                        label="Student's Name (in English) (Capital Letters)"
                        name="student_name_en"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="english"
                        placeholder="Student Name (in English)"
                        tooltip={metadata.student_name_en.tooltip}
                        instruction={metadata.student_name_en.instruction}
                    />
                    <FormInput
                        label="Birth Registration No"
                        name="birth_reg_no"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="numeric"
                        maxLength={17}
                        placeholder="17 Digits"
                        tooltip={metadata.birth_reg_no.tooltip}
                        instruction={metadata.birth_reg_no.instruction}
                    />

                    <FieldRow
                        label="Date of Birth:"
                        isRequired
                        error={errors.birth_year || errors.birth_month || errors.birth_day}
                    >
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <input
                                type="text"
                                {...register("birth_year")}
                                maxLength={4}
                                readOnly
                                disabled
                                className="border rounded px-3 py-2 bg-gray-100 w-full sm:w-32 text-sm sm:text-base"
                                placeholder="Year"
                            />

                            <select
                                {...register("birth_month")}
                                className="border rounded px-3 py-2 w-full sm:w-40 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                disabled={disableMonth || !birth_year}
                            >
                                <option value="">Month</option>
                                {monthOptions.map((month) => (
                                    <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>
                                ))}
                            </select>
                            <select
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
                    <FormInput
                        label="পিতার নাম (বাংলায়)"
                        name="father_name_bn"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="bangla"
                        placeholder="পিতার নাম (বাংলায়)"
                        tooltip={metadata.father_name_bn.tooltip}
                        instruction={metadata.father_name_bn.instruction}
                    />
                    <FormInput
                        label="Father's Name (in English) (Capital Letters)"
                        name="father_name_en"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="english"
                        placeholder="Father's Name (in English)"
                        tooltip={metadata.father_name_en.tooltip}
                        instruction={metadata.father_name_en.instruction}
                    />
                    <FormInput
                        label="Father's NID Number"
                        name="father_nid"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="numeric"
                        maxLength={17}
                        placeholder="10 Digits/13 Digits/17 Digits"
                        tooltip={metadata.father_nid.tooltip}
                        instruction={metadata.father_nid.instruction}
                    />
                    <FormInput
                        label="Father's Mobile Number"
                        name="father_phone"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="numeric"
                        maxLength={11}
                        placeholder="01XXXXXXXXX"
                    />
                    <FormInput
                        label="মাতার নাম (বাংলায়)"
                        name="mother_name_bn"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="bangla"
                        placeholder="মাতার নাম (বাংলায়)"
                        tooltip={metadata.mother_name_bn.tooltip}
                        instruction={metadata.mother_name_bn.instruction}
                    />
                    <FormInput
                        label="Mother's Name (in English) (Capital Letters)"
                        name="mother_name_en"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="english"
                        placeholder="Mother's Name (in English)"
                        tooltip={metadata.mother_name_en.tooltip}
                        instruction={metadata.mother_name_en.instruction}
                    />
                    <FormInput
                        label="Mother's NID Number"
                        name="mother_nid"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="numeric"
                        maxLength={17}
                        placeholder="10 Digits/13 Digits/17 Digits"
                        tooltip={metadata.mother_nid.tooltip}
                        instruction={metadata.mother_nid.instruction}
                    />
                    <FormInput
                        label="Mother's Mobile Number"
                        name="mother_phone"
                        register={register}
                        errors={errors}
                        isRequired
                        filterType="numeric"
                        maxLength={11}
                        placeholder="01XXXXXXXXX"
                    />
                    <FieldRow
                        label="Blood Group:"
                        isRequired
                        error={errors.blood_group}
                    >
                        <select
                            {...register("blood_group")}
                            className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="">Select Blood Group</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                        </select>
                    </FieldRow>
                    <FormInput
                        label="Email"
                        name="email"
                        register={register}
                        errors={errors}
                        isRequired={false}
                        placeholder="example@email.com"
                    />
                </SectionHeader>
                <SectionHeader title="Address Information">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">
                        Permanent Address:
                    </h4>
                    <AddressFields
                        prefix="permanent"
                        register={register}
                        setValue={setValue}
                        errors={errors}
                        upazilas={permanentUpazilas}
                        districtValue={permanent_district}
                        isRequired={isRequired}
                    />

                    <div className="my-4 flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={sameAsPermanent}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setValue("same_as_permanent", checked);
                                if (!checked) {
                                    const fields = ["present_district", "present_upazila", "present_post_office", "present_post_code", "present_village_road"];
                                    fields.forEach(f => {
                                        setValue(f as any, "");
                                        clearErrors(f as any);
                                    });
                                }
                            }}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm">Same as Permanent Address</span>
                    </div>
                    {!sameAsPermanent && (
                        <div className="space-y-2 mt-4">
                            <h4 className="font-semibold mb-2 text-sm sm:text-base">
                                Present Address:
                            </h4>
                            <AddressFields
                                prefix="present"
                                register={register}
                                setValue={setValue}
                                errors={errors}
                                upazilas={presentUpazilas}
                                districtValue={present_district}
                                isRequired={isRequired}
                            />
                        </div>
                    )}
                </SectionHeader>
                <GuardianSection
                    register={register}
                    errors={errors}
                    control={control}
                    setValue={setValue}
                    isRequired={isRequired}
                    permanentAddress={permanentAddress}
                    metadata={metadata}
                />

                <SectionHeader title="Previous School Information">
                    <FieldRow
                        label="Name of Previous School :"
                        isRequired
                        error={errors.prev_school_name}
                    >
                        <div className="space-y-3">
                            <select
                                value={prevSchoolOption}
                                onChange={(e) => handlePrevSchoolOptionChange(e.target.value)}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value={schoolConfig.name.en}>
                                    {schoolConfig.name.en}
                                </option>
                                <option value="Others">Others</option>
                            </select>

                            {prevSchoolOption === "Others" && (
                                <input
                                    {...register("prev_school_name")}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="Enter the name of your previous school"
                                />
                            )}
                        </div>
                    </FieldRow>

                    <AddressFields
                        prefix="prev_school"
                        register={register}
                        setValue={setValue}
                        errors={errors}
                        upazilas={prevSchoolUpazilas}
                        districtValue={prev_school_district}
                        isRequired={isRequired}
                        showPostFields={false}
                    />
                </SectionHeader>

                <SectionHeader title="JSC/JDC Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow
                            label="Section in Class Eight:"
                            isRequired
                            error={errors.section_in_class_8}
                        >
                            <select
                                {...register("section_in_class_8")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Section</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="No Section">No Section</option>
                            </select>
                        </FieldRow>
                        <FormInput
                            label="Roll in Class Eight"
                            name="roll_in_class_8"
                            register={register}
                            errors={errors}
                            isRequired
                            filterType="numeric"
                            placeholder="Roll in Class 8"
                        />
                        <FieldRow
                            label="JSC/JDC Passing Year:"
                            isRequired
                            error={errors.jsc_passing_year}
                        >
                            <select
                                {...register("jsc_passing_year")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Year</option>
                                {Array.from({ length: 5 }, (_, i) =>
                                    String(new Date().getFullYear() - i - 1),
                                ).map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="JSC/JDC Board:"
                            isRequired
                            error={errors.jsc_board}
                        >
                            <select
                                {...register("jsc_board")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Board</option>
                                <option value="Rajshahi">Rajshahi</option>
                                <option value="Dhaka">Dhaka</option>
                                <option value="Cumilla">Cumilla</option>
                                <option value="Chattogram">Chattogram</option>
                                <option value="Barishal">Barishal</option>
                                <option value="Sylhet">Sylhet</option>
                                <option value="Dinajpur">Dinajpur</option>
                                <option value="Jashore">Jashore</option>
                                <option value="Mymensingh">Mymensingh</option>
                                <option value="Madrasah">Madrasah</option>
                            </select>
                        </FieldRow>
                        <FormInput
                            label="JSC/JDC Registration Number"
                            name="jsc_reg_no"
                            register={register}
                            errors={errors}
                            isRequired={false}
                            filterType="numeric"
                            maxLength={10}
                            placeholder="10 Digits"
                            tooltip={metadata.jsc_reg_no.tooltip}
                            instruction={metadata.jsc_reg_no.instruction}
                        />
                        <FormInput
                            label="JSC/JDC Roll Number"
                            name="jsc_roll_no"
                            register={register}
                            errors={errors}
                            isRequired={false}
                            filterType="numeric"
                            maxLength={6}
                            placeholder="6 Digits"
                            tooltip={metadata.jsc_roll_no.tooltip}
                            instruction={metadata.jsc_roll_no.instruction}
                        />
                    </div>
                </SectionHeader>

                <SectionHeader title="Class 9 Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow
                            label="Group:"
                            isRequired
                            error={errors.group_class_nine}
                        >
                            <select
                                {...register("group_class_nine")}
                                onChange={(e) => {
                                    register("group_class_nine").onChange(e);
                                    setValue("main_subject", "");
                                    setValue("fourth_subject", "");
                                }}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Group</option>
                                <option value="Science">Science</option>
                                <option value="Humanities">Humanities</option>
                                <option value="Business Studies">Business Studies</option>
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="Main Subject:"
                            isRequired
                            error={errors.main_subject}
                            tooltip="Select your main subject based on your class nine group. Options will appear after selecting group"
                        >
                            <select
                                {...register("main_subject")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                disabled={!group_class_nine}
                            >
                                <option value="">Select Main Subject</option>
                                {group_class_nine &&
                                    subjectOptionsByGroup[
                                        group_class_nine as keyof typeof subjectOptionsByGroup
                                    ]?.main.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="4th Subject:"
                            isRequired
                            error={errors.fourth_subject}
                            tooltip="Select your 4th subject. Options will appear based on your group and exclude your main subject"
                        >
                            <select
                                {...register("fourth_subject")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                disabled={!group_class_nine}
                            >
                                <option value="">Select 4th Subject</option>
                                {group_class_nine &&
                                    subjectOptionsByGroup[
                                        group_class_nine as keyof typeof subjectOptionsByGroup
                                    ]?.fourth
                                        .filter((opt) => opt.value !== main_subject)
                                        .map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য (Reference Student Info):"
                            isRequired
                            error={errors.nearby_nine_student_info}
                        >
                            <div className="space-y-3">
                                <select
                                    value={nearbyOption}
                                    onChange={(e) => handleNearbyOptionChange(e.target.value)}
                                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                                >
                                    <option value="">Select Student</option>
                                    {nearbyOptions.map((opt: string) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </FieldRow>
                        <FieldRow
                            label="উপবৃত্তি পায় কিনা (Stipend Status):"
                            isRequired
                            error={errors.upobritti}
                        >
                            <select
                                {...register("upobritti")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Option</option>
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="সরকারি বৃত্তি পায় কিনা (Govt Scholarship Status):"
                            isRequired
                            error={errors.sorkari_brirti}
                        >
                            <select
                                {...register("sorkari_brirti")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Option</option>
                                <option value="No">No</option>
                                <option value="Talentpool">Talentpool</option>
                                <option value="General">General</option>
                            </select>
                        </FieldRow>
                        <FieldRow
                            label="কাব স্কাউট/স্কাউট (Scout Status):"
                            isRequired
                            error={errors.scout_status}
                        >
                            <select
                                {...register("scout_status")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Select Option</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </FieldRow>
                    </div>
                </SectionHeader>

                <SectionHeader title="বিদ্যালয়ের ইউনিফর্ম পরিহিত ছাত্রের রঙ্গিন ছবি">
                    <FieldRow
                        label="Photo:"
                        isRequired
                        error={errors.photo as any}
                        tooltip={metadata.photo.tooltip}
                        instruction={metadata.photo.instruction}
                    >
                        <div className="flex flex-col lg:flex-row items-start gap-4">
                            <div className="shrink-0">
                                <div
                                    className="relative border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 bg-gray-50 overflow-hidden"
                                    style={{ width: '150px', height: '190px' }}
                                >
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
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 cursor-pointer text-sm sm:text-base font-medium"
                                    >
                                        {photoPreview ? "Change Photo" : "Choose Photo"}
                                    </label>
                                    <a
                                        href="https://imageresizer.com/crop-image"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white! rounded shadow hover:bg-green-700 text-sm sm:text-base font-medium"
                                    >
                                        Resize Now (15:19)
                                    </a>
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
                                <p className="text-xs text-gray-500 mt-2">
                                    JPG only. Max 2MB. <strong>Requirement: 15:19 Ratio.</strong>
                                </p>
                            </div>
                        </div>
                    </FieldRow>
                </SectionHeader>



                <div className="pt-10 border-t-2 border-gray-100 flex justify-center">
                    <button
                        type="submit"
                        disabled={loading || isSubmitting}
                        className={`px-12 py-4 rounded-xl text-xl font-bold text-white shadow-2xl transition-all
              ${loading || isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
                    >
                        {loading || isSubmitting ? "Submitting..." : isEditMode ? "Update Registration" : "Submit Registration"}
                    </button>
                </div>
            </form>
        </div>
    );
}
