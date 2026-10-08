/**
 * Bump when marksheet PDF layout / draw code changes.
 * Open exams (result_date not passed) go stale and regenerate.
 * Frozen exams pin `snapshot_design_version` at generation — same rule as
 * head/class-teacher: finalized PDFs keep the design that signed them.
 */
export const MARKSHEET_DESIGN_VERSION = '15';

/** marksheet_sessions.student_id = 0 means the school-year "all" session PDF. */
export const SESSION_YEAR_STUDENT_ID = 0;

export const marksheetStudentWhere = (schoolId: number, studentId: number, examId: number) => ({
  student_id_exam_id_school: { school_id: schoolId, student_id: studentId, exam_id: examId },
});

export const marksheetBundleWhere = (
  schoolId: number,
  examId: number,
  cls: number,
  section: string,
) => ({
  exam_id_class_section_school: {
    school_id: schoolId,
    exam_id: examId,
    class: cls,
    section,
  },
});

export const marksheetSessionWhere = (schoolId: number, year: number, studentId: number) => ({
  marksheet_session_scope: { school_id: schoolId, year, student_id: studentId },
});

export const bundleSectionKey = (bundleSection?: string): string => bundleSection?.trim() || 'ALL';

export function parseBundleSections(bundleSection: string): string[] | undefined {
  if (bundleSection === 'ALL') return undefined;
  if (bundleSection.includes('+')) {
    return bundleSection.split('+').filter(Boolean);
  }
  return [bundleSection];
}

export function enrollmentWhereForBundleSection(
  schoolId: number,
  cls: number,
  year: number,
  bundleSection: string,
): { school_id: number; class: number; year: number; section?: string | { in: string[] } } {
  const where: {
    school_id: number;
    class: number;
    year: number;
    section?: string | { in: string[] };
  } = { school_id: schoolId, class: cls, year };
  const sections = parseBundleSections(bundleSection);
  if (sections?.length === 1) where.section = sections[0];
  else if (sections && sections.length > 1) where.section = { in: sections };
  return where;
}

type SignatoryPerson = { name: string | null; signature: string | null };
type SignatoryTeacher = SignatoryPerson & { phone: string | null };

/** Frozen name/signature/phone pinned on a cache row (`snapshot_signatory_detail`). */
export type SignatoryDetail = {
  head?: SignatoryPerson | null;
  teacher?: SignatoryTeacher | null;
  teachers?: Record<string, SignatoryTeacher>;
};

export function parseSignatoryDetail(raw: unknown): SignatoryDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SignatoryDetail;
}
