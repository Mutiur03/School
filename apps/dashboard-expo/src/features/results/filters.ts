/** Exam / class pickers shared by Marks entry and Class results (AddMarks.tsx, ViewMarks.tsx). */
import type { ClassMarksRow, Exam } from '@/lib/api';

export const GROUPS = ['Science', 'Humanities', 'Commerce'] as const;

/** Exam names of a session, in start-date order, without duplicates. */
export function examNames(exams: readonly Exam[], year: number): string[] {
  return [
    ...new Set(
      exams
        .filter((e) => e.exam_year === year)
        .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id)
        .map((e) => e.exam_name),
    ),
  ];
}

/** Classes an exam covers (ascending). */
export function examClasses(exams: readonly Exam[], year: number, name: string): number[] {
  const e = exams.find((x) => x.exam_year === year && x.exam_name === name);
  return e ? [...e.levels].sort((a, b) => a - b) : [];
}

/** Session choices: this year back `count - 1` years, plus any year that has exams. */
export function sessionYears(exams: readonly Exam[], current: number, count = 5): number[] {
  const ys = new Set<number>(Array.from({ length: count }, (_, i) => current - i));
  for (const e of exams) if (e.exam_year >= 2000 && e.exam_year <= current + 1) ys.add(e.exam_year);
  return [...ys].sort((a, b) => b - a);
}

/** Distinct sections of a roster, natural order. */
export const sectionsOf = (rows: readonly { section: string }[]) =>
  [...new Set(rows.map((r) => r.section).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );

/**
 * Class results table (ViewMarks.tsx): the subject columns (by priority, from the marks
 * present), the students in scope that have at least one entered mark, and how many have none.
 */
export function resultsTable(
  rows: readonly ClassMarksRow[],
  f: { section: string; group: string; search: string },
) {
  const priority = new Map<string, number>();
  for (const r of rows) {
    for (const m of r.marks) {
      const prev = priority.get(m.subject);
      if (prev === undefined || m.priority < prev) priority.set(m.subject, m.priority);
    }
  }
  const subjects = [...priority.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const scoped = rows.filter(
    (r) => (!f.section || r.section === f.section) && (!f.group || (r.group ?? '') === f.group),
  );
  const withMarks = scoped
    .filter((r) => r.marks.some((m) => m.marks !== null))
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.roll - b.roll ||
        a.name.localeCompare(b.name),
    );
  const q = f.search.trim().toLowerCase();
  const shown = q
    ? withMarks.filter((r) => r.name.toLowerCase().includes(q) || String(r.roll).includes(q))
    : withMarks;
  return {
    subjects,
    withMarks,
    shown,
    noMarks: scoped.length - withMarks.length,
    groups: [...new Set(rows.map((r) => r.group ?? '').filter(Boolean))].sort(),
  };
}

/** Subject name → total mark for one student (null = not entered). */
export const marksBySubject = (r: ClassMarksRow) =>
  Object.fromEntries(r.marks.map((m) => [m.subject, m.marks])) as Record<string, number | null>;
