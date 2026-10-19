/**
 * Marks entry rules (dashboard/src/pages/Admin/AddMarks.tsx), kept pure so they can be tested.
 *
 * - One subject at a time. TOTAL subjects take one "Marks" cell (0…full_mark); BREAKDOWN
 *   subjects take CQ / MCQ / Practical cells (0…each part's limit; a part with limit 0 is
 *   disabled) and the total is their sum.
 * - Empty = not entered = null. It is never turned into 0, and clearing a saved mark sends
 *   null (the server stores null). The server has no "absent" marker.
 * - The server checks "integer ≥ 0" only, not the upper limit, so a value above the limit is
 *   an error that blocks saving. (The web page silently caps it; here the cell turns red
 *   instead, so a mistyped 100 on a /50 part is never stored as 50.)
 * - Only changed students are sent; students outside the subject's group are not editable.
 */
import type {
  ClassMarksRow,
  MarkValues,
  RosterStudent,
  SaveMarksInput,
  SaveMarksResult,
  Subject,
} from '@/lib/api';

export type MarkField = 'cq_marks' | 'mcq_marks' | 'practical_marks' | 'marks';
export const PART_FIELDS = ['cq_marks', 'mcq_marks', 'practical_marks'] as const;

export interface MarkColumn {
  field: MarkField;
  label: string;
  max: number;
}

/** Cell text as typed, per field. Missing = untouched (use the saved value). */
export type CellText = Partial<Record<MarkField, string>>;
/** studentId → typed cells. */
export type Draft = Record<number, CellText>;
/** studentId → saved values for the selected subject (absent = no saved row). */
export type Saved = Record<number, MarkValues>;

export const EMPTY_MARK: MarkValues = {
  cq_marks: null,
  mcq_marks: null,
  practical_marks: null,
  marks: null,
};

export const isBreakdown = (s: Pick<Subject, 'marking_scheme'>) => s.marking_scheme === 'BREAKDOWN';

export function markColumns(s: Subject): MarkColumn[] {
  return isBreakdown(s)
    ? [
        { field: 'cq_marks', label: 'CQ', max: s.cq_mark || 0 },
        { field: 'mcq_marks', label: 'MCQ', max: s.mcq_mark || 0 },
        { field: 'practical_marks', label: 'Prac', max: s.practical_mark || 0 },
      ]
    : [{ field: 'marks', label: 'Marks', max: s.full_mark || 0 }];
}

/** The web's "This subject has no mark limits set": saving is disabled until it has them. */
export function subjectConfigured(s: Subject): boolean {
  if (!(s.full_mark > 0)) return false;
  if (!isBreakdown(s)) return true;
  return (s.cq_mark || 0) > 0 || (s.mcq_mark || 0) > 0 || (s.practical_mark || 0) > 0;
}

/** Subjects you can enter marks for: this class and session, not a "main" group subject. */
export function entrySubjects(
  subjects: readonly Subject[],
  cls: number,
  year: number,
  group: string,
): Subject[] {
  return subjects.filter(
    (s) =>
      s.class === cls &&
      s.year === year &&
      s.subject_type !== 'main' &&
      (!group || !s.group || s.group === group),
  );
}

/** A group subject (e.g. Physics → Science) is not for students of another group. */
export const groupMismatch = (s: Pick<Subject, 'group'> | null | undefined, st: RosterStudent) =>
  Boolean(s?.group && s.group !== (st.group ?? ''));

/** Saved marks of `subjectId` per student. */
export function savedMarks(rows: readonly ClassMarksRow[], subjectId: number): Saved {
  const out: Saved = {};
  for (const r of rows) {
    const m = r.marks.find((x) => x.subject_id === subjectId);
    if (m) {
      out[r.student_id] = {
        cq_marks: m.cq_marks,
        mcq_marks: m.mcq_marks,
        practical_marks: m.practical_marks,
        marks: m.marks,
      };
    }
  }
  return out;
}

/** What goes into the input: digits only (paste "4 5" → "45"), at most 4 of them. */
export const sanitizeMarkInput = (raw: string) => raw.replace(/\D/g, '').slice(0, 4);

export interface CellCheck {
  value: number | null;
  error: string | null;
}

/** Text → value, against the column limit. */
export function checkCell(text: string, max: number): CellCheck {
  const t = text.trim();
  if (t === '') return { value: null, error: null };
  if (!/^\d+$/.test(t)) return { value: null, error: 'Whole numbers only' };
  const n = Number(t);
  if (max <= 0) return { value: null, error: 'No marks for this part' };
  if (n > max) return { value: n, error: `Max ${max}` };
  return { value: n, error: null };
}

const show = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** Text shown in a cell: what was typed, else the saved value. */
export const cellText = (draft: Draft, saved: Saved, studentId: number, field: MarkField) =>
  draft[studentId]?.[field] ?? show(saved[studentId]?.[field]);

export interface RowState {
  values: MarkValues;
  errors: Partial<Record<MarkField, string>>;
  /** Shown total (sum of parts for BREAKDOWN), null = not entered. */
  total: number | null;
}

