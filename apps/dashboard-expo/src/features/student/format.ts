export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "18 Oct 2026" from an ISO date or timestamp; '' when unparseable. */
export function formatDate(value: string): string {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}`;
}

/** Calendar cells for a month (leading blanks for the weekday offset), like the web view. */
export function calendarCells(year: number, month: number) {
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number; date: string } | null)[] = Array.from(
    { length: offset },
    () => null,
  );
  for (let day = 1; day <= days; day++) {
    cells.push({
      day,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }
  return cells;
}
