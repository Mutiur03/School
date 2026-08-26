'use client';

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import type { SchoolConfig } from '@/types';
import SectionHeader from '@/components/Form/SectionHeader';
import FieldRow from '@/components/Form/FieldRow';
import AddressFields from '@/components/Form/AddressFields';
import FormInput from '@/components/Form/FormInput';
import { filterNumericInput } from '@school/shared-schemas';

export type ExtraFieldsProps = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  setValue: UseFormSetValue<any>;
  control: Control<any>;
  isRequired: (name?: string) => boolean;
  settings: any;
  schoolConfig?: SchoolConfig;
  prevSchoolUpazilas: any[];
  prev_school_district: any;
  prevSchoolOption?: string;
  handlePrevSchoolOptionChange?: (value: string) => void;
  nearbyOption?: string;
  handleNearbyOptionChange?: (value: string) => void;
  nearbyOptions?: string[];
  group_class_nine?: string;
  main_subject?: string;
};

export function Class6ExtraFields({
  register,
  errors,
  setValue,
  isRequired,
  settings,
  prevSchoolUpazilas,
  prev_school_district,
}: ExtraFieldsProps) {
  return (
    <>
      <SectionHeader title="Previous School Information (Class 5)">
        <FieldRow
          label="Name of Previous School :"
          isRequired={isRequired('prev_school_name')}
          error={errors.prev_school_name}
          tooltip="Enter the full name of your previous school"
        >
          <input
            {...register('prev_school_name')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            placeholder="Enter the name of your previous school"
            aria-invalid={!!errors.prev_school_name}
          />
        </FieldRow>
        <FieldRow
          label="Passing Year:"
          isRequired={isRequired('prev_school_passing_year')}
          error={errors.prev_school_passing_year}
          tooltip="Select the year you passed from your previous school"
        >
          <select
            {...register('prev_school_passing_year')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            aria-invalid={!!errors.prev_school_passing_year}
          >
            <option value="">Select Year</option>
            {Array.from({ length: 3 }, (_, i) => String(new Date().getFullYear() - 1 - i)).map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ),
            )}
          </select>
        </FieldRow>

        <FieldRow
          label="Section:"
          isRequired={isRequired('section_in_prev_school')}
          error={errors.section_in_prev_school}
          tooltip="Select which section you were in during previous school"
        >
          <select
            {...register('section_in_prev_school')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            aria-invalid={!!errors.section_in_prev_school}
          >
            <option value="">Select Section</option>
            {['No section', 'A', 'B', 'C', 'D', 'E', 'F'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow
          label="Roll:"
          isRequired={isRequired('roll_in_prev_school')}
          error={errors.roll_in_prev_school}
          tooltip="Enter your roll number in previous school"
        >
          <input
            {...register('roll_in_prev_school')}
            inputMode="numeric"
            maxLength={6}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              target.value = filterNumericInput(target.value).slice(0, 6);
            }}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            placeholder="Roll Number"
            aria-invalid={!!errors.roll_in_prev_school}
          />
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
      <SectionHeader title="Student Information Reference">
        <FieldRow
          label="বাসার নিকটবর্তী ষষ্ঠ শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:"
          isRequired={isRequired('nearby_student_info')}
          error={errors.nearby_student_info}
          tooltip="Select a classmate name from the list"
        >
          <select
            {...register('nearby_student_info')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            aria-invalid={!!errors.nearby_student_info}
          >
            <option value="">Select Name</option>
            {(settings?.classmates ?? '')
              .split(/\n|,/)
              .map((name: string) => name.trim())
              .filter(Boolean)
              .map((trimmedName: string, idx: number) => (
                <option key={idx} value={trimmedName}>
                  {trimmedName}
                </option>
              ))}
          </select>
        </FieldRow>
      </SectionHeader>
    </>
  );
}

export function Class8ExtraFields({
  register,
  errors,
  setValue,
  isRequired,
  settings,
  schoolConfig,
  prevSchoolUpazilas,
  prev_school_district,
  prevSchoolOption,
  handlePrevSchoolOptionChange,
}: ExtraFieldsProps) {
  return (
    <>
      <SectionHeader title="Previous School Information (Class Six)">
        <FormInput
          label="Registration No (Class Six)"
          name="registration_no"
          register={register}
          errors={errors}
          isRequired
          filterType="numeric"
          maxLength={10}
          placeholder="10 Digits"
        />
        <FieldRow
          label="Class Six Academic Session:"
          isRequired
          error={errors.class6_academic_session}
        >
          <select
            {...register('class6_academic_session')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
          >
            <option value="">Select Session</option>
            {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i - 2)).map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ),
            )}
          </select>
        </FieldRow>
        <FieldRow label="Name of Previous School :" isRequired error={errors.prev_school_name}>
          <div className="space-y-3">
            <select
              value={prevSchoolOption}
              onChange={(e) => handlePrevSchoolOptionChange?.(e.target.value)}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            >
              <option value={schoolConfig!.name.en}>{schoolConfig!.name.en}</option>
              <option value="Others">Others</option>
            </select>

            {prevSchoolOption === 'Others' && (
              <input
                {...register('prev_school_name')}
                className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
      <SectionHeader title="Student Information Reference">
        <FieldRow
          label="বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:"
          isRequired
          error={errors.nearby_student_info}
        >
          <select
            {...register('nearby_student_info')}
            className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
          >
            <option value="">Select Name</option>
            {(settings?.classmates ?? '')
              .split(/\n|,/)
              .map((name: string) => name.trim())
              .filter(Boolean)
              .map((trimmedName: string, idx: number) => (
                <option key={idx} value={trimmedName}>
                  {trimmedName}
                </option>
              ))}
          </select>
        </FieldRow>
      </SectionHeader>
    </>
  );
}

const subjectOptionsByGroup = {
  Science: {
    main: [
      {
        value: 'Higher Mathematics',
        label: 'উচ্চতর গণিত (Higher Mathematics) Code-126',
      },
      { value: 'Biology', label: 'জীববিজ্ঞান (Biology) Code-138' },
    ],
    fourth: [
      {
        value: 'Higher Mathematics',
        label: 'উচ্চতর গণিত (Higher Mathematics) Code-126',
      },
      { value: 'Biology', label: 'জীববিজ্ঞান (Biology) Code-138' },
      {
        value: 'Agricultural Studies',
        label: 'কৃষিশিক্ষা (Agricultural Studies) Code-134',
      },
      {
        value: 'Geography & Environment',
        label: 'ভূগোল ও পরিবেশ (Geography & Environment) Code-110',
      },
    ],
  },
  Humanities: {
    main: [{ value: 'Civics', label: 'পৌরনীতি ও নাগরিকতা (Civics) Code-140' }],
    fourth: [
      {
        value: 'Agricultural Studies',
        label: 'কৃষিশিক্ষা (Agricultural Studies) Code-134',
      },
    ],
  },
  'Business Studies': {
    main: [
      { value: 'Accounting', label: 'হিসাববিজ্ঞান (Accounting) Code-146' },
      {
        value: 'Finance & Banking',
        label: 'ফিন্যান্স ও ব্যাংকিং (Finance & Banking) Code-152',
      },
      {
        value: 'Business Ent.',
        label: 'ব্যবসায় উদ্যোগ (Business Ent.) Code-143',
      },
    ],
    fourth: [
      {
        value: 'Agricultural Studies',
        label: 'কৃষিশিক্ষা (Agricultural Studies) Code-134',
      },
      {
        value: 'Geography & Environment',
        label: 'ভূগোল ও পরিবেশ (Geography & Environment) Code-110',
      },
    ],
  },
};

export function Class9ExtraFields({
  register,
  errors,
  setValue,
  isRequired,
  schoolConfig,
  prevSchoolUpazilas,
  prev_school_district,
  prevSchoolOption,
  handlePrevSchoolOptionChange,
  nearbyOption,
  handleNearbyOptionChange,
  nearbyOptions = [],
  group_class_nine,
  main_subject,
}: ExtraFieldsProps) {
  const jscMeta = {
    jsc_reg_no: {
      tooltip: 'Write your JSC/JDC/Class 8 Registration Number',
      instruction: 'জেএসসি/জেডিসি রেজিস্ট্রেশন নম্বর লিখুন',
    },
    jsc_roll_no: {
      tooltip: 'Write your JSC/JDC/Class 8 ID/Roll Number',
      instruction: 'জেএসসি/জেডিসি আইডি/রোল নম্বর লিখুন',
    },
  };

  return (
    <>
      <SectionHeader title="Previous School Information">
        <FieldRow label="Name of Previous School :" isRequired error={errors.prev_school_name}>
          <div className="space-y-3">
            <select
              value={prevSchoolOption}
              onChange={(e) => handlePrevSchoolOptionChange?.(e.target.value)}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            >
              <option value={schoolConfig!.name.en}>{schoolConfig!.name.en}</option>
              <option value="Others">Others</option>
            </select>

            {prevSchoolOption === 'Others' && (
              <input
                {...register('prev_school_name')}
                className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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

      <SectionHeader title="JSC/JDC/Class 8 Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldRow
            label="JSC/JDC/Class 8 Passing Year:"
            isRequired
            error={errors.jsc_passing_year}
          >
            <select
              {...register('jsc_passing_year')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            >
              <option value="">Select Year</option>
              {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i - 1)).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </FieldRow>
          <FieldRow label="JSC/JDC/Class 8 Board:" isRequired error={errors.jsc_board}>
            <select
              {...register('jsc_board')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
            label="JSC/JDC/Class 8 Registration Number"
            name="jsc_reg_no"
            register={register}
            errors={errors}
            isRequired
            filterType="numeric"
            maxLength={10}
            placeholder="10 Digits"
            tooltip={jscMeta.jsc_reg_no.tooltip}
            instruction={jscMeta.jsc_reg_no.instruction}
          />
          <FormInput
            label="JSC/JDC/Class 8 ID/Roll Number"
            name="jsc_roll_no"
            register={register}
            errors={errors}
            isRequired
            filterType="numeric"
            maxLength={6}
            placeholder="6 Digits"
            tooltip={jscMeta.jsc_roll_no.tooltip}
            instruction={jscMeta.jsc_roll_no.instruction}
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Class 9 Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldRow label="Group:" isRequired error={errors.group_class_nine}>
            <select
              {...register('group_class_nine')}
              onChange={(e) => {
                register('group_class_nine').onChange(e);
                setValue('main_subject', '');
                setValue('fourth_subject', '');
              }}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
              {...register('main_subject')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
            label="4th Subject (Optional):"
            isRequired
            error={errors.fourth_subject}
            tooltip="Select your 4th subject. Options will appear based on your group and exclude your main subject"
          >
            <select
              {...register('fourth_subject')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
                onChange={(e) => handleNearbyOptionChange?.(e.target.value)}
                className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
          <FieldRow label="উপবৃত্তি পায় কিনা (Stipend Status):" isRequired error={errors.upobritti}>
            <select
              {...register('upobritti')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
              {...register('sorkari_brirti')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
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
              {...register('scout_status')}
              className="block w-full rounded border px-3 py-2 text-sm transition focus:ring-2 focus:ring-blue-300 focus:outline-none sm:text-base"
            >
              <option value="">Select Option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </FieldRow>
        </div>
      </SectionHeader>
    </>
  );
}
