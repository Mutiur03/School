import React from "react";
import { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { districts } from "@/lib/location";
import FieldRow from "./FieldRow";
import FormInput from "./FormInput";

interface AddressFieldsProps {
    /** Field name prefix: "permanent" | "present" | "guardian" | "prev_school" */
    prefix: string;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    errors: any;
    upazilas: any[];
    districtValue: string;
    isRequired: (name: string) => boolean;
    /** Whether to show post office / post code / village fields (default: true) */
    showPostFields?: boolean;
    disabled?: boolean;
    districtTooltip?: string;
    districtInstruction?: string | React.ReactNode;
    upazilaTooltip?: string;
    upazilaInstruction?: string | React.ReactNode;
    postOfficeTooltip?: string;
    postOfficeInstruction?: string | React.ReactNode;
    postCodeTooltip?: string;
    postCodeInstruction?: string | React.ReactNode;
    villageTooltip?: string;
    villageInstruction?: string | React.ReactNode;
}

/**
 * Reusable address block: district, upazila, post office, post code, village/road.
 * All field names are derived from the `prefix` prop (e.g. "permanent" → "permanent_district").
 */
const AddressFields: React.FC<AddressFieldsProps> = ({
    prefix,
    register,
    setValue,
    errors,
    upazilas,
    districtValue,
    isRequired,
    showPostFields = true,
    disabled = false,
    districtTooltip,
    districtInstruction,
    upazilaTooltip,
    upazilaInstruction,
    postOfficeTooltip,
    postOfficeInstruction,
    postCodeTooltip,
    postCodeInstruction,
    villageTooltip,
    villageInstruction,
}) => {
    const f = (field: string) => `${prefix}_${field}`;

    return (
        <div className="space-y-2">
            <FieldRow
                label="District:"
                isRequired={isRequired(f("district"))}
                error={errors[f("district")]}
                tooltip={districtTooltip}
                instruction={districtInstruction}
            >
                <select
                    id={f("district")}
                    {...register(f("district"), {
                        onChange: () => {
                            setValue(f("upazila"), "");
                        },
                    })}
                    disabled={disabled}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                isRequired={isRequired(f("upazila"))}
                error={errors[f("upazila")]}
                tooltip={upazilaTooltip}
                instruction={upazilaInstruction}
            >
                <select
                    id={f("upazila")}
                    {...register(f("upazila"))}
                    disabled={disabled || !districtValue}
                    className="block w-full border rounded px-3 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    <option value="">Select Upazila/Thana</option>
                    {upazilas.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                    ))}
                </select>
            </FieldRow>

            {showPostFields && (
                <>
                    <FormInput
                        label="Post Office:"
                        name={f("post_office")}
                        register={register}
                        errors={errors}
                        isRequired={isRequired(f("post_office"))}
                        tooltip={postOfficeTooltip}
                        instruction={postOfficeInstruction}
                        filterType="address"
                        placeholder="Post Office Name"
                        disabled={disabled}
                    />

                    <FormInput
                        label="Post Code:"
                        name={f("post_code")}
                        register={register}
                        errors={errors}
                        isRequired={isRequired(f("post_code"))}
                        tooltip={postCodeTooltip}
                        instruction={postCodeInstruction}
                        filterType="numeric"
                        maxLength={4}
                        placeholder="1234"
                        inputMode="numeric"
                        disabled={disabled}
                    />

                    <FormInput
                        label="Village/Road/House No:"
                        name={f("village_road")}
                        register={register}
                        errors={errors}
                        isRequired={isRequired(f("village_road"))}
                        tooltip={villageTooltip}
                        instruction={villageInstruction}
                        filterType="address"
                        placeholder="Village/Road/House No"
                        disabled={disabled}
                    />
                </>
            )}
        </div>
    );
};

export default AddressFields;
