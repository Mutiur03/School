/**
 * Exam setup page logic (dashboard/src/pages/Admin/ExamPDFRoutine.tsx + exam-form-dialog.tsx),
 * kept pure so it is unit-tested. Validation mirrors createExamSchema, plus the date order the
 * web form enforces through its date pickers.
 */
import type { Exam, ExamInput, ExamType } from '@/lib/api';

export type ExamStatusFilter = 'all' | 'draft' | 'published' | 'year-end';

export const EXAM_STATUS_OPTIONS: { value: ExamStatusFilter; label: string }[] = [
  { value: 'all', label: 'All exams' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'year-end', label: 'Year-end' },
];

export interface ExamFilters {
  status: ExamStatusFilter;
  cls: number | null;
  search: string;
}

export function filterExams(exams: readonly Exam[], f: ExamFilters): Exam[] {
  const q = f.search.trim().toLowerCase();
  return exams.filter(
    (e) =>
      (f.status === 'all' ||
        (f.status === 'draft' && !e.visible) ||
        (f.status === 'published' && e.visible) ||
        (f.status === 'year-end' && e.is_year_end)) &&
      (f.cls === null || e.levels.includes(f.cls)) &&
      (!q || e.exam_name.toLowerCase().includes(q)),
  );
}

export function examSummary(exams: readonly Exam[]) {
  return {
    total: exams.length,
    published: exams.filter((e) => e.visible).length,
    routines: exams.filter((e) => !!e.routine).length,
    yearEnd: exams.filter((e) => e.is_year_end).length,
  };
}

/** Year selector: current+1 … current−3 plus any year that has exams, newest first. */
export function examYearOptions(exams: readonly Exam[], current: number): number[] {
  const years = new Set<number>([current + 1, current, current - 1, current - 2, current - 3]);
  for (const e of exams) if (e.exam_year) years.add(e.exam_year);
  return [...years].sort((a, b) => b - a);
}

export interface ExamFormValues {
  exam_type_id: number | null;
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
  return_date: string;
}

export type ExamFormErrors = Partial<Record<keyof ExamFormValues, string>>;

export const emptyExamForm = (year: number): ExamFormValues => ({
  exam_type_id: null,
  exam_year: year,
  levels: [],
  start_date: '',
  end_date: '',
  result_date: '',
  return_date: '',
});

export const examFormFrom = (e: Exam): ExamFormValues => ({
  exam_type_id: e.exam_type_id,
  exam_year: e.exam_year,
  levels: [...e.levels],
  start_date: e.start_date,
  end_date: e.end_date,
  result_date: e.result_date,
  return_date: e.return_date ?? '',
});

export function toggleLevel(levels: readonly number[], cls: number): number[] {
  return levels.includes(cls)
    ? levels.filter((c) => c !== cls)
    : [...levels, cls].sort((a, b) => a - b);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function validateExamForm(v: ExamFormValues): ExamFormErrors {
  const e: ExamFormErrors = {};
  if (!v.exam_type_id || v.exam_type_id <= 0) e.exam_type_id = 'Exam type is required';
  if (!Number.isInteger(v.exam_year) || v.exam_year < 2000 || v.exam_year > 2100)
    e.exam_year = 'Year must be between 2000 and 2100';
  if (v.levels.length === 0) e.levels = 'Select at least one class.';
  const dates = [
    ['start_date', 'Start date is required'],
    ['end_date', 'End date is required'],
    ['result_date', 'Result date is required'],
  ] as const;
  for (const [k, msg] of dates) {
    const s = v[k].trim();
    if (!s) e[k] = msg;
    else if (!YMD.test(s)) e[k] = 'Use YYYY-MM-DD';
  }
  if (v.return_date.trim() && !YMD.test(v.return_date.trim())) e.return_date = 'Use YYYY-MM-DD';
  if (!e.start_date && !e.end_date && v.end_date < v.start_date)
    e.end_date = 'End date must be on or after the start date';
  if (!e.end_date && !e.result_date && v.result_date < v.end_date)
    e.result_date = 'Result date must be on or after the end date';
  return e;
}

/** Valid form → the API input (call validateExamForm first). */
export function toExamInput(v: ExamFormValues): ExamInput {
  const input: ExamInput = {
    exam_type_id: v.exam_type_id ?? 0,
    exam_year: v.exam_year,
    levels: v.levels,
    start_date: v.start_date,
    end_date: v.end_date,
    result_date: v.result_date,
  };
  if (v.return_date.trim()) input.return_date = v.return_date;
  return input;
}

export const typeLabel = (t: ExamType) => (t.is_year_end ? `${t.name} (year end)` : t.name);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-03-04` → `4 Mar 2026`; empty → `—`. */
export function formatYmd(s: string | null | undefined): string {
  if (!s || !YMD.test(s)) return '—';
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}

export function formatExamRange(e: Pick<Exam, 'start_date' | 'end_date'>): string {
  if (!e.start_date) return '—';
  if (!e.end_date || e.end_date === e.start_date) return formatYmd(e.start_date);
  return `${formatYmd(e.start_date)} – ${formatYmd(e.end_date)}`;
}

export const classList = (levels: readonly number[]) =>
  levels.length ? levels.map((c) => `Class ${c}`).join(', ') : '—';
