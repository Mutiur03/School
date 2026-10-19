/**
 * Subject form model (dashboard/src/pages/Admin/NewSubject.tsx). Numbers are typed as text and
 * converted here; the result is checked with the shared `subjectFormSchema` (the same schema
 * the server's validate() middleware runs) before it is sent.
 */
import type { AssessmentType, MarkingScheme, Subject, SubjectInput, SubjectType } from '@/lib/api';

export interface SubjectFormValues {
  name: string;
  class: string;
  full_mark: string;
  pass_mark: string;
  cq_mark: string;
  mcq_mark: string;
  practical_mark: string;
  cq_pass_mark: string;
  mcq_pass_mark: string;
  practical_pass_mark: string;
  group: string;
  subject_type: SubjectType;
  parent_id: string;
  assessment_type: AssessmentType;
  marking_scheme: MarkingScheme;
  priority: string;
}

export const SUBJECT_TYPE_LABEL: Record<SubjectType, string> = {
  single: 'Single Subject',
  main: 'Main Subject (Group)',
  paper: 'Paper (Child Subject)',
};

const s = (n: number | null | undefined) => (n == null ? '' : String(n));

export function subjectDefaults(
  subject?: Subject | null,
  defaultClass?: number,
): SubjectFormValues {
  return {
    name: subject?.name ?? '',
    class: subject ? String(subject.class) : defaultClass ? String(defaultClass) : '',
    full_mark: subject ? s(subject.full_mark) : '',
    pass_mark: subject ? s(subject.pass_mark) : '0',
    cq_mark: s(subject?.cq_mark ?? 0),
    mcq_mark: s(subject?.mcq_mark ?? 0),
    practical_mark: s(subject?.practical_mark ?? 0),
    cq_pass_mark: s(subject?.cq_pass_mark ?? 0),
    mcq_pass_mark: s(subject?.mcq_pass_mark ?? 0),
    practical_pass_mark: s(subject?.practical_pass_mark ?? 0),
    group: subject?.group ?? '',
    subject_type: subject?.subject_type ?? 'single',
    parent_id: subject?.parent_id ? String(subject.parent_id) : '',
    assessment_type: subject?.assessment_type ?? 'exam',
    marking_scheme: subject?.marking_scheme ?? 'TOTAL',
    priority: s(subject?.priority ?? 0),
  };
}

const n = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
const z0 = (v: string) => n(v) ?? 0;

/** Form text → request body (before schema validation). */
export function toSubjectInput(v: SubjectFormValues, year: number): SubjectInput {
  const cls = n(v.class) ?? 0;
  const breakdown = v.marking_scheme === 'BREAKDOWN' && v.subject_type !== 'main';
  const totals = breakdownTotals(v);
  return {
    name: v.name.trim(),
    class: cls,
    year,
    // A main subject's marks are the sum of its papers (server syncParentMarks): the form shows
    // them read-only and sends back what it loaded (0 for a new one). Breakdown subjects send
    // the sums, as the server would compute them anyway.
    full_mark: breakdown && totals.full > 0 ? totals.full : (n(v.full_mark) ?? 0),
    pass_mark: breakdown && totals.pass > 0 ? totals.pass : z0(v.pass_mark),
    cq_mark: breakdown ? z0(v.cq_mark) : 0,
    mcq_mark: breakdown ? z0(v.mcq_mark) : 0,
    practical_mark: breakdown ? z0(v.practical_mark) : 0,
    cq_pass_mark: breakdown ? z0(v.cq_pass_mark) : 0,
    mcq_pass_mark: breakdown ? z0(v.mcq_pass_mark) : 0,
    practical_pass_mark: breakdown ? z0(v.practical_pass_mark) : 0,
    group: cls >= 9 && v.group ? v.group : null,
    subject_type: v.subject_type,
    parent_id: v.subject_type === 'paper' ? n(v.parent_id) : null,
    assessment_type: v.assessment_type,
    marking_scheme: v.subject_type === 'main' ? 'TOTAL' : v.marking_scheme,
    priority: z0(v.priority),
  };
}

/** Zod issues → `{ field: message }` (first message per field; 'REQUIRED' markers dropped). */
export function issuesToErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<keyof SubjectFormValues, string>> {
  const out: Partial<Record<keyof SubjectFormValues, string>> = {};
  for (const i of issues) {
    const key = i.path[0];
    if (typeof key !== 'string' || i.message === 'REQUIRED') continue;
    const k = key as keyof SubjectFormValues;
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Breakdown totals shown under the CQ/MCQ/Practical inputs. */
export const breakdownTotals = (v: SubjectFormValues) => ({
  full: z0(v.cq_mark) + z0(v.mcq_mark) + z0(v.practical_mark),
  pass: z0(v.cq_pass_mark) + z0(v.mcq_pass_mark) + z0(v.practical_pass_mark),
});
