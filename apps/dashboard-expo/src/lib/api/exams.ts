/**
 * Exam setup (legacy Express), verified against server/src/modules/exam/exam.route.ts +
 * exam-type.route.ts and dashboard/src/queries/exam.queries.ts:
 *
 *   GET    /api/exams/getExams                every exam of the school (RLS), all years
 *   GET    /api/exam-types/assigned           admin; exam types the super admin gave this school
 *   POST   /api/exams/addExam { exams: [createExamSchema] }   admin (validated)
 *   GET    /api/exams/presigned-url?filename&contentType, POST /uploadRoutinePDF/:id { key },
 *          DELETE /removeRoutinePDF/:id   admin (routine PDF)
 *   PUT    /api/exams/updateExam/:id createExamSchema          admin (validated)
 *   PUT    /api/exams/updateVisibility/:id { visible }         admin; publishes / hides results,
 *          top-level `queued` = marksheets queued for generation
 *   DELETE /api/exams/deleteExam/:id          admin; removes its marks and cached marksheets
 *
 */
import type { ApiClient } from './client';
import { uploadViaPresign, type PickedFile } from './uploads';
import { bool, isObj, num, numOrNull, objArray, str, strOrNull, ymd } from './parse';

export interface Exam {
  id: number;
  exam_name: string;
  exam_year: number;
  levels: number[];
  visible: boolean;
  /** `YYYY-MM-DD` */
  start_date: string;
  end_date: string;
  result_date: string;
  return_date: string | null;
  exam_type_id: number | null;
  is_year_end: boolean;
  routine: string | null;
}

export interface ExamType {
  id: number;
  name: string;
  is_year_end: boolean;
  sort_order: number;
}

/** Body of addExam (one item) / updateExam; matches createExamSchema. */
export interface ExamInput {
  exam_type_id: number;
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
  return_date?: string;
}

export const EXAM_PATHS = {
  list: '/api/exams/getExams',
  types: '/api/exam-types/assigned',
  add: '/api/exams/addExam',
  update: (id: number) => `/api/exams/updateExam/${id}`,
  visibility: (id: number) => `/api/exams/updateVisibility/${id}`,
  remove: (id: number) => `/api/exams/deleteExam/${id}`,
  routinePresign: '/api/exams/presigned-url',
  routineSave: (id: number) => `/api/exams/uploadRoutinePDF/${id}`,
  routineRemove: (id: number) => `/api/exams/removeRoutinePDF/${id}`,
} as const;

export const EXAM_CLASSES = [6, 7, 8, 9, 10] as const;

const levelsOf = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => num(x, Number.NaN)).filter((x) => Number.isInteger(x)))].sort(
        (a, b) => a - b,
      )
    : [];

export function parseExams(v: unknown): Exam[] {
  return objArray(v, EXAM_PATHS.list).map((e) => ({
    id: num(e.id),
    exam_name: str(e.exam_name),
    exam_year: num(e.exam_year),
    levels: levelsOf(e.levels),
    visible: bool(e.visible),
    start_date: ymd(e.start_date),
    end_date: ymd(e.end_date),
    result_date: ymd(e.result_date),
    return_date: ymd(e.return_date) || null,
    exam_type_id: numOrNull(e.exam_type_id),
    is_year_end: bool(e.is_year_end),
    routine: strOrNull(e.routine),
  }));
}

export function parseExamTypes(v: unknown): ExamType[] {
  return objArray(v, EXAM_PATHS.types)
    .map((t) => ({
      id: num(t.id),
      name: str(t.name),
      is_year_end: bool(t.is_year_end),
      sort_order: num(t.sort_order),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** Exams of one session, by start date (the web page's order). */
export const examsOfYear = (exams: readonly Exam[], year: number) =>
  exams
    .filter((e) => e.exam_year === year)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);

/**
 * Classes that have an exam this year but no year-end exam covering them
 * (exam-session-rail.tsx yearEndGaps): pass/fail and promotion need one per class.
 */
export function yearEndGaps(exams: readonly Exam[], classes: readonly number[] = EXAM_CLASSES) {
  const active = classes.filter((c) => exams.some((e) => e.levels.includes(c)));
  const covered = new Set(exams.filter((e) => e.is_year_end).flatMap((e) => e.levels));
  return active.filter((c) => !covered.has(c));
}

/** Only the createExamSchema keys; an empty return date is left out (the web sends undefined). */
export function examBody(i: ExamInput): ExamInput {
  const body: ExamInput = {
    exam_type_id: i.exam_type_id,
    exam_year: i.exam_year,
    levels: [...new Set(i.levels)].sort((a, b) => a - b),
    start_date: i.start_date.trim(),
    end_date: i.end_date.trim(),
    result_date: i.result_date.trim(),
  };
  if (i.return_date?.trim()) body.return_date = i.return_date.trim();
  return body;
}

export function createExamsApi(client: ApiClient) {
  return {
    async list(signal?: AbortSignal) {
      return parseExams(await client.get(EXAM_PATHS.list, { signal }));
    },
    async types(signal?: AbortSignal) {
      return parseExamTypes(await client.get(EXAM_PATHS.types, { signal }));
    },
    async create(input: ExamInput): Promise<void> {
      await client.post<unknown>(EXAM_PATHS.add, { exams: [examBody(input)] });
    },
    async update(id: number, input: ExamInput): Promise<void> {
      await client.put<unknown>(EXAM_PATHS.update(id), examBody(input));
    },
    /** Publish / hide results. Returns how many marksheets were queued (0 when unknown). */
    async setVisibility(id: number, visible: boolean): Promise<{ queued: number }> {
      // `queued` sits next to the envelope, so read the raw body.
      const text = await client.put<string>(
        EXAM_PATHS.visibility(id),
        { visible },
        { responseType: 'text' },
      );
      let queued = 0;
      try {
        const body: unknown = JSON.parse(text);
        if (isObj(body)) queued = num(body.queued);
      } catch {
        // not JSON: fine, the request itself succeeded
      }
      return { queued };
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(EXAM_PATHS.remove(id));
    },
    /** Routine PDF (the web exam-workbench-card): presigned PUT, then save the key. */
    async uploadRoutine(id: number, file: PickedFile, fetchImpl?: typeof fetch): Promise<void> {
      if (file.type !== 'application/pdf') throw new Error('Routine must be a PDF');
      const key = await uploadViaPresign(client, EXAM_PATHS.routinePresign, file, {}, fetchImpl);
      await client.post<unknown>(EXAM_PATHS.routineSave(id), { key });
    },
    async removeRoutine(id: number): Promise<void> {
      await client.delete<unknown>(EXAM_PATHS.routineRemove(id));
    },
  };
}

export type ExamsApi = ReturnType<typeof createExamsApi>;
