'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUpazilasByDistrict } from '@school/shared-schemas';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { getFileUrl } from '@/lib/cdn';
import { checkRegistrationPhoto, REG_PHOTO_SIZE_LABEL } from '@/lib/registrationPhoto';
import DuplicateWarning, { Duplicate } from '@/components/Form/DuplicateWarning';
import FormErrorSummary, {
  extractApiErrorItems,
  scrollToFormErrorSummary,
  type FormErrorItem,
} from '@/components/Form/FormErrorSummary';
import SectionHeader from '@/components/Form/SectionHeader';
import FieldRow, { Instruction } from '@/components/Form/FieldRow';
import AddressFields from '@/components/Form/AddressFields';
import GuardianSection from '@/components/Form/GuardianSection';
import FormInput from '@/components/Form/FormInput';
import type { SchoolConfig } from '@/types';
import { FORM_CONFIGS, type FormKind } from './formConfigs';

type Props = {
  kind: FormKind;
  settings: any;
  initialRecord?: any;
  schoolConfig?: SchoolConfig;
};

function parseRollRange(rollRange: string | null): string[] {
  if (!rollRange) return [];
  const rolls: Set<number> = new Set();
  const parts = rollRange.split(',').map((p) => p.trim());
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
    .map((num) => String(num).padStart(2, '0'));
}

