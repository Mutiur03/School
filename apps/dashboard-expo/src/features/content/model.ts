/** Pure helpers shared by the batch-6 content screens (site PDFs, admissions, registrations,
 * certificates, gallery). Kept free of React so they are unit-tested. */
import type { AdmissionResultRow, CertificateList, GalleryGroup, SyllabusRow } from '@/lib/api';
import { formatDay } from '@/features/holidays/model';

/** "15 Apr 2026" for an ISO timestamp or YYYY-MM-DD; '—' when empty. */
export const dayOf = (iso: string | null | undefined) => (iso ? formatDay(iso.slice(0, 10)) : '—');

/** Last path segment of a stored key / URL, without the upload timestamp prefix. */
export function fileNameOf(key: string): string {
  const last = decodeURIComponent(key.split('?')[0]!.split('/').pop() ?? '');
  return last.replace(/^\d{10,}[-_]/, '') || 'file.pdf';
}

export const SYLLABUS_CLASSES = [6, 7, 8, 9, 10] as const;

/** One row per class 6–10 for `year` (uploaded or not), as on the web table. */
export function syllabusTable(rows: readonly SyllabusRow[], year: number) {
  return SYLLABUS_CLASSES.map((cls) => ({
    cls,
    row: rows.find((r) => r.class === cls && r.year === year) ?? null,
  }));
}

export const syllabusSummary = (rows: readonly SyllabusRow[], year: number) =>
  `${syllabusTable(rows, year).filter((r) => r.row).length} of ${SYLLABUS_CLASSES.length} classes uploaded for ${year}`;

/** Current year −1 … +1, plus any year that already has a file. */
export function syllabusYears(rows: readonly SyllabusRow[], current: number): number[] {
  const set = new Set([current - 1, current, current + 1, ...rows.map((r) => r.year)]);
  return [...set].filter((y) => y > 0).sort((a, b) => b - a);
}

/** `count` years counting down from `from` (the admission / registration year pickers). */
export const yearsFrom = (from: number, count = 6) =>
  Array.from({ length: count }, (_, i) => from - i);

/**
 * Registration year picker (useRegistrationSettingsYear on the web): the latest settings year and
 * five before it, plus any year already in use. `next` adds the year after, so next year's
 * settings can be created ahead of time.
 */
export function regYearOptions(
  base: number,
  extras: readonly (string | number | null | undefined)[] = [],
  next = false,
): number[] {
  const years = Array.from({ length: 6 }, (_, i) => base - i);
  if (next) years.push(base + 1);
  for (const v of extras) {
    const n = Number(v);
    if (v !== null && v !== undefined && v !== '' && Number.isInteger(n) && n > 0) years.push(n);
  }
  return [...new Set(years)].sort((a, b) => b - a);
}

export function certificateSummary(meta: CertificateList['meta'] | undefined, filtered: boolean) {
  if (!meta) return 'Loading…';
  const total = filtered ? `${meta.total} of ${meta.totalAll}` : `${meta.totalAll}`;
  return [
    `${total} certificate${meta.totalAll === 1 ? '' : 's'}`,
    meta.pendingCount ? `${meta.pendingCount} pending` : null,
    `${meta.editedCount} edited`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const EXAM_LABEL: Record<string, string> = {
  SSC: 'SSC',
  JSC: 'JSC',
  '6': 'Class 6',
  '7': 'Class 7',
  '8': 'Class 8',
};
export const examLabel = (e: string | undefined) => (e ? (EXAM_LABEL[e] ?? e) : '—');

/** Fields a student edit should be reviewed for (the web's SENSITIVE set). */
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  'gpa',
  'dob',
  'roll',
  'registration_no',
  'passing_year',
  'exam',
  'birth_reg_no',
]);

export const CERTIFICATE_FIELDS: readonly string[] = [
  'student_name_en',
  'student_name_bn',
  'father_name_en',
  'father_name_bn',
  'mother_name_en',
  'mother_name_bn',
  'address_district',
  'address_upazila',
  'address_post_office',
  'address_post_office_bn',
  'address_post_code',
  'address_village_road',
  'address_village_road_bn',
  'dob',
  'birth_reg_no',
  'gender',
  'mobile',
  'exam',
  'passing_year',
  'roll',
  'registration_no',
  'gpa',
];

