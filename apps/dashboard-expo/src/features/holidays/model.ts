/** Pure helpers behind the Holidays page (dashboard/src/pages/Admin/Holidays.tsx). */
import type { Holiday, HolidayInput } from '@/lib/api';

const DAY_MS = 86_400_000;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC of a `YYYY-MM-DD` day (NaN when malformed). */
export const dayValue = (ymd: string) => (isoDay.test(ymd) ? Date.parse(`${ymd}T00:00:00Z`) : NaN);

export const todayYmd = (now = new Date()) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Inclusive length in days (1 for a single day). */
export function dayCount(h: Pick<Holiday, 'start_date' | 'end_date'>): number {
  const a = dayValue(h.start_date);
  const b = dayValue(h.end_date);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return Math.round((b - a) / DAY_MS) + 1;
}

/** Holidays that touch `year`. */
export const inYear = (list: readonly Holiday[], year: number) =>
  list.filter(
    (h) => Number(h.start_date.slice(0, 4)) <= year && Number(h.end_date.slice(0, 4)) >= year,
  );

/** Stats strip: count, distinct days off within the year, upcoming, optional. */
export function holidayStats(list: readonly Holiday[], year: number, today: string) {
  const days = new Set<string>();
  const lo = dayValue(`${year}-01-01`);
  const hi = dayValue(`${year}-12-31`);
  for (const h of list) {
    const a = dayValue(h.start_date);
    const b = dayValue(h.end_date);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    for (let t = Math.max(a, lo); t <= Math.min(b, hi); t += DAY_MS) {
      days.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  return {
    holidays: list.length,
    daysOff: days.size,
    // Still ahead or running today (web counts by end date).
    upcoming: list.filter((h) => (h.end_date || h.start_date) >= today).length,
    optional: list.filter((h) => h.is_optional).length,
  };
}

/** Year choices: the holidays' start and end years plus this year and next, newest first. */
export function yearOptions(list: readonly Holiday[], current: number): number[] {
  const ys = new Set<number>([current, current + 1]);
  for (const h of list) {
    for (const d of [h.start_date, h.end_date]) {
      const y = Number(d.slice(0, 4));
      if (y > 1900) ys.add(y);
    }
  }
  return [...ys].sort((a, b) => b - a);
}

export type HolidayType = 'mandatory' | 'optional';

/** Search title/description and filter by type (empty = both). */
export function filterHolidays(
  list: readonly Holiday[],
  q: string,
  types: readonly HolidayType[],
): Holiday[] {
  const needle = q.trim().toLowerCase();
  return list.filter(
    (h) =>
      (!needle ||
        h.title.toLowerCase().includes(needle) ||
        (h.description ?? '').toLowerCase().includes(needle)) &&
      (!types.length || types.includes(h.is_optional ? 'optional' : 'mandatory')),
  );
}

export function validateHoliday(i: HolidayInput): Partial<Record<keyof HolidayInput, string>> {
  const e: Partial<Record<keyof HolidayInput, string>> = {};
  if (!i.title.trim()) e.title = 'Title is required';
  if (Number.isNaN(dayValue(i.start_date))) e.start_date = 'Enter a start date (YYYY-MM-DD)';
  if (Number.isNaN(dayValue(i.end_date))) e.end_date = 'Enter an end date (YYYY-MM-DD)';
  if (!e.start_date && !e.end_date && i.end_date < i.start_date) {
    e.end_date = 'End date cannot be before the start date';
  }
  return e;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "15 Apr 2026" (en-GB short), timezone-safe. */
export function formatDay(ymd: string): string {
  if (!isoDay.test(ymd)) return ymd || '—';
  const [y, m, d] = ymd.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export const formatRange = (h: Pick<Holiday, 'start_date' | 'end_date'>) =>
  dayCount(h) > 1
    ? `${formatDay(h.start_date)} – ${formatDay(h.end_date)}`
    : formatDay(h.start_date);

/** Holidays covering one `YYYY-MM-DD` day (the web calendar's date popup). */
export const holidaysOn = (list: readonly Holiday[], ymd: string) =>
  list.filter((h) => h.start_date <= ymd && (h.end_date || h.start_date) >= ymd);

/** Days of `month` (0-based) in `year` that fall inside any holiday, as `YYYY-MM-DD`. */
export function holidayDaysInMonth(list: readonly Holiday[], year: number, month: number) {
  const days = new Set<string>();
  const last = new Date(year, month + 1, 0).getDate();
  const pre = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (let d = 1; d <= last; d++) {
    const ymd = `${pre}${String(d).padStart(2, '0')}`;
    if (holidaysOn(list, ymd).length) days.add(ymd);
  }
  return days;
}
