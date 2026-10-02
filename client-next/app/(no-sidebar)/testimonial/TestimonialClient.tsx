'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {
  TESTIMONIAL_FIRST_YEAR,
  TESTIMONIAL_GENDERS,
  filterBanglaInput,
  filterEnglishInput,
  filterNumericInput,
  testimonialExamOptions,
  testimonialSchema,
  type TestimonialData,
  type TestimonialInput,
  type TestimonialKind,
} from '@school/shared-schemas';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - TESTIMONIAL_FIRST_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);
const EXAM_LABEL: Record<string, string> = {
  SSC: 'SSC',
  JSC: 'JSC',
  '6': 'Class 6',
  '7': 'Class 7',
  '8': 'Class 8',
};
const INPUT =
  'w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

async function errMsg(error: unknown) {
  // Error body comes back as a Blob because of responseType: 'blob'.
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      return JSON.parse(await error.response.data.text())?.message ?? 'Failed to generate PDF';
    } catch {
      /* fall through */
    }
  }
  return 'Failed to generate PDF';
}

export default function TestimonialClient({ askGender }: { askGender: boolean }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TestimonialInput, unknown, TestimonialData>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      kind: 'board',
      exam: 'SSC',
      passing_year: CURRENT_YEAR,
      ...(askGender && { gender: 'Male' as const }),
    },
  });

  const year = Number(useWatch({ control, name: 'passing_year' }));
  const exam = useWatch({ control, name: 'exam' });
  const examOptions = useMemo(
    () => [
      ...testimonialExamOptions('class', year),
      ...testimonialExamOptions('board', year).reverse(),
    ],
    [year],
  );
  const kind: TestimonialKind = exam === 'SSC' || exam === 'JSC' ? 'board' : 'class';

  useEffect(() => {
    if (examOptions.includes(exam)) return;
    // Class 8 and JSC are the same stage either side of 2020; keep the student's intent.
    const swap = exam === '8' ? 'JSC' : exam === 'JSC' ? '8' : '';
    setValue('exam', examOptions.includes(swap) ? swap : examOptions[examOptions.length - 1]);
  }, [examOptions, exam, setValue]);

  useEffect(() => {
    setValue('kind', kind);
  }, [kind, setValue]);

  async function onSubmit(body: TestimonialData) {
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const tab = window.open('', '_blank');
    try {
      const res = await axios.post('/api/testimonial/pdf', body, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      toast.error(await errMsg(error));
    }
  }

  const err = (name: keyof TestimonialInput) => {
    const e = (errors as FieldErrors<TestimonialInput>)[name];
    return e ? <p className="mt-1 text-xs text-red-600">{String(e.message)}</p> : null;
  };

  const text = (
    name: keyof TestimonialInput,
    label: string,
    filter: (v: string) => string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
        {label} <span className="text-red-600">*</span>
      </label>
      <input
        id={name}
        className={INPUT}
        spellCheck={false}
        {...extra}
        {...register(name, { setValueAs: (v) => filter(String(v ?? '')) })}
      />
      {err(name)}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-800">Testimonial</h1>
      <p className="mb-8 text-gray-600">
        Fill in your information to download your testimonial (Bangla &amp; English) as a PDF.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="passing_year" className="mb-1 block text-sm font-medium text-gray-700">
              Passing year <span className="text-red-600">*</span>
            </label>
            <select id="passing_year" className={INPUT} {...register('passing_year')}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {err('passing_year')}
          </div>
          <div>
            <label htmlFor="exam" className="mb-1 block text-sm font-medium text-gray-700">
              Class / Exam passed <span className="text-red-600">*</span>
            </label>
            <select id="exam" className={INPUT} defaultValue="SSC" {...register('exam')}>
              {examOptions.map((o) => (
                <option key={o} value={o}>
                  {EXAM_LABEL[o]}
                </option>
              ))}
            </select>
            {err('exam')}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {text('student_name_bn', 'শিক্ষার্থীর নাম (বাংলায়)', filterBanglaInput, {})}
          {text('student_name_en', 'Student name (English)', filterEnglishInput, {})}
          {text('father_name_bn', 'পিতার নাম (বাংলায়)', filterBanglaInput, {})}
          {text('father_name_en', "Father's name (English)", filterEnglishInput, {})}
          {text('mother_name_bn', 'মাতার নাম (বাংলায়)', filterBanglaInput, {})}
          {text('mother_name_en', "Mother's name (English)", filterEnglishInput, {})}
          {askGender && (
            <div>
              <label htmlFor="gender" className="mb-1 block text-sm font-medium text-gray-700">
                Gender <span className="text-red-600">*</span>
              </label>
              <select id="gender" className={INPUT} {...register('gender')}>
                {TESTIMONIAL_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {err('gender')}
            </div>
          )}
          <div>
            <label htmlFor="dob" className="mb-1 block text-sm font-medium text-gray-700">
              Date of birth <span className="text-red-600">*</span>
            </label>
            <input id="dob" type="date" className={INPUT} {...register('dob')} />
            {err('dob')}
          </div>
        </div>

        {kind === 'board' && (
          <div className="grid gap-5 sm:grid-cols-2">
            {text('roll', 'Roll number', filterNumericInput, {
              inputMode: 'numeric',
            })}
            {text('registration_no', 'Registration number', filterNumericInput, {
              inputMode: 'numeric',
            })}
            {text('gpa', 'GPA', (v) => v.replace(/[^\d.]/g, '').slice(0, 4), {
              inputMode: 'decimal',
            })}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Generating PDF…' : 'Open Testimonial PDF'}
        </button>
      </form>
    </div>
  );
}
