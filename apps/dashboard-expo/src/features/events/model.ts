/** Events page helpers (dashboard/src/pages/Admin/Events.tsx): upcoming vs past, validation. */
import type { EventInput, SchoolEvent } from '@/lib/api';
import { dayValue } from '@/features/holidays/model';

export function splitEvents(list: readonly SchoolEvent[], today: string) {
  const upcoming = list.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = list.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

export function validateEvent(i: Pick<EventInput, 'title' | 'date'>) {
  const e: Partial<Record<'title' | 'date', string>> = {};
  if (!i.title.trim()) e.title = 'Title is required';
  if (Number.isNaN(dayValue(i.date))) e.date = 'Enter the date (YYYY-MM-DD)';
  return e;
}

export type EventWhen = 'upcoming' | 'past';

export interface EventFilters {
  /** Matches title or details. */
  q: string;
  location: string;
  /** Empty = both. */
  when: readonly EventWhen[];
}

const has = (hay: string, needle: string) =>
  hay.toLowerCase().includes(needle.trim().toLowerCase());

export function filterEvents(list: readonly SchoolEvent[], f: EventFilters, today: string) {
  return list.filter(
    (e) =>
      (!f.q.trim() || has(e.title, f.q) || has(e.details, f.q)) &&
      (!f.location.trim() || has(e.location, f.location)) &&
      (!f.when.length || f.when.includes(e.date >= today ? 'upcoming' : 'past')),
  );
}

export const eventsFiltered = (f: EventFilters) =>
  f.q.trim() !== '' || f.location.trim() !== '' || f.when.length > 0;

/** One page of a client-side list (the events API returns everything). */
export function pageOf<T>(rows: readonly T[], page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  return { rows: rows.slice((p - 1) * limit, p * limit), page: p, totalPages };
}

export const EVENT_DETAILS_MAX = 100;
