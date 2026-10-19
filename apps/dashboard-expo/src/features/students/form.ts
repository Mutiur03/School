/**
 * Add / edit student form model, mirroring dashboard/src/pages/Admin/StudentList.tsx: values are
 * the shared `studentFormSchema` shape (strings, as typed), defaults come from the list row, and
 * submit splits them into the personal body (PUT /api/students/:id) and the academic body
 * (PATCH /api/enrollments/:id) exactly like the web `formMutation`.
 */
import type { StudentFormSchemaData } from '@school/shared-schemas';
import type { StudentAcademicInput, StudentPersonalInput, StudentRow } from '@/lib/api';

export type StudentFormValues = StudentFormSchemaData;

/** Classes the web form offers. */
export const STUDENT_CLASSES = [6, 7, 8, 9, 10] as const;

export const needsGroup = (cls: string | number) => Number(cls) === 9 || Number(cls) === 10;

export function studentDefaults(row?: StudentRow | null, defaultClass?: number): StudentFormValues {
  return {
    name: row?.name ?? '',
    father_name: row?.father_name ?? '',
    mother_name: row?.mother_name ?? '',
    father_phone: row?.father_phone ?? '',
    mother_phone: row?.mother_phone ?? '',
    roll: row ? String(row.roll) : '',
    section: row?.section ?? '',
    village: row?.village ?? '',
    post_office: row?.post_office ?? '',
    upazila: row?.upazila ?? '',
    district: row?.district ?? '',
    religion: (row?.religion ?? '') as StudentFormValues['religion'],
    dob: row?.dob ?? '',
    class: row ? String(row.class) : defaultClass ? String(defaultClass) : '',
    group: row?.group ?? '',
    has_stipend: row?.has_stipend ?? false,
    available: row?.available ?? true,
  };
}

export function toStudentPayload(v: StudentFormValues): {
  personal: StudentPersonalInput;
  academic: StudentAcademicInput;
} {
  return {
    personal: {
      name: v.name || '',
      father_name: v.father_name || '',
      mother_name: v.mother_name || '',
      father_phone: v.father_phone || '',
      mother_phone: v.mother_phone?.trim() ? v.mother_phone.trim() : null,
      village: v.village || '',
      post_office: v.post_office || '',
      upazila: v.upazila || '',
      district: v.district || '',
      dob: v.dob || '',
      religion: v.religion || '',
      available: Boolean(v.available),
      has_stipend: Boolean(v.has_stipend),
    },
    academic: {
      roll: v.roll || '',
      class: v.class || '',
      section: (v.section || '').toUpperCase(),
      group: needsGroup(v.class) ? v.group || '' : '',
    },
  };
}

/** The result toast after an add, like notifyBulkStudentUpload() on the web. */
export function addedMessage(created: number, requested: number): string {
  if (created === 0) return 'No student was added (already exists?).';
  if (created < requested) return `Added ${created} of ${requested} students.`;
  return 'Student added. Save the login sheet: it holds the only copy of the password.';
}

/** The web's notifyBulkStudentUpload wording for a spreadsheet import. */
export function importedMessage(created: number, requested: number): string {
  if (created === 0) return 'No new students inserted: all rows were duplicates (skipped).';
  if (created < requested)
    return `Added ${created} of ${requested} students. Login sheet saved for the new rows only.`;
  return `Added ${created} student${created === 1 ? '' : 's'}. Save the login sheet: it holds the only copy of the passwords.`;
}

export const credentialsFileName = (date = new Date()) =>
  `students_credentials_${date.toISOString().slice(0, 10)}.xlsx`;
