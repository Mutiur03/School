/** Class-teacher assignment logic (dashboard/src/pages/Admin/AddLevel.tsx), kept pure for tests. */
import type { Level } from '@/lib/api';

/** The web page's year options: next, current, previous. */
export const levelYearOptions = (current: number) => [current + 1, current, current - 1];

/** One year's assignments, filtered by class + "Teacher or class…" search, by class then section. */
export function filterLevels(
  levels: readonly Level[],
  f: { year: number; cls: number | null; search: string },
): Level[] {
  const q = f.search.trim().toLowerCase();
  return levels
    .filter(
      (l) =>
        l.year === f.year &&
        (f.cls === null || l.class_name === f.cls) &&
        (!q || l.teacher_name.toLowerCase().includes(q) || `class ${l.class_name}`.includes(q)),
    )
    .sort((a, b) => a.class_name - b.class_name || a.section.localeCompare(b.section));
}

/** Another assignment for the same class + section + year (the server rejects duplicates). */
export function duplicateLevel(
  levels: readonly Level[],
  v: { class_name: number; section: string; year: number },
  editingId: number | null,
): Level | undefined {
  const section = v.section.trim().toUpperCase();
  return levels.find(
    (l) =>
      l.id !== editingId &&
      l.year === v.year &&
      l.class_name === v.class_name &&
      l.section.toUpperCase() === section,
  );
}

/** Sections of a year that still lack a class teacher (classes × A/B). */
export function unassigned(
  levels: readonly Level[],
  year: number,
  classes: readonly number[],
  sections: readonly string[],
): string[] {
  const have = new Set(
    levels.filter((l) => l.year === year).map((l) => `${l.class_name}${l.section}`),
  );
  return classes.flatMap((c) => sections.map((s) => `${c}${s}`)).filter((k) => !have.has(k));
}
