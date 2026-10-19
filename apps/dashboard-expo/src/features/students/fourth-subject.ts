/**
 * 4th (optional) subject on the Student List, replicating dashboard/src/pages/Admin/StudentList
 * (FourthSubjectField, the 4th-subject filter and "Bulk 4th subject"). Only classes 9–10 have
 * one. Options are this session's non-main subjects of the student's class whose group is empty
 * or matches. The web lists every year's subjects; the app keeps to the session year so a name
 * never shows twice. The server re-checks school, class, type and group.
 */
import type { Subject } from '@/lib/api';

type SubjectLike = Pick<Subject, 'id' | 'name' | 'class' | 'year' | 'group' | 'subject_type'>;

export const hasFourthSubject = (cls: number) => cls === 9 || cls === 10;

/** Choices for one student (or for a class + group in the bulk dialog). */
export function fourthSubjectChoices(
  subjects: readonly SubjectLike[],
  cls: number,
  group: string | null | undefined,
  year: number,
): SubjectLike[] {
  if (!hasFourthSubject(cls)) return [];
  return subjects
    .filter(
      (s) =>
        s.subject_type !== 'main' &&
        s.class === cls &&
        s.year === year &&
        (!group || !s.group || s.group === group),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const FOURTH_NONE = 'none';

/** Filter options: "None" plus one entry per subject name (ids joined, as the web does). */
export function fourthFilterOptions(
  available: readonly { id: number; name: string }[],
): { value: string; label: string }[] {
  const byName = new Map<string, number[]>();
  for (const s of available) byName.set(s.name, [...(byName.get(s.name) ?? []), s.id]);
  return [
    { value: FOURTH_NONE, label: 'None' },
    ...[...byName].map(([name, ids]) => ({ value: ids.join(','), label: name })),
  ];
}

/** The `fourthSubjects` query values for the ticked filter options. */
export const fourthFilterParam = (ticked: readonly string[]) =>
  ticked.flatMap((v) => v.split(',')).filter(Boolean);

export const BULK_CLEAR = '__clear__';

/** The web's confirmation wording. */
export function bulkFourthMessage(
  cls: number,
  group: string,
  year: number,
  subjectName: string | null,
): string {
  return subjectName === null
    ? `Clear 4th subject for all Class ${cls} ${group} students (${year})?`
    : `Set 4th subject to "${subjectName}" for all Class ${cls} ${group} students (${year})? This overwrites existing 4th subjects.`;
}

export const bulkFourthDone = (count: number) => `4th subject updated for ${count} student(s)`;
