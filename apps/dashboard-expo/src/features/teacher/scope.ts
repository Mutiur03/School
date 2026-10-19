/**
 * Teacher class scope, read from the signed-in user's `levels` (login / refresh payload,
 * server/src/modules/auth/auth.service.ts: the teacher's class-teacher assignments for the
 * CURRENT year only).
 *
 * This is a narrowing hint for pickers, never an authorization decision: the server re-reads
 * the teacher's assignments from the database on every marks / marksheet request and answers
 * 403 for anything else. Because the payload only carries this year's levels, past years the
 * server would allow are simply not offered here (the UI may show less than the server allows,
 * never more).
 */
import type { AuthUser } from '@/lib/api/auth';

export interface TeacherLevel {
  year: number;
  cls: number;
  section: string;
}

export interface ClassScope {
  /** Years with at least one assignment, newest first. */
  years: number[];
  classes(year: number): number[];
  sections(year: number, cls: number): string[];
  /** "8A, 9B" for a year. */
  label(year: number): string;
  /** The single assignment of a year, when there is exactly one. */
  only(year: number): TeacherLevel | null;
}

const toInt = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

/** Valid `{ class_name, section, year }` rows from the session user; junk is dropped. */
export function parseTeacherLevels(user: AuthUser | null | undefined): TeacherLevel[] {
  const raw = user?.levels;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TeacherLevel[] = [];
  for (const l of raw) {
    if (typeof l !== 'object' || l === null) continue;
    const r = l as Record<string, unknown>;
    const year = toInt(r.year);
    const cls = toInt(r.class_name);
    const section = typeof r.section === 'string' ? r.section.trim() : '';
    if (year === null || cls === null || !section) continue;
    const k = `${year}:${cls}:${section}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ year, cls, section });
  }
  return out.sort((a, b) => b.year - a.year || a.cls - b.cls || a.section.localeCompare(b.section));
}

export function classScope(levels: readonly TeacherLevel[]): ClassScope {
  const inYear = (year: number) => levels.filter((l) => l.year === year);
  return {
    years: [...new Set(levels.map((l) => l.year))].sort((a, b) => b - a),
    classes: (year) => [...new Set(inYear(year).map((l) => l.cls))].sort((a, b) => a - b),
    sections: (year, cls) =>
      inYear(year)
        .filter((l) => l.cls === cls)
        .map((l) => l.section)
        .sort(),
    label: (year) =>
      inYear(year)
        .map((l) => `${l.cls}${l.section}`)
        .join(', '),
    only: (year) => {
      const list = inYear(year);
      return list.length === 1 ? list[0]! : null;
    },
  };
}

/** Admin (no scope): everything. Teacher: only classes they're assigned to in that year. */
export function narrowClasses(
  classes: readonly number[],
  scope: ClassScope | null,
  year: number,
): number[] {
  if (!scope) return [...classes];
  const mine = new Set(scope.classes(year));
  return classes.filter((c) => mine.has(c));
}

/** Admin: the given years. Teacher: only years they have assignments in (current year if none). */
export function narrowYears(
  years: readonly number[],
  scope: ClassScope | null,
  currentYear: number,
): number[] {
  if (!scope) return [...years];
  return scope.years.length ? scope.years : [currentYear];
}

/** Sections a teacher may pick (the server's roster is already limited to these). */
export function narrowSections(
  sections: readonly string[],
  scope: ClassScope | null,
  year: number,
  cls: number | null,
): string[] {
  if (!scope || cls === null) return [...sections];
  const mine = new Set(scope.sections(year, cls));
  return sections.filter((s) => mine.has(s));
}
