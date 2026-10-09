'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FileText, Loader2 } from 'lucide-react';
import {
  TESTIMONIAL_FIRST_YEAR,
  TESTIMONIAL_GENDERS,
  filterBanglaInput,
  filterEnglishInput,
  filterNumericInput,
  testimonialExamOptions,
  testimonialRequiresRollRegistration,
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
const BN_ROLE = { student: 'শিক্ষার্থীর', father: 'পিতার', mother: 'মাতার' } as const;
const INPUT =
  'h-10 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 aria-[invalid=true]:border-destructive';
const LABEL = 'mb-1.5 block text-[13px] font-medium text-slate-800';

/** Keeps GPA typing valid: one digit 0-5, optional dot, up to 2 decimals (e.g. 4.75). */
function filterGpa(value: string) {
  const [whole = '', ...rest] = value.replace(/[^\d.]/g, '').split('.');
  const digit = /^[0-5]/.test(whole) ? whole[0] : '';
  if (!digit) return '';
  return rest.length ? `${digit}.${rest.join('').slice(0, 2)}` : digit;
}

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

export default function TestimonialClient({
  schoolGender,
}: {
  schoolGender: 'Boys' | 'Girls' | null;
}) {
  const askGender = !schoolGender;
  const studentPrefix =
    schoolGender === 'Boys' ? 'Md' : schoolGender === 'Girls' ? 'Mst' : 'Md/Mst';
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
  const requiresRollRegistration = testimonialRequiresRollRegistration(exam, year);

  useEffect(() => {
    if (examOptions.includes(exam)) return;
    // Class 8 and JSC are the same stage either side of the JSC start year; keep the intent.
    const swap = exam === '8' ? 'JSC' : exam === 'JSC' ? '8' : '';
    setValue('exam', examOptions.includes(swap) ? swap : examOptions[examOptions.length - 1]);
  }, [examOptions, exam, setValue]);

  useEffect(() => {
    setValue('kind', kind);
  }, [kind, setValue]);

  async function onSubmit(body: TestimonialData) {
    setPdfUrl(null);
    try {
      const res = await axios.post('/api/testimonial/pdf', body, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      // Opened only once the server has sent the PDF. If the browser blocks the popup
      // (the click's permission can expire while generating), offer a link instead.
      if (!window.open(url, '_blank')) setPdfUrl(url);
    } catch (error) {
      toast.error(await errMsg(error));
    }
  }

  const err = (name: keyof TestimonialInput) => {
    const e = (errors as FieldErrors<TestimonialInput>)[name];
    return e ? (
      <p id={`${name}-error`} className="text-destructive mt-1 text-xs">
        {String(e.message)}
      </p>
    ) : null;
  };

  const text = (
    name: keyof TestimonialInput,
    label: string,
    filter: (v: string) => string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <div>
      <label htmlFor={name} className={LABEL}>
        {label} <span className="text-destructive">*</span>
      </label>
      <input
        id={name}
        className={INPUT}
        spellCheck={false}
        aria-invalid={!!errors[name]}
        aria-describedby={
          [hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(' ') ||
          undefined
        }
        {...extra}
        {...register(name, { setValueAs: (v) => filter(String(v ?? '')) })}
        onInput={(e) => {
          // setValueAs only shapes the submitted value; rewrite the field itself while typing.
          const input = e.currentTarget;
          const next = filter(input.value);
          if (next !== input.value) input.value = next;
        }}
      />
      {hint && (
        <p id={`${name}-hint`} className="text-muted-foreground mt-1 text-xs leading-4">
          {hint}
        </p>
      )}
      {err(name)}
    </div>
  );

  // Bangla and English name for one person.
  const person = (title: string, key: 'student' | 'father' | 'mother', hint: string) => (
    <>
      {text(
        `${key}_name_bn` as keyof TestimonialInput,
        `${BN_ROLE[key]} নাম (বাংলায়)`,
        filterBanglaInput,
      )}
      {text(
        `${key}_name_en` as keyof TestimonialInput,
        `${title}'s name (English)`,
        filterEnglishInput,
        {},
        hint,
      )}
    </>
  );

  // Titled group of fields inside the form; groups are divided by a hairline, not boxed.
  const group = (title: string, children: React.ReactNode) => (
    <div
      role="group"
      aria-label={title}
      className="grid gap-x-4 gap-y-5 border-t border-slate-200 pt-7 first:border-t-0 first:pt-0 sm:grid-cols-2"
    >
      {/* <h2 className="text-sm font-semibold text-slate-900 sm:col-span-2">{title}</h2> */}
      {children}
    </div>
  );

  return (
    <div className="px-4 pb-16 pt-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold leading-none tracking-tighter text-slate-900 md:text-4xl">
          Certificate (প্রত্যয়নপত্র)
        </h1>
        <p className="mb-6 mt-3 text-sm leading-relaxed text-slate-600">
          Enter details exactly as in the school record. You get one PDF: a Bangla page followed by
          an English page.
        </p>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 sm:p-8"
          noValidate
        >
          {group(
            'Exam',
            <>
              <div>
                <label htmlFor="exam" className={LABEL}>
                  Class / Exam passed <span className="text-destructive">*</span>
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
              <div>
                <label htmlFor="passing_year" className={LABEL}>
                  Passing year <span className="text-destructive">*</span>
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
              {requiresRollRegistration && (
                <>
                  {text('roll', 'Roll number', (v) => filterNumericInput(v).slice(0, 6), {
                    inputMode: 'numeric',
                  })}
                  {text(
                    'registration_no',
                    'Registration number',
                    (v) => filterNumericInput(v).slice(0, 10),
                    { inputMode: 'numeric' },
                  )}
                  {text('gpa', 'GPA', filterGpa, { inputMode: 'decimal' })}
                </>
              )}
            </>,
          )}

          {group(
            'Student',
            <>
              {person(
                'Student',
                'student',
                `${studentPrefix} এরপর (.) ফুলস্টপ আছে কিনা ভালোভাবে দেখে নিন।`,
              )}
              <div>
                <label htmlFor="dob" className={LABEL}>
                  Date of birth <span className="text-destructive">*</span>
                </label>
                <input
                  id="dob"
                  type="date"
                  className={INPUT}
                  aria-invalid={!!errors.dob}
                  {...register('dob')}
                />
                {err('dob')}
              </div>
              {askGender && (
                <div>
                  <label htmlFor="gender" className={LABEL}>
                    Gender <span className="text-destructive">*</span>
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
            </>,
          )}

          {group(
            'Parents',
            <>
              {person('Father', 'father', 'Md এরপর (.) ফুলস্টপ আছে কিনা ভালোভাবে দেখে নিন।')}
              {person('Mother', 'mother', 'Mst এরপরে (.) ফুলস্টপ আছে কিনা ভালোভাবে দেখে নিন।')}
            </>,
          )}

          {group(
            'Contact',
            text('mobile', 'Mobile number', (v) => filterNumericInput(v).slice(0, 11), {
              inputMode: 'tel',
              autoComplete: 'tel',
            }),
          )}

          <div className="border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Generating PDF…' : 'Open certificate PDF'}
            </button>
            {isSubmitting && (
              <p role="status" className="mt-3 text-center text-sm text-slate-600">
                Generating your certificate, please wait…
              </p>
            )}
            {pdfUrl && !isSubmitting && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                <FileText className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                Your certificate is ready. Open PDF
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
