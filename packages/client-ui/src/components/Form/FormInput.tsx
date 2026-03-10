import React from "react";
import FieldRow from "./FieldRow";
import { UseFormRegister } from "react-hook-form";
import {
    filterEnglishInput,
    filterBanglaInput,
    filterNumericInput,
    filterAddressInput
} from "@school/shared-schemas";

interface FormInputProps {
    label: string | React.ReactNode;
    name: string;
    register: UseFormRegister<any>;
    errors: any;
    isRequired: boolean;
    instruction?: string | React.ReactNode;
    tooltip?: string;
    placeholder?: string;
    type?: string;
    filterType?: "english" | "bangla" | "numeric" | "address";
    maxLength?: number;
    className?: string;
    inputMode?: "text" | "numeric" | "tel" | "search" | "email" | "url" | "decimal" | "none";
    disabled?: boolean;
    readOnly?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
    label,
    name,
    register,
    errors,
    isRequired,
    instruction,
    tooltip,
    placeholder,
    type = "text",
    filterType,
    maxLength,
    className = "",
    inputMode,
    disabled = false,
    readOnly = false,
}) => {
    const filterMap = {
        english: filterEnglishInput,
        bangla: filterBanglaInput,
        numeric: filterNumericInput,
        address: filterAddressInput,
    };

    return (
        <FieldRow
            label={label}
            isRequired={isRequired}
            error={errors[name]}
            tooltip={tooltip}
            instruction={instruction}
        >
            <input
                {...register(name)}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={maxLength}
                inputMode={inputMode}
                onInput={(e) => {
                    if (filterType && filterMap[filterType]) {
                        const target = e.target as HTMLInputElement;
                        let val = filterMap[filterType](target.value);
                        if (maxLength) {
                            val = val.slice(0, maxLength);
                        }
                        target.value = val;
                    }
                }}
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:outline-none transition ${className} ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
            />
        </FieldRow>
    );
};

export default FormInput;
