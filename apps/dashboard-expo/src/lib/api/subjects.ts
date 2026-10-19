/**
 * Subjects (legacy Express), verified against server/src/modules/result/subject/ and
 * dashboard/src/queries/subject.queries.ts + pages/Admin/NewSubject.tsx:
 *
 *   GET    /api/sub/getSubjects               admin/teacher; every subject of the school (all
 *          years), ordered by priority then id. The page filters by year itself.
 *   POST   /api/sub/addSubject { subjects: [subjectFormSchema] }   admin (validated)
 *   PUT    /api/sub/updateSubject/:id { ...subjectFormSchema, old_parent_id? }   admin
 *   DELETE /api/sub/deleteSubject/:id         admin
 *   POST   /api/sub/clone { fromYear, toYear }  admin; fails if the target year has subjects
 */
import type { ApiClient } from './client';
import { num, numOrNull, objArray, str, strOrNull } from './parse';

export type SubjectType = 'main' | 'paper' | 'single';
export type AssessmentType = 'exam' | 'continuous';
export type MarkingScheme = 'TOTAL' | 'BREAKDOWN';

export interface Subject {
  id: number;
  name: string;
  class: number;
  year: number;
  full_mark: number;
  pass_mark: number;
  cq_mark: number;
  mcq_mark: number;
  practical_mark: number;
  cq_pass_mark: number;
  mcq_pass_mark: number;
  practical_pass_mark: number;
  group: string | null;
  subject_type: SubjectType;
  parent_id: number | null;
  assessment_type: AssessmentType;
  marking_scheme: MarkingScheme;
  priority: number;
}

/** What the form sends; matches subjectFormSchema's output. */
export type SubjectInput = Omit<Subject, 'id'> & { id?: number | null };

export const SUBJECT_PATHS = {
  list: '/api/sub/getSubjects',
  add: '/api/sub/addSubject',
  update: (id: number) => `/api/sub/updateSubject/${id}`,
  remove: (id: number) => `/api/sub/deleteSubject/${id}`,
  clone: '/api/sub/clone',
} as const;

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export function parseSubjects(v: unknown): Subject[] {
  return objArray(v, SUBJECT_PATHS.list).map((s) => ({
    id: num(s.id),
    name: str(s.name),
    class: num(s.class),
    year: num(s.year),
    full_mark: num(s.full_mark),
    pass_mark: num(s.pass_mark),
    cq_mark: num(s.cq_mark),
    mcq_mark: num(s.mcq_mark),
    practical_mark: num(s.practical_mark),
    cq_pass_mark: num(s.cq_pass_mark),
    mcq_pass_mark: num(s.mcq_pass_mark),
    practical_pass_mark: num(s.practical_pass_mark),
    group: strOrNull(s.group),
    subject_type: oneOf(s.subject_type, ['main', 'paper', 'single'] as const, 'single'),
    parent_id: numOrNull(s.parent_id),
    assessment_type: oneOf(s.assessment_type, ['exam', 'continuous'] as const, 'exam'),
    marking_scheme: oneOf(s.marking_scheme, ['TOTAL', 'BREAKDOWN'] as const, 'TOTAL'),
    priority: num(s.priority),
  }));
}

const TYPE_ORDER: Record<SubjectType, number> = { main: 0, single: 1, paper: 2 };

/**
 * Display order of NewSubject.tsx: class → priority → type → name, with each main subject's
 * papers directly under it.
 */
export function orderSubjects(list: readonly Subject[]): Subject[] {
  const cmp = (a: Subject, b: Subject) =>
    a.class - b.class ||
    a.priority - b.priority ||
    TYPE_ORDER[a.subject_type] - TYPE_ORDER[b.subject_type] ||
    a.name.localeCompare(b.name);
  const ids = new Set(list.map((s) => s.id));
  const out: Subject[] = [];
  for (const s of [...list].sort(cmp)) {
    if (s.subject_type === 'paper' && s.parent_id != null && ids.has(s.parent_id)) continue;
    out.push(s);
    if (s.subject_type === 'main') {
      out.push(...list.filter((p) => p.subject_type === 'paper' && p.parent_id === s.id).sort(cmp));
    }
  }
  return out;
}

export function createSubjectsApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal): Promise<Subject[]> {
      return parseSubjects(await client.get<unknown>(SUBJECT_PATHS.list, { signal }));
    },
    async create(input: SubjectInput): Promise<void> {
      const { id: _id, ...rest } = input;
      await client.post<unknown>(SUBJECT_PATHS.add, { subjects: [rest] });
    },
    /** Spreadsheet import: every row in one request (the web's useAddSubjects). */
    async createMany(rows: readonly object[]): Promise<void> {
      await client.post<unknown>(SUBJECT_PATHS.add, { subjects: rows });
    },
    async update(id: number, input: SubjectInput, oldParentId: number | null): Promise<void> {
      const { id: _id, ...rest } = input;
      await client.put<unknown>(SUBJECT_PATHS.update(id), {
        ...rest,
        ...(oldParentId ? { old_parent_id: oldParentId } : {}),
      });
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(SUBJECT_PATHS.remove(id));
    },
    async clone(fromYear: number, toYear: number): Promise<void> {
      await client.post<unknown>(SUBJECT_PATHS.clone, { fromYear, toYear });
    },
  };
}

export type SubjectsApi = ReturnType<typeof createSubjectsApi>;