/** "father_name_en" → "Father name (EN)". */
export function fieldLabel(key: string): string {
  const lang = key.match(/_(en|bn)$/);
  const base = (lang ? key.slice(0, -3) : key)
    .replace(/^address_/, '')
    .replace(/_/g, ' ')
    .replace(/\bdob\b/, 'date of birth')
    .replace(/\bgpa\b/, 'GPA')
    .replace(/\bno\b/, 'no.')
    .replace(/\breg\b/, 'registration')
    .replace(/\bid\b/, 'ID');
  const label = base.charAt(0).toUpperCase() + base.slice(1);
  return lang ? `${label} (${lang[1]!.toUpperCase()})` : label;
}

export const ADMISSION_RESULT_CLASSES = ['6', '7', '8', '9'] as const;

export function admissionResultSummary(rows: readonly AdmissionResultRow[], year: number) {
  const forYear = rows.filter((r) => r.admission_year === year);
  const pdfs = forYear.reduce(
    (n, r) => n + [r.merit_list, r.waiting_list_1, r.waiting_list_2].filter(Boolean).length,
    0,
  );
  const classes = ADMISSION_RESULT_CLASSES.filter((c) =>
    forYear.some((r) => r.class_name === c),
  ).length;
  return `${classes} of ${ADMISSION_RESULT_CLASSES.length} classes published · ${pdfs} PDF${pdfs === 1 ? '' : 's'}`;
}

export function gallerySummary(
  groups: readonly GalleryGroup[],
  mode: 'approved' | 'pending' | 'rejected',
) {
  const photos = groups.reduce((n, g) => n + g.images.length, 0);
  const p = `${photos} photo${photos === 1 ? '' : 's'}`;
  if (mode === 'approved') {
    const ev = groups.filter((g) => g.kind === 'event').length;
    const cat = groups.length - ev;
    return `${p} · ${ev} event${ev === 1 ? '' : 's'} · ${cat} categor${cat === 1 ? 'y' : 'ies'}`;
  }
  return `${p} ${mode === 'pending' ? 'waiting for review' : 'rejected'} · ${groups.length} album${groups.length === 1 ? '' : 's'}`;
}

/** Toggle every id of `ids` on (if any is off) or off (if all are on). */
export function toggleAll(selected: ReadonlySet<number>, ids: readonly number[]): Set<number> {
  const next = new Set(selected);
  const allOn = ids.length > 0 && ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allOn) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Keep only ids that still exist after a refetch. */
export function keepExisting(selected: ReadonlySet<number>, groups: readonly GalleryGroup[]) {
  const live = new Set(groups.flatMap((g) => g.images.map((i) => i.id)));
  return new Set([...selected].filter((id) => live.has(id)));
}

/** "admissions_export_2026-10-19.xlsx". */
export const datedName = (prefix: string, ext: string, today = new Date()) =>
  `${prefix}${today.toISOString().slice(0, 10)}.${ext}`;

/** One row per uploaded record for `year`; classes with nothing yet still get an empty row. */
export function admissionResultRows(rows: readonly AdmissionResultRow[], year: number) {
  const forYear = rows.filter((r) => r.admission_year === year);
  return ADMISSION_RESULT_CLASSES.flatMap((cls) => {
    const forClass = forYear.filter((r) => r.class_name === cls);
    return forClass.length
      ? forClass.map((r) => ({ key: `r${r.id}`, cls, result: r as AdmissionResultRow | null }))
      : [{ key: `c${cls}`, cls, result: null }];
  });
}

export function resultYearOptions(
  rows: readonly AdmissionResultRow[],
  base: number,
  selected: number,
) {
  return [...new Set([base, base - 1, base - 2, selected, ...rows.map((r) => r.admission_year)])]
    .filter((y) => y > 0)
    .sort((a, b) => b - a);
}