export default function RegistrationFormClient({
  kind,
  settings: settingsProp,
  initialRecord,
  schoolConfig,
}: Props) {
  const config = FORM_CONFIGS[kind];
  const router = useRouter();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [permanentUpazilas, setPermanentUpazilas] = useState<any[]>([]);
  const [presentUpazilas, setPresentUpazilas] = useState<any[]>([]);
  const [prevSchoolUpazilas, setPrevSchoolUpazilas] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(settingsProp);
  const [availableRolls, setAvailableRolls] = useState<string[]>([]);
  const [initialRoll, setInitialRoll] = useState<string | null>(null);
  const [initialRollApplied, setInitialRollApplied] = useState(false);
  const [initialPermanentUpazila, setInitialPermanentUpazila] = useState<string | null>(null);
  const [initialPresentUpazila, setInitialPresentUpazila] = useState<string | null>(null);
  const [initialPrevSchoolUpazila, setInitialPrevSchoolUpazila] = useState<string | null>(null);
  const [initialUpazilasApplied, setInitialUpazilasApplied] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [apiErrors, setApiErrors] = useState<FormErrorItem[] | null>(null);
  const [prevSchoolOption, setPrevSchoolOption] = useState(schoolConfig?.name.en ?? '');
  const [nearbyOption, setNearbyOption] = useState('');

  const nearbyOptions = useMemo(() => {
    if (!settings?.classmates) return [];
    return settings.classmates
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean);
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
  } = useForm<any>({
    resolver: zodResolver(config.schema) as any,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    defaultValues: config.defaultValues,
  });

  const permanent_district = useWatch({ control, name: 'permanent_district' });
  const permanent_upazila = useWatch({ control, name: 'permanent_upazila' });
  const permanent_post_office = useWatch({ control, name: 'permanent_post_office' });
  const permanent_post_code = useWatch({ control, name: 'permanent_post_code' });
  const permanent_village_road = useWatch({ control, name: 'permanent_village_road' });
  const present_district = useWatch({ control, name: 'present_district' });
  const prev_school_district = useWatch({ control, name: 'prev_school_district' });
  const birth_year = useWatch({ control, name: 'birth_year' });
  const birth_month = useWatch({ control, name: 'birth_month' });
  const birth_reg_no = useWatch({ control, name: 'birth_reg_no' });
  const sameAsPermanent = useWatch({ control, name: 'same_as_permanent' });
  const photo = useWatch({ control, name: 'photo' });
  const selectedSection = useWatch({ control, name: 'section' });
  const prev_school_name = useWatch({ control, name: 'prev_school_name' });
  const group_class_nine = useWatch({ control, name: 'group_class_nine' });
  const main_subject = useWatch({ control, name: 'main_subject' });
  const nearby_nine_student_info = useWatch({ control, name: 'nearby_nine_student_info' });

  const permanentAddress = useMemo(
    () => ({
      district: permanent_district,
      upazila: permanent_upazila,
      post_office: permanent_post_office,
      post_code: permanent_post_code,
      village_road: permanent_village_road,
    }),
    [
      permanent_district,
      permanent_upazila,
      permanent_post_office,
      permanent_post_code,
      permanent_village_road,
    ],
  );

  const metadata = config.metadata;
  const ExtraFields = config.ExtraFields;
  const isRequired = config.isRequired;

  useEffect(() => {
    const initializeData = () => {
      try {
        setLoading(true);
        setSettings(settingsProp);

        if (isEditMode && id) {
          const data = initialRecord;
          if (!data) {
            router.replace(`/registration/${kind}/form`);
            return;
          }
          const formData: any = { ...data };
          Object.keys(formData).forEach((key) => {
            if (formData[key] === null) {
              formData[key] = '';
            }
          });
          config.hydrateEditExtras?.(formData, settingsProp);

          if (settingsProp && data.section) {
            const rollRange =
              data.section === 'A' ? settingsProp.a_sec_roll : settingsProp.b_sec_roll;
            setAvailableRolls(parseRollRange(rollRange ?? null));
          }
          if (data.roll) {
            setInitialRoll(data.roll);
            setInitialRollApplied(false);
          } else {
            setInitialRollApplied(true);
          }
          if (data.permanent_district) {
            setPermanentUpazilas(getUpazilasByDistrict(data.permanent_district));
            setInitialPermanentUpazila(data.permanent_upazila || '');
          }
          if (data.present_district) {
            setPresentUpazilas(getUpazilasByDistrict(data.present_district));
            setInitialPresentUpazila(data.present_upazila || '');
          }
          if (data.prev_school_district) {
            setPrevSchoolUpazilas(getUpazilasByDistrict(data.prev_school_district));
            setInitialPrevSchoolUpazila(data.prev_school_upazila || '');
          }
          const hasDistrictsToSync = Boolean(
            data.permanent_district || data.present_district || data.prev_school_district,
          );
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

          setValue('same_as_permanent', isSame);
          setValue('guardian_address_same_as_permanent', isGuardianSameAsPermanent);
          if (data.guardian_name && data.guardian_name.trim() !== '') {
            setValue('guardian_is_not_father', true);
          } else {
            setValue('guardian_is_not_father', false);
          }
          const previewPath = config.getPhotoPreview(data);
          if (previewPath) {
            setPhotoPreview(getFileUrl(previewPath));
          }
        } else {
          setInitialRollApplied(true);
          setInitialUpazilasApplied(true);
          if (config.sameSchoolAutofill && schoolConfig) {
            config.applyCreateDefaults(setValue, settingsProp, schoolConfig);
          }
        }
      } catch (error) {
        console.error('Failed to initialize data:', error);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
    // ponytail: mirror prior per-class dep lists; schoolConfig only when autofill needs it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id, initialRecord, settingsProp, router, reset, setValue, kind]);

  useEffect(() => {
    if (!config.sameSchoolAutofill || !schoolConfig) return;
    if (prev_school_name === schoolConfig.name.en) {
      setPrevSchoolOption(schoolConfig.name.en);
    } else if (prev_school_name && prev_school_name !== '') {
      setPrevSchoolOption('Others');
    }
  }, [prev_school_name, schoolConfig, config.sameSchoolAutofill]);

  useEffect(() => {
    if (kind !== 'class-9') return;
    if (nearby_nine_student_info && nearbyOptions.includes(nearby_nine_student_info)) {
      setNearbyOption(nearby_nine_student_info);
    } else if (nearby_nine_student_info && nearby_nine_student_info !== '') {
      setNearbyOption(nearby_nine_student_info);
    }
  }, [nearby_nine_student_info, nearbyOptions, kind]);

  const handlePrevSchoolOptionChange = (value: string) => {
    if (!schoolConfig) return;
    setPrevSchoolOption(value);
    if (value === schoolConfig.name.en) {
      setValue('prev_school_name', schoolConfig.name.en, { shouldValidate: true });
      setValue('prev_school_district', schoolConfig.contact.district, { shouldValidate: true });
    } else if (value === 'Others') {
      setValue('prev_school_name', '');
      setValue('prev_school_district', '');
      setValue('prev_school_upazila', '');
    }
  };

  const handleNearbyOptionChange = (value: string) => {
    setNearbyOption(value);
    if (value !== 'Others') {
      setValue('nearby_nine_student_info', value, { shouldValidate: true });
    } else {
      setValue('nearby_nine_student_info', '');
    }
  };

  useEffect(() => {
    if (!settings || !selectedSection) {
      setAvailableRolls([]);
      return;
    }
    if (selectedSection === 'A') {
      setAvailableRolls(parseRollRange(settings.a_sec_roll));
    } else if (selectedSection === 'B') {
      setAvailableRolls(parseRollRange(settings.b_sec_roll));
    } else {
      setAvailableRolls([]);
    }
  }, [selectedSection, settings]);

  const paddedInitialRoll = useMemo(() => {
    if (!initialRoll) return null;
    const num = parseInt(initialRoll);
    return isNaN(num) ? initialRoll : String(num).padStart(2, '0');
  }, [initialRoll]);

  useEffect(() => {
    if (availableRolls.length > 0 && paddedInitialRoll && !initialRollApplied) {
      const timer = setTimeout(() => {
        setValue('roll', paddedInitialRoll, { shouldValidate: true });
        setInitialRollApplied(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [availableRolls, paddedInitialRoll, initialRollApplied, setValue]);

  useEffect(() => {
    if (!isEditMode || initialUpazilasApplied) return;
    const hasOptions =
      permanentUpazilas.length > 0 || presentUpazilas.length > 0 || prevSchoolUpazilas.length > 0;
    if (hasOptions) {
      const timer = setTimeout(() => {
        if (initialPermanentUpazila)
          setValue('permanent_upazila', initialPermanentUpazila, { shouldValidate: true });
        if (initialPresentUpazila)
          setValue('present_upazila', initialPresentUpazila, { shouldValidate: true });
        if (initialPrevSchoolUpazila)
          setValue('prev_school_upazila', initialPrevSchoolUpazila, { shouldValidate: true });
        setInitialUpazilasApplied(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [
    permanentUpazilas,
    presentUpazilas,
    prevSchoolUpazilas,
    initialPermanentUpazila,
    initialPresentUpazila,
    initialPrevSchoolUpazila,
    initialUpazilasApplied,
    isEditMode,
    setValue,
  ]);

  useEffect(() => {
    if (!permanent_district) {
      setPermanentUpazilas([]);
      return;
    }
    setPermanentUpazilas(getUpazilasByDistrict(permanent_district));
    // class-6 historically also listed permanent_upazila; harmless for 8/9
  }, [permanent_district, permanent_upazila]);

  useEffect(() => {
    if (!present_district) {
      setPresentUpazilas([]);
      return;
    }
    setPresentUpazilas(getUpazilasByDistrict(present_district));
  }, [present_district]);

  useEffect(() => {
    if (sameAsPermanent) {
      setValue('present_district', permanent_district);
      setValue('present_upazila', permanent_upazila);
      setValue('present_post_office', permanent_post_office);
      setValue('present_post_code', permanent_post_code);
      setValue('present_village_road', permanent_village_road);
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
    if (!prev_school_district) {
      setPrevSchoolUpazilas([]);
      return;
    }
    setPrevSchoolUpazilas(getUpazilasByDistrict(prev_school_district));
  }, [prev_school_district]);

  useEffect(() => {
    if (!config.sameSchoolAutofill || !schoolConfig) return;
    if (
      prevSchoolOption === schoolConfig.name.en &&
      prev_school_district === schoolConfig.contact.district &&
      prevSchoolUpazilas.length > 0
    ) {
      const currentUpazila = getValues('prev_school_upazila');
      if (!currentUpazila || currentUpazila === '') {
        const targetUpazila = schoolConfig.contact.upazila;
        const exists = prevSchoolUpazilas.some((u) => u.id === targetUpazila);
        if (exists) {
          setValue('prev_school_upazila', targetUpazila, { shouldValidate: true });
        }
      }
    }
  }, [
    prevSchoolUpazilas,
    prev_school_district,
    prevSchoolOption,
    schoolConfig,
    setValue,
    getValues,
    config.sameSchoolAutofill,
  ]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await checkRegistrationPhoto(file);
    if (!result.ok) {
      alert(result.message);
      e.target.value = '';
      if (config.clearPhotoOnFail) {
        setValue('photo', '', { shouldValidate: true });
      }
      return;
    }

    setValue('photo', file, { shouldValidate: true });
    if (config.clearPhotoOnFail) {
      clearErrors('photo');
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const currentYear = new Date().getFullYear();
  const earliestYear = 1900;
  const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, i) =>
    String(currentYear - i),
  );
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  function getDaysInMonth(year: string, month: string) {
    if (!year || !month) return [];
    const days = new Date(Number(year), Number(month), 0).getDate();
    return Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, '0'));
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
    if (config.clearBirthMonthDay) {
      const clearBirthDate = () => {
        setValue('birth_year', '', { shouldValidate: true });
        setValue('birth_month', '', { shouldValidate: true });
        setValue('birth_day', '', { shouldValidate: true });
      };

      if (!birth_reg_no || birth_reg_no.length < 4) {
        if (birth_year !== '' || birth_month !== '') {
          clearBirthDate();
        }
        return;
      }

      const year = birth_reg_no.slice(0, 4);
      const yearNum = Number(year);
      const hasValidYear =
        /^\d{4}$/.test(year) && yearNum >= earliestYear && yearNum <= currentYear;

      if (!hasValidYear) {
        clearBirthDate();
        return;
      }

      setValue('birth_year', year, { shouldValidate: true });
      return;
    }

    if (birth_reg_no && birth_reg_no.length >= 4) {
      const year = birth_reg_no.slice(0, 4);
      const yearNum = Number(year);
      if (/^\d{4}$/.test(year) && yearNum >= earliestYear && yearNum <= currentYear) {
        setValue('birth_year', year, { shouldValidate: true });
      } else {
        setValue('birth_year', '', { shouldValidate: true });
      }
    } else if (birth_year !== '') {
      setValue('birth_year', '', { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birth_reg_no, birth_year, birth_month, setValue, config.clearBirthMonthDay]);

  const onSubmit = async (data: any) => {
    setDuplicates([]);
    setApiErrors(null);
    try {
      let photoKey = '';
      if (data.photo instanceof File) {
        const { data: uploadData } = await axios.post(`/api/reg/${kind}/form/upload-url`, {
          filename: data.photo.name,
          filetype: data.photo.type,
          name: data.student_name_en,
          roll: data.roll,
          section: data.section,
          ...config.yearForUpload(settings, data),
        });
        if (uploadData.success) {
          await axios.put(uploadData.data.uploadUrl, data.photo, {
            headers: { 'Content-Type': data.photo.type },
            withCredentials: false,
          });
          photoKey = uploadData.data.key;
        }
      } else if (typeof data.photo === 'string') {
        photoKey = data.photo;
      }
      const submissionData = {
        ...data,
        photo: photoKey,
        ...config.yearForSubmit(settings, data),
      };
      const endpoint = isEditMode ? `/api/reg/${kind}/form/${id}` : `/api/reg/${kind}/form`;
      const method = isEditMode ? 'put' : 'post';
      const response = await axios[method](endpoint, submissionData);
      if (response.data.success) {
        router.push(`/registration/${kind}/confirm/${response.data.data.id}`);
      }
    } catch (error: any) {
      console.error('Submission error', error);
      const errData = error.response?.data;
      const duplicateList = errData?.duplicates?.length
        ? errData.duplicates
        : errData?.message === 'Duplicate information found' && Array.isArray(errData?.errors)
          ? errData.errors
          : null;
      if (duplicateList) {
        setDuplicates(duplicateList);
        setApiErrors(null);
      } else {
        const items = extractApiErrorItems(errData);
        setApiErrors(
          items.length
            ? items
            : [{ id: 'api', message: 'Failed to submit registration. Please try again.' }],
        );
      }
      scrollToFormErrorSummary();
    }
  };

  if (loading || !settings || (isEditMode && (!initialRollApplied || !initialUpazilasApplied))) {
    return (
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-white/80 backdrop-blur-md">
        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24">
            <div className="absolute top-0 left-0 h-full w-full rounded-full border-4 border-blue-100"></div>
            <div className="absolute top-0 left-0 h-full w-full animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          </div>
          <div className="mt-6 text-xl font-bold tracking-tight text-gray-800">
            {config.loadingText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-full px-3 py-3 sm:max-w-2xl sm:px-4 sm:py-4 md:max-w-3xl lg:max-w-4xl lg:px-6 lg:py-6 xl:max-w-5xl">
      <div className="sticky top-0 z-20 mb-4 flex flex-col items-center rounded-t border-b border-blue-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:px-4 sm:py-3">
        <h2 className="mb-1 text-center text-xl font-bold tracking-tight text-blue-700 underline underline-offset-4 sm:mb-2 sm:text-2xl lg:text-3xl">
          {config.title(isEditMode, settings)}
        </h2>
        <span className="px-2 text-center text-xs text-gray-600 sm:text-sm">
          Please fill all required fields. Fields marked <span className="text-red-600">*</span> are
          mandatory.
        </span>
      </div>

      {duplicates.length > 0 && <DuplicateWarning duplicates={duplicates} />}
      <FormErrorSummary errors={errors} apiErrors={apiErrors} />

      <form
        onSubmit={handleSubmit(onSubmit, (validationErrors) => {
          if (config.validationErrorMessage) {
            setApiErrors(
              Object.keys(validationErrors).length
                ? [
                    {
                      id: 'validation',
                      message: 'Please fix the highlighted fields and submit again.',
                    },
                  ]
                : null,
            );
          } else {
            setApiErrors(null);
          }
          scrollToFormErrorSummary();
        })}
        className="space-y-10"
      >
        <SectionHeader title="Personal Information">
          <FieldRow
            label="Section"
            isRequired={isRequired('section')}
            error={errors.section}
            tooltip={metadata.section?.tooltip}
            instruction={metadata.section?.instruction}
          >
            <select
              {...register('section')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            >
              <option value="">Select Section</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </FieldRow>
          <FieldRow
            label="Roll"
            isRequired={isRequired('roll')}
            error={errors.roll}
            tooltip={metadata.roll?.tooltip}
            instruction={metadata.roll?.instruction}
          >
            <select
              {...register('roll')}
              disabled={!selectedSection || availableRolls.length === 0}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-base"
            >
              <option value="">
                {!selectedSection
                  ? 'Select Section First'
                  : availableRolls.length === 0
                    ? 'No rolls available'
                    : 'Select Roll Number'}
              </option>
              {availableRolls.map((roll) => (
                <option key={roll} value={roll}>
                  {roll}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow
            label="Religion:"
            isRequired={isRequired('religion')}
            error={errors.religion}
            tooltip={kind === 'class-6' ? 'Select your religion' : undefined}
          >
            <select
              {...register('religion')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
              aria-invalid={kind === 'class-6' ? !!errors.religion : undefined}
            >
              <option value="">Select Religion</option>
              <option value="Islam">Islam</option>
              <option value="Hinduism">Hinduism</option>
              <option value="Christianity">Christianity</option>
              <option value="Buddhism">Buddhism</option>
            </select>
          </FieldRow>
          {config.showScoutInPersonal ? (
            <FieldRow
              label={config.scoutLabel}
              isRequired={isRequired('scout_status')}
              error={errors.scout_status}
            >
              <select
                {...register('scout_status')}
                className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
                aria-invalid={kind === 'class-6' ? !!errors.scout_status : undefined}
              >
                <option value="">Select Option</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </FieldRow>
          ) : null}
          <FormInput
            label="ছাত্রের নাম (বাংলায়)"
            name="student_name_bn"
            register={register}
            errors={errors}
            isRequired={isRequired('student_name_bn')}
            filterType="bangla"
            placeholder="ছাত্রের নাম (বাংলায়)"
            tooltip={metadata.student_name_bn?.tooltip}
            instruction={metadata.student_name_bn?.instruction}
          />
          {config.showNickName ? (
            <FormInput
              label="ডাকনাম (এক শব্দে/বাংলায়)"
              name="student_nick_name_bn"
              register={register}
              errors={errors}
              isRequired
              filterType="bangla"
              placeholder="ডাকনাম (বাংলায়)"
            />
          ) : null}
          <FormInput
            label={config.studentNameEnLabel}
            name="student_name_en"
            register={register}
            errors={errors}
            isRequired={isRequired('student_name_en')}
            filterType="english"
            placeholder="Student Name (in English)"
            tooltip={metadata.student_name_en?.tooltip}
            instruction={metadata.student_name_en?.instruction}
          />
          <FormInput
            label="Birth Registration No"
            name="birth_reg_no"
            register={register}
            errors={errors}
            isRequired={isRequired('birth_reg_no')}
            filterType="numeric"
            maxLength={17}
            placeholder="17 Digits"
            tooltip={metadata.birth_reg_no?.tooltip}
            instruction={metadata.birth_reg_no?.instruction}
          />

          <FieldRow
            label="Date of Birth:"
            isRequired={isRequired('birth_year')}
            error={errors.birth_year || errors.birth_month || errors.birth_day}
            tooltip={
              kind === 'class-6'
                ? 'Birth year is auto-filled from birth registration number. Select month and day manually'
                : undefined
            }
          >
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <input
                type="text"
                {...register('birth_year')}
                maxLength={4}
                readOnly
                disabled
                className="w-full rounded border bg-gray-100 px-3 py-2 text-sm sm:w-32 sm:text-base"
                placeholder="Year"
                tabIndex={kind === 'class-6' ? -1 : undefined}
                aria-invalid={kind === 'class-6' ? !!errors.birth_year : undefined}
              />

              <select
                {...register('birth_month')}
                className="w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:w-40 sm:text-base"
                disabled={disableMonth || !birth_year}
                aria-invalid={kind === 'class-6' ? !!errors.birth_month : undefined}
              >
                <option value="">Month</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                {...register('birth_day')}
                className="w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:w-28 sm:text-base"
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
            isRequired={isRequired('father_name_bn')}
            filterType="bangla"
            placeholder="পিতার নাম (বাংলায়)"
            tooltip={metadata.father_name_bn?.tooltip}
            instruction={metadata.father_name_bn?.instruction}
          />
          <FormInput
            label={config.fatherNameEnLabel}
            name="father_name_en"
            register={register}
            errors={errors}
            isRequired={isRequired('father_name_en')}
            filterType="english"
            placeholder="Father's Name (in English)"
            tooltip={metadata.father_name_en?.tooltip}
            instruction={metadata.father_name_en?.instruction}
          />
          <FormInput
            label="Father's NID Number"
            name="father_nid"
            register={register}
            errors={errors}
            isRequired={isRequired('father_nid')}
            filterType="numeric"
            maxLength={17}
            placeholder="10 Digits/13 Digits/17 Digits"
            tooltip={metadata.father_nid?.tooltip}
            instruction={metadata.father_nid?.instruction}
          />
          <FormInput
            label="Father's Mobile Number"
            name="father_phone"
            register={register}
            errors={errors}
            isRequired={isRequired('father_phone')}
            filterType="numeric"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            tooltip={
              kind === 'class-6'
                ? "Enter father's mobile number in 11-digit format (e.g., 01XXXXXXXXX)"
                : undefined
            }
          />
          <FormInput
            label="মাতার নাম (বাংলায়)"
            name="mother_name_bn"
            register={register}
            errors={errors}
            isRequired={isRequired('mother_name_bn')}
            filterType="bangla"
            placeholder="মাতার নাম (বাংলায়)"
            tooltip={metadata.mother_name_bn?.tooltip}
            instruction={metadata.mother_name_bn?.instruction}
          />
          <FormInput
            label={config.motherNameEnLabel}
            name="mother_name_en"
            register={register}
            errors={errors}
            isRequired={isRequired('mother_name_en')}
            filterType="english"
            placeholder="Mother's Name (in English)"
            tooltip={metadata.mother_name_en?.tooltip}
            instruction={metadata.mother_name_en?.instruction}
          />
          <FormInput
            label="Mother's NID Number"
            name="mother_nid"
            register={register}
            errors={errors}
            isRequired={isRequired('mother_nid')}
            filterType="numeric"
            maxLength={17}
            placeholder="10 Digits/13 Digits/17 Digits"
            tooltip={metadata.mother_nid?.tooltip}
            instruction={metadata.mother_nid?.instruction}
          />
          <FormInput
            label="Mother's Mobile Number"
            name="mother_phone"
            register={register}
            errors={errors}
            isRequired={isRequired('mother_phone')}
            filterType="numeric"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            tooltip={
              kind === 'class-6'
                ? "Enter mother's mobile number in 11-digit format (e.g., 01XXXXXXXXX)"
                : undefined
            }
          />
          {config.showBloodGroup ? (
            <FieldRow label="Blood Group:" isRequired={false} error={errors.blood_group}>
              <select
                {...register('blood_group')}
                className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
          ) : null}
          <FormInput
            label="Email"
            name="email"
            register={register}
            errors={errors}
            isRequired={false}
            placeholder="example@email.com"
            tooltip={
              kind === 'class-6'
                ? 'Enter a valid email address for communication. This is recommended'
                : undefined
            }
          />
        </SectionHeader>
        <SectionHeader title="Address Information">
          <h4 className="mb-2 text-sm font-semibold sm:text-base">Permanent Address:</h4>
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
              id={kind === 'class-6' ? 'sameAsPermanent' : undefined}
              checked={sameAsPermanent}
              onChange={(e) => {
                const checked = e.target.checked;
                setValue('same_as_permanent', checked);
                if (!checked) {
                  (
                    [
                      'present_district',
                      'present_upazila',
                      'present_post_office',
                      'present_post_code',
                      'present_village_road',
                    ] as const
                  ).forEach((f) => {
                    setValue(f, '');
                    clearErrors(f);
                  });
                }
              }}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-sm">Same as Permanent Address</span>
          </div>
          {!sameAsPermanent && (
            <div className="mt-4 space-y-2">
              <h4 className="mb-2 text-sm font-semibold sm:text-base">Present Address:</h4>
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
          control={control as Control<any>}
          setValue={setValue}
          isRequired={isRequired}
          permanentAddress={permanentAddress}
          {...(config.passGuardianMetadata ? { metadata } : {})}
        />

        <ExtraFields
          register={register}
          errors={errors}
          setValue={setValue}
          control={control}
          isRequired={isRequired}
          settings={settings}
          schoolConfig={schoolConfig}
          prevSchoolUpazilas={prevSchoolUpazilas}
          prev_school_district={prev_school_district}
          prevSchoolOption={prevSchoolOption}
          handlePrevSchoolOptionChange={handlePrevSchoolOptionChange}
          nearbyOption={nearbyOption}
          handleNearbyOptionChange={handleNearbyOptionChange}
          nearbyOptions={nearbyOptions}
          group_class_nine={group_class_nine}
          main_subject={main_subject}
        />

        <SectionHeader title="বিদ্যালয়ের ইউনিফর্ম পরিহিত ছাত্রের রঙ্গিন ছবি">
          <FieldRow
            label={kind === 'class-6' ? <span>Photo:</span> : 'Photo:'}
            isRequired={isRequired('photo')}
            error={errors.photo as any}
            tooltip={metadata.photo?.tooltip}
            instruction={config.photoHelp === 'p' ? metadata.photo?.instruction : undefined}
          >
            <div className="flex flex-col items-start gap-4 lg:flex-row">
              <div className="shrink-0">
                <div
                  className="relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 text-gray-400"
                  style={{ width: '150px', height: '190px' }}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="photo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="px-2 text-center">
                      <div className="text-xs text-gray-500 sm:text-sm">
                        {isEditMode ? 'Current photo' : 'No photo uploaded'}
                      </div>
                    </div>
                  )}
                  <input
                    id="photo-input"
                    type="file"
                    name={kind === 'class-6' ? 'photo' : undefined}
                    accept=".jpg,.jpeg,image/jpeg"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label
                    htmlFor="photo-input"
                    className="inline-flex cursor-pointer items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 sm:text-base"
                  >
                    {photoPreview ? 'Change Photo' : 'Choose Photo'}
                  </label>
                  <a
                    href="https://imageresizer.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded bg-green-600 px-4 py-2 text-sm font-medium text-white! shadow hover:bg-green-700 sm:text-base"
                  >
                    Resize Now (300×330)
                  </a>
                  {(photoPreview || photo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setValue('photo', '', { shouldValidate: true });
                        const input = document.getElementById(
                          'photo-input',
                        ) as HTMLInputElement | null;
                        if (input) input.value = '';
                      }}
                      className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 sm:text-base"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                {config.photoHelp === 'instruction' ? (
                  <Instruction>
                    JPG only. Max 2MB. <strong>Requirement: exactly {REG_PHOTO_SIZE_LABEL}.</strong>
                  </Instruction>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    JPG only. Max 2MB. <strong>Requirement: exactly {REG_PHOTO_SIZE_LABEL}.</strong>
                  </p>
                )}
              </div>
            </div>
          </FieldRow>
        </SectionHeader>

        <div className="flex justify-center border-t-2 border-gray-100 pt-10">
          <button
            type="submit"
            disabled={loading || isSubmitting}
            className={`rounded-xl px-12 py-4 text-xl font-bold text-white shadow-2xl transition-all ${loading || isSubmitting ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-600 hover:scale-105 hover:bg-blue-700 active:scale-95'}`}
          >
            {loading || isSubmitting
              ? 'Submitting...'
              : isEditMode
                ? 'Update Registration'
                : 'Submit Registration'}
          </button>
        </div>
      </form>
    </div>
  );
}
