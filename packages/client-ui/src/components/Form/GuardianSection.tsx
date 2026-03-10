import React, { useEffect, useState } from "react";
import { Control, useWatch, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { getUpazilasByDistrict } from "@/lib/location";
import { guardianRelations } from "@/lib/guardian";
import SectionHeader from "./SectionHeader";
import FieldRow from "./FieldRow";
import FormInput from "./FormInput";
import AddressFields from "./AddressFields";

interface GuardianSectionProps {
    register: UseFormRegister<any>;
    errors: any;
    control: Control<any>;
    setValue: UseFormSetValue<any>;
    isRequired: (name: string) => boolean;
    permanentAddress: {
        district?: string;
        upazila?: string;
        post_office?: string;
        post_code?: string;
        village_road?: string;
    };
}

const GuardianSection: React.FC<GuardianSectionProps> = ({
    register,
    errors,
    control,
    setValue,
    isRequired,
    permanentAddress,
}) => {
    const [guardianUpazilas, setGuardianUpazilas] = useState<any[]>([]);
    const [initialUpazila, setInitialUpazila] = useState<string | null>(null);
    const [initialApplied, setInitialApplied] = useState(false);

    const guardian_is_not_father = useWatch({ control, name: "guardian_is_not_father" });
    const guardian_address_same_as_permanent = useWatch({ control, name: "guardian_address_same_as_permanent" });
    const guardian_district = useWatch({ control, name: "guardian_district" });

    useEffect(() => {
        if (!guardian_is_not_father) {
            setGuardianUpazilas([]);
            setInitialUpazila(null);
            setInitialApplied(false);
            return;
        }
        const selectedDistrictId = guardian_address_same_as_permanent
            ? permanentAddress.district
            : guardian_district;
        if (!selectedDistrictId) {
            setGuardianUpazilas([]);
            return;
        }
        const upazilas = getUpazilasByDistrict(selectedDistrictId);
        setGuardianUpazilas(upazilas);
    }, [
        guardian_is_not_father,
        guardian_address_same_as_permanent,
        permanentAddress.district,
        guardian_district,
    ]);

    // Initial value capture
    const currentUpazila = useWatch({ control, name: "guardian_upazila" });
    useEffect(() => {
        if (currentUpazila && !initialUpazila && !initialApplied) {
            setInitialUpazila(currentUpazila);
        }
    }, [currentUpazila, initialUpazila, initialApplied]);

    // Synchronization effect
    useEffect(() => {
        if (guardianUpazilas.length > 0 && initialUpazila && !initialApplied) {
            const timer = setTimeout(() => {
                setValue("guardian_upazila", initialUpazila, { shouldValidate: true });
                setInitialApplied(true);
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [guardianUpazilas, initialUpazila, initialApplied, setValue]);


    useEffect(() => {
        if (guardian_address_same_as_permanent && guardian_is_not_father) {
            setValue("guardian_district", permanentAddress.district);
            setValue("guardian_upazila", permanentAddress.upazila);
            setValue("guardian_post_office", permanentAddress.post_office);
            setValue("guardian_post_code", permanentAddress.post_code);
            setValue("guardian_village_road", permanentAddress.village_road);
        }
    }, [
        guardian_address_same_as_permanent,
        guardian_is_not_father,
        permanentAddress.district,
        permanentAddress.upazila,
        permanentAddress.post_office,
        permanentAddress.post_code,
        permanentAddress.village_road,
        setValue
    ]);

    return (
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
                        {...register("guardian_is_not_father", {
                            onChange: (e) => {
                                if (!e.target.checked) {
                                    const fields = [
                                        "guardian_name", "guardian_phone", "guardian_relation", "guardian_nid",
                                        "guardian_address_same_as_permanent", "guardian_district", "guardian_upazila",
                                        "guardian_post_office", "guardian_post_code", "guardian_village_road"
                                    ];
                                    fields.forEach(field => setValue(field as any, field === "guardian_address_same_as_permanent" ? false : ""));
                                }
                            }
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
                        <FormInput
                            label="Guardian's Name:"
                            name="guardian_name"
                            register={register}
                            errors={errors}
                            isRequired={isRequired("guardian_name")}
                            tooltip="Enter the full name of your guardian in English"
                            filterType="english"
                            placeholder="Guardian's Name"
                        />

                        <FormInput
                            label="Guardian's NID Number:"
                            name="guardian_nid"
                            register={register}
                            errors={errors}
                            isRequired={isRequired("guardian_nid")}
                            tooltip="Enter guardian's National ID number (10-17 digits)"
                            filterType="numeric"
                            maxLength={17}
                            placeholder="10 Digits/13 Digits/17 Digits"
                            inputMode="numeric"
                        />

                        <FormInput
                            label="Guardian's Mobile Number:"
                            name="guardian_phone"
                            register={register}
                            errors={errors}
                            isRequired={isRequired("guardian_phone")}
                            tooltip="Enter guardian's mobile number in 11-digit format"
                            filterType="numeric"
                            maxLength={11}
                            placeholder="01XXXXXXXXX"
                            inputMode="numeric"
                        />

                        <FieldRow
                            label="Relationship with Guardian:"
                            isRequired={isRequired("guardian_relation")}
                            error={errors.guardian_relation}
                            tooltip="Select your relationship with the guardian from the dropdown"
                        >
                            <select
                                {...register("guardian_relation")}
                                className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                            >
                                <option value="">Select Relationship / সম্পর্ক নির্বাচন করুন</option>
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
                                {...register("guardian_address_same_as_permanent", {
                                    onChange: (e) => {
                                        if (!e.target.checked) {
                                            const fields = ["guardian_district", "guardian_upazila", "guardian_post_office", "guardian_post_code", "guardian_village_road"];
                                            fields.forEach(f => setValue(f as any, ""));
                                        }
                                    }
                                })}
                                className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm">Same as Permanent Address</span>
                        </label>
                    </FieldRow>

                    {!guardian_address_same_as_permanent && (
                        <AddressFields
                            prefix="guardian"
                            register={register}
                            errors={errors}
                            upazilas={guardianUpazilas}
                            districtValue={guardian_district}
                            isRequired={isRequired}
                        />
                    )}
                </>
            )}
        </SectionHeader>
    );
};

export default GuardianSection;
