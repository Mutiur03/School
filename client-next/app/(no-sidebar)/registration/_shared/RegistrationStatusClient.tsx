'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Loader2, SearchX } from 'lucide-react';
import {
  filterNumericInput,
  registrationLookupSchema,
  type RegistrationLookupData,
  type RegistrationLookupInput,
} from '@school/shared-schemas';
import { parseRollRange } from '@/lib/rollRange';

const SECTION_OPTIONS = ['A', 'B'];

function errMsg(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string })?.message ?? fallback;
  }
  return fallback;
}

type YearSettings = {
  a_sec_roll?: string | null;
  b_sec_roll?: string | null;
};

type Props = {
  classSlug: 'class-6' | 'class-8' | 'junior-scholarship' | 'class-9';
  title: string;
  /** Last 3 years (most recent first) that have registration settings configured. */
  years: Array<string | number>;
  /** Roll-range settings for each of those years, keyed by year as a string. */
  settingsByYear: Record<string, YearSettings>;
};

export default function RegistrationStatusClient({
  classSlug,
  title,
  years,
  settingsByYear,
}: Props) {
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  const yearOptions = years.length > 0 ? years.map(String) : [String(new Date().getFullYear())];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationLookupInput, unknown, RegistrationLookupData>({
    resolver: zodResolver(registrationLookupSchema),
    defaultValues: {
      year: yearOptions[0],
      section: SECTION_OPTIONS[0],
      roll: '',
      phone: '',
    },
    mode: 'onSubmit',
  });

  const selectedYear = useWatch({ control, name: 'year' });
  const selectedSection = useWatch({ control, name: 'section' });

  const availableRolls = useMemo(() => {
    const yearSettings = settingsByYear[String(selectedYear)];
    if (!yearSettings) return [];
    const rollRange = selectedSection === 'A' ? yearSettings.a_sec_roll : yearSettings.b_sec_roll;
    return parseRollRange(rollRange);
  }, [settingsByYear, selectedYear, selectedSection]);

  useEffect(() => {
    setValue('roll', '');
  }, [selectedYear, selectedSection, setValue]);

  async function onSubmit(body: RegistrationLookupData) {
    setNotFound(false);
    try {
      const { data } = await axios.post(`/api/reg/${classSlug}/form/find`, body);
      const id = data.data?.id as string | undefined;
      if (!id) {
        setNotFound(true);
        return;
      }
      router.push(`/registration/${classSlug}/confirm/${id}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      alert(errMsg(error, 'Could not check registration status'));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-800">{title}</h1>
      <p className="mb-8 text-gray-600">
        Select year, section, roll, and your registered mobile number to view your registration
        confirmation.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        noValidate
      >
        <div>
          <label htmlFor="year" className="mb-1 block text-sm font-medium text-gray-700">
            Year
          </label>
          <select
            id="year"
            {...register('year')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {errors.year && <p className="mt-1 text-xs text-red-600">{errors.year.message}</p>}
        </div>
        <div>
          <label htmlFor="section" className="mb-1 block text-sm font-medium text-gray-700">
            Section
          </label>
          <select
            id="section"
            {...register('section')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {SECTION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.section && <p className="mt-1 text-xs text-red-600">{errors.section.message}</p>}
        </div>
        <div>
          <label htmlFor="roll" className="mb-1 block text-sm font-medium text-gray-700">
            Roll
          </label>
          <select
            id="roll"
            {...register('roll')}
            disabled={availableRolls.length === 0}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            {availableRolls.length === 0 ? (
              <option value="">No rolls available</option>
            ) : (
              <>
                <option value="">Select Roll Number</option>
                {availableRolls.map((roll) => (
                  <option key={roll} value={roll}>
                    {roll}
                  </option>
                ))}
              </>
            )}
          </select>
          {errors.roll && <p className="mt-1 text-xs text-red-600">{errors.roll.message}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
            Mobile Number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            spellCheck={false}
            {...register('phone', {
              setValueAs: (v) => filterNumericInput(String(v ?? '')).slice(0, 11),
            })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500"
            placeholder="e.g. 01712345678"
            autoComplete="tel"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          <p className="mt-1 text-xs text-gray-500">
            Use the father&apos;s, mother&apos;s, or guardian&apos;s phone number given at
            registration.
          </p>
        </div>

        {notFound && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <SearchX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>No registration found for the given details.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Checking…' : 'Check Status'}
        </button>
      </form>
    </div>
  );
}
