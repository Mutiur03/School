/** Subjects list filters (dashboard/src/pages/Admin/NewSubject.tsx column filters). */
import type { Subject, SubjectType } from '@/lib/api';

export interface SubjectFilters {
  q: string;
  /** Empty = all. 'General' matches subjects with no group. */
  groups: readonly string[];
  types: readonly SubjectType[];
}

export const subjectsFiltered = (f: SubjectFilters) =>
  f.q.trim() !== '' || f.groups.length > 0 || f.types.length > 0;

export function filterSubjects(list: readonly Subject[], f: SubjectFilters): Subject[] {
  const needle = f.q.trim().toLowerCase();
  return list.filter(
    (s) =>
      (!needle || s.name.toLowerCase().includes(needle)) &&
      (!f.groups.length || f.groups.includes(s.group || 'General')) &&
      (!f.types.length || f.types.includes(s.subject_type)),
  );
}

/** The CQ / MCQ / Practical rows of the details popup (all three, as on the web). */
export const markParts = (s: Subject) => [
  { label: 'CQ', mark: s.cq_mark, pass: s.cq_pass_mark },
  { label: 'MCQ', mark: s.mcq_mark, pass: s.mcq_pass_mark },
  { label: 'Practical', mark: s.practical_mark, pass: s.practical_pass_mark },
];
