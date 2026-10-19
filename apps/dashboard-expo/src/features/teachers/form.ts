/** Add / edit teacher form model (teacherFormSchema from packages/shared-schemas). */
import type { TeacherFormSchemaData } from '@school/shared-schemas';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import type { TeacherInput, TeacherRow } from '@/lib/api';

export type TeacherFormValues = TeacherFormSchemaData;

export const teacherDefaults = (t?: TeacherRow | null): TeacherFormValues => ({
  name: t?.name ?? '',
  email: t?.email ?? '',
  phone: t?.phone ?? '',
  designation: t?.designation ?? '',
  address: t?.address ?? '',
});

/** Same trimming the schema applies; email lower-cased (the server matches it exactly). */
export const toTeacherInput = (v: TeacherFormValues): TeacherInput => ({
  name: v.name.trim(),
  email: v.email.trim().toLowerCase(),
  phone: v.phone.trim(),
  designation: v.designation.trim(),
  address: v.address.trim(),
});

/**
 * Teacher List, as the web loads it: the first 200 teachers in one request (the server's page
 * cap; it already drops unavailable ones), then search, sort and paging in memory, so header
 * sorting covers the whole list rather than one server page.
 */
export const TEACHER_FETCH_LIMIT = 200;
export const TEACHER_SORT_KEYS = ['name', 'email', 'designation'] as const;
export type TeacherSortKey = (typeof TEACHER_SORT_KEYS)[number];

export function teacherListView(
  rows: readonly TeacherRow[],
  search: string,
  sort: TableSort<TeacherSortKey> | null,
): TeacherRow[] {
  const q = search.trim().toLowerCase();
  const hits = q
    ? rows.filter((t) =>
        [t.name, t.email, t.phone, t.designation ?? '', t.address ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : rows;
  return sortRows(hits, sort, {
    name: (t) => t.name,
    email: (t) => t.email,
    designation: (t) => t.designation,
  });
}