/** The values this row would save, plus per-cell errors. */
export function rowState(
  subject: Subject,
  draft: Draft,
  saved: Saved,
  studentId: number,
): RowState {
  const base = saved[studentId] ?? EMPTY_MARK;
  const errors: RowState['errors'] = {};
  const read = (c: MarkColumn) => {
    const r = checkCell(cellText(draft, saved, studentId, c.field), c.max);
    if (r.error) errors[c.field] = r.error;
    return r.error ? null : r.value;
  };
  if (isBreakdown(subject)) {
    const parts = {} as Record<(typeof PART_FIELDS)[number], number | null>;
    for (const c of markColumns(subject)) {
      parts[c.field as (typeof PART_FIELDS)[number]] = c.max > 0 ? read(c) : null;
    }
    const entered = PART_FIELDS.filter((f) => parts[f] !== null);
    const total = entered.length ? entered.reduce((sum, f) => sum + (parts[f] ?? 0), 0) : null;
    return { values: { ...parts, marks: total }, errors, total };
  }
  const [col] = markColumns(subject);
  const marks = col ? read(col) : null;
  // TOTAL subjects keep whatever part values are already stored (the web sends them back).
  return {
    values: {
      cq_marks: base.cq_marks,
      mcq_marks: base.mcq_marks,
      practical_marks: base.practical_marks,
      marks,
    },
    errors,
    total: marks,
  };
}

const sameValues = (a: MarkValues, b: MarkValues) =>
  a.cq_marks === b.cq_marks &&
  a.mcq_marks === b.mcq_marks &&
  a.practical_marks === b.practical_marks &&
  a.marks === b.marks;

/**
 * Students whose cells differ from what is saved ("07" equals a saved 7; an invalid cell
 * always counts as changed so it cannot be silently dropped).
 */
export function changedStudents(
  subject: Subject,
  students: readonly RosterStudent[],
  draft: Draft,
  saved: Saved,
): number[] {
  return students
    .filter((st) => !groupMismatch(subject, st) && draft[st.student_id])
    .filter((st) => {
      const r = rowState(subject, draft, saved, st.student_id);
      if (Object.keys(r.errors).length) return true;
      return !sameValues(r.values, saved[st.student_id] ?? EMPTY_MARK);
    })
    .map((st) => st.student_id);
}

export interface InvalidCell {
  studentId: number;
  name: string;
  field: MarkField;
  message: string;
}

export interface Submission {
  payload: SaveMarksInput | null;
  invalid: InvalidCell[];
  changed: number;
}

/** The PUT /api/marks body for the changed students, or the invalid cells that block it. */
export function buildSubmission(p: {
  subject: Subject;
  students: readonly RosterStudent[];
  draft: Draft;
  saved: Saved;
  examName: string;
  year: number;
}): Submission {
  const ids = new Set(changedStudents(p.subject, p.students, p.draft, p.saved));
  const invalid: InvalidCell[] = [];
  const out: SaveMarksInput['students'] = [];
  for (const st of p.students) {
    if (!ids.has(st.student_id)) continue;
    const r = rowState(p.subject, p.draft, p.saved, st.student_id);
    for (const [field, message] of Object.entries(r.errors)) {
      invalid.push({ studentId: st.student_id, name: st.name, field: field as MarkField, message });
    }
    out.push({
      studentId: st.student_id,
      subjectMarks: [{ subjectId: p.subject.id, ...r.values }],
    });
  }
  if (!subjectConfigured(p.subject) || invalid.length || out.length === 0 || !p.examName) {
    return { payload: null, invalid, changed: ids.size };
  }
  return {
    payload: { examName: p.examName, year: p.year, students: out },
    invalid,
    changed: ids.size,
  };
}

/** "Students / Entered / Not entered" for the eligible students (a missing mark is never 0). */
export function entryCounts(
  subject: Subject,
  students: readonly RosterStudent[],
  draft: Draft,
  saved: Saved,
) {
  const eligible = students.filter((st) => !groupMismatch(subject, st));
  const entered = eligible.filter(
    (st) => rowState(subject, draft, saved, st.student_id).total !== null,
  ).length;
  return { eligible: eligible.length, entered, notEntered: eligible.length - entered };
}

/** Section → roll → name, like the roster endpoint and the web page. */
export function sortRoster<T extends RosterStudent>(list: readonly T[]): T[] {
  return [...list].sort(
    (a, b) =>
      a.section.localeCompare(b.section, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.roll - b.roll ||
      a.name.localeCompare(b.name),
  );
}

export function scopeRoster<T extends RosterStudent>(
  list: readonly T[],
  f: { section: string; group: string; search?: string },
): T[] {
  const q = (f.search ?? '').trim().toLowerCase();
  return sortRoster(
    list.filter(
      (s) =>
        (!f.section || s.section === f.section) &&
        (!f.group || (s.group ?? '') === f.group) &&
        (!q || s.name.toLowerCase().includes(q) || String(s.roll).includes(q)),
    ),
  );
}

/** Toast text after a save. */
export function saveMessage(r: SaveMarksResult): { text: string; tone: 'success' | 'error' } {
  if (r.errors.length) {
    const first = r.errors[0];
    const more = r.errors.length > 1 ? ` (+${r.errors.length - 1} more)` : '';
    return {
      text: `Saved ${r.count} mark${r.count === 1 ? '' : 's'}. Skipped: ${first}${more}`,
      tone: 'error',
    };
  }
  return {
    text: r.count === 0 ? 'No changes to save.' : `Marks saved (${r.count} updated).`,
    tone: 'success',
  };
}

/**
 * Next focus target for Enter / ↓ / ↑ in a column: the nearest row in that direction whose
 * cell is enabled, or null at the ends.
 */
export function nextRow(enabled: readonly boolean[], from: number, step: 1 | -1): number | null {
  for (let i = from + step; i >= 0 && i < enabled.length; i += step) {
    if (enabled[i]) return i;
  }
  return null;
}
