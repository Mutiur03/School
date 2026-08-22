'use client';

import { useRouter } from 'next/navigation';

interface AcademicYearSelectProps {
  years: number[];
  selectedYear: number;
  basePath?: string;
  label?: string;
}

function AcademicYearSelect({
  years,
  selectedYear,
  basePath = '/admission/results',
  label = 'Select Academic Year',
}: AcademicYearSelectProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="yearSelect" className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id="yearSelect"
        value={selectedYear}
        onChange={(event) => {
          router.push(`${basePath}?year=${event.target.value}`);
        }}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 transition-all hover:border-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

export default AcademicYearSelect;
