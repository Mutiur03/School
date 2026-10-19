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
