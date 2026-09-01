import React from 'react';
import FieldRow from './FieldRow';
import { UseFormRegister } from 'react-hook-form';
import {
  filterEnglishInput,
  filterBanglaInput,
  filterNumericInput,
  filterAddressInput,
  sentenceCaseAddressInput,
} from '@school/shared-schemas';

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
  filterType?: 'english' | 'bangla' | 'numeric' | 'address';
  sentenceCase?: boolean;
  maxLength?: number;
  className?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'decimal' | 'none';
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
}

function inferAutoComplete(name: string, type: string): string | undefined {
  if (/father.*name|mother.*name|student_name|name_en|name_bn/i.test(name)) return 'name';
  return 'off';
}

function isEnglishRegistrationName(name: string) {
  return /^(student|father|mother)_name_en$/.test(name);
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
  type = 'text',
  filterType,
  sentenceCase = false,
  maxLength,
  className = '',
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
  const uppercaseEnglishName = filterType === 'english' && isEnglishRegistrationName(name);
  const applySentenceCase = sentenceCase || filterType === 'address';
  const normalizeValue = (value: string) => {
    const filtered = filterType && filterMap[filterType] ? filterMap[filterType](value) : value;
    let normalized = applySentenceCase ? sentenceCaseAddressInput(filtered) : filtered;
    if (uppercaseEnglishName) normalized = normalized.toUpperCase();
    return maxLength ? normalized.slice(0, maxLength) : normalized;
  };

  const registration = register(name, {
    setValueAs: (value) => {
      const raw = typeof value === 'string' ? value : '';
      return normalizeValue(raw);
    },
  });
  const resolvedAutoComplete = autoComplete ?? inferAutoComplete(name, type);
  const disableSpellcheck =
    type === 'email' || filterType === 'numeric' || /nid|birth_reg|email|phone|code|id/i.test(name);

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
        {...registration}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={resolvedAutoComplete}
        spellCheck={disableSpellcheck ? false : undefined}
        onInput={(e) => {
          if (!filterType && !applySentenceCase) return;
          const target = e.target as HTMLInputElement;
          let val =
            filterType && filterMap[filterType]
              ? filterMap[filterType](target.value)
              : target.value;
          if (applySentenceCase) val = sentenceCaseAddressInput(val, false);
          if (uppercaseEnglishName) val = val.toUpperCase();
          if (maxLength) val = val.slice(0, maxLength);
          target.value = val;
        }}
        onBlur={(e) => {
          e.target.value = normalizeValue(e.target.value);
          registration.onBlur(e);
        }}
        className={`w-full rounded border p-2 transition-[border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className} ${disabled ? 'cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      />
    </FieldRow>
  );
};

export default FormInput;
