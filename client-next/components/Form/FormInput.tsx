import React from "react";
import FieldRow from "./FieldRow";
import { UseFormRegister } from "react-hook-form";
import {
    filterEnglishInput,
    filterBanglaInput,
    filterNumericInput,
    filterAddressInput,
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
    autoComplete?: string;
}

function inferAutoComplete(name: string, type: string): string | undefined {
    if (type === "email" || /email/i.test(name)) return "email";
    if (/phone|mobile|whatsapp|tel/i.test(name)) return "tel";
    if (/father.*name|mother.*name|student_name|name_en|name_bn/i.test(name)) return "name";
    return "off";
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
    autoComplete,
}) => {
    const filterMap = {
        english: filterEnglishInput,
        bangla: filterBanglaInput,
        numeric: filterNumericInput,
        address: filterAddressInput,
    };

    const resolvedAutoComplete = autoComplete ?? inferAutoComplete(name, type);
    const disableSpellcheck =
        type === "email" ||
        filterType === "numeric" ||
        /nid|birth_reg|email|phone|code|id/i.test(name);

    return (
        <FieldRow
            label={label}
            htmlFor={name}
            isRequired={isRequired}
            error={errors[name]}
            tooltip={tooltip}
            instruction={instruction}
        >
            <input
                id={name}
                {...register(name)}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={maxLength}
                inputMode={inputMode}
                autoComplete={resolvedAutoComplete}
                spellCheck={disableSpellcheck ? false : undefined}
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
                className={`w-full border p-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 transition-[border-color,box-shadow] ${className} ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
            />
        </FieldRow>
    );
};

export default FormInput;
