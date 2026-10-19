/**
 * Marks entry + class results (Nest), verified against server/src/nest/modules/marks/
 * (marks.controller.ts, dto/*.ts, marks.service.ts) and marksheets.controller.ts:
 *
 *   GET /api/marks/roster?class&year[&section]   admin/teacher; enrolled students of the class
 *       (teachers: only their sections; 403 otherwise), ordered section → roll → name
 *   GET /api/marks?class&year&exam               admin/teacher; every student of the class with
 *       their marks for that exam (+ subject_info)
 *   PUT /api/marks { students: [{ studentId, subjectMarks: [{ subjectId, cq_marks?, mcq_marks?,
 *       practical_marks?, marks? }] }], examName, year }   admin/teacher; whitelisted DTO,
 *       ints ≥ 0 or null. Returns { success, count, errors? }: per-student problems (not
 *       enrolled, not your section, unknown subject) come back in `errors` with a 200.
 *       The server recomputes BREAKDOWN totals but does NOT check upper bounds: the client
 *       must never send a mark above the subject's limit (see features/marks/entry.ts).
 *   GET /api/marksheets/students/:id?year&exam    PDF
 *   GET /api/marksheets/classes/:class/summary?year&exam[&section]   PDF
 *   GET /api/marksheets/classes/:class/bundle?year&exam[&section]    JSON { url } of the PDF
 *   GET /api/marksheets/exams/:examId/status     generation progress (see marksheet-status.ts)
 *
 * null = not entered (never 0). The server has no "absent" marker.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { marksheetStatusPath, parseMarksheetStatus } from './marksheet-status';
import { isObj, num, numOrNull, objArray, str, strOrNull } from './parse';

export interface RosterStudent {
  student_id: number;
  name: string;
  roll: number;
  class: number;
  section: string;
  group: string | null;
}

export interface MarkValues {
  cq_marks: number | null;
  mcq_marks: number | null;
  practical_marks: number | null;
  marks: number | null;
}

export interface StudentSubjectMark extends MarkValues {
  subject_id: number;
  subject: string;
  priority: number;
  marking_scheme: 'TOTAL' | 'BREAKDOWN';
}

export interface ClassMarksRow extends RosterStudent {
  marks: StudentSubjectMark[];
}

export interface SubjectMarkInput extends MarkValues {
  subjectId: number;
}

export interface SaveMarksInput {
  examName: string;
  year: number;
  students: { studentId: number; subjectMarks: SubjectMarkInput[] }[];
}

export interface SaveMarksResult {
  /** Rows actually written (unchanged rows are skipped by the server). */
  count: number;
  /** Per-student problems the server skipped. */
  errors: string[];
}

export const MARKS_PATHS = {
  roster: '/api/marks/roster',
  classMarks: '/api/marks',
  save: '/api/marks',
  studentPdf: (id: number) => `/api/marksheets/students/${id}`,
  summaryPdf: (cls: number) => `/api/marksheets/classes/${cls}/summary`,
  bundle: (cls: number) => `/api/marksheets/classes/${cls}/bundle`,
} as const;

function parseRosterItem(s: Record<string, unknown>): RosterStudent {
  return {
    student_id: num(s.student_id),
    name: str(s.name),
    roll: num(s.roll),
    class: num(s.class),
    section: str(s.section),
    group: strOrNull(s.group),
  };
}

export const parseRoster = (v: unknown): RosterStudent[] =>
  objArray(v, MARKS_PATHS.roster).map(parseRosterItem);

export function parseClassMarks(v: unknown): ClassMarksRow[] {
  return objArray(v, MARKS_PATHS.classMarks).map((s) => ({
    ...parseRosterItem(s),
    marks: (Array.isArray(s.marks) ? s.marks : []).filter(isObj).map((m) => {
      const info = isObj(m.subject_info) ? m.subject_info : {};
      return {
        subject_id: num(m.subject_id),
        subject: str(m.subject),
        priority: num(m.priority),
        cq_marks: numOrNull(m.cq_marks),
        mcq_marks: numOrNull(m.mcq_marks),
        practical_marks: numOrNull(m.practical_marks),
        marks: numOrNull(m.marks),
        marking_scheme: info.marking_scheme === 'BREAKDOWN' ? 'BREAKDOWN' : 'TOTAL',
      };
    }),
  }));
}

export function parseSaveResult(v: unknown): SaveMarksResult {
  if (!isObj(v))
    throw new ApiError({
      kind: 'parse',
      message: 'Unexpected save response.',
      path: MARKS_PATHS.save,
    });
  return {
    count: num(v.count),
    errors: Array.isArray(v.errors)
      ? v.errors.filter((e): e is string => typeof e === 'string')
      : [],
  };
}

/** Exactly the DTO keys (forbidNonWhitelisted): never a school id or extra fields. */
const markBody = (m: SubjectMarkInput): SubjectMarkInput => ({
  subjectId: m.subjectId,
  cq_marks: m.cq_marks,
  mcq_marks: m.mcq_marks,
  practical_marks: m.practical_marks,
  marks: m.marks,
});

export function createMarksApi(client: ApiClient) {
  return {
    async roster(p: { cls: number; year: number }, signal?: AbortSignal) {
      return parseRoster(
        await client.get(MARKS_PATHS.roster, { query: { class: p.cls, year: p.year }, signal }),
      );
    },
    async classMarks(p: { cls: number; year: number; exam: string }, signal?: AbortSignal) {
      return parseClassMarks(
        await client.get(MARKS_PATHS.classMarks, {
          query: { class: p.cls, year: p.year, exam: p.exam },
          signal,
        }),
      );
    },
    async save(input: SaveMarksInput): Promise<SaveMarksResult> {
      if (!input.examName.trim()) {
        throw new ApiError({
          kind: 'config',
          message: 'Pick an exam first.',
          path: MARKS_PATHS.save,
        });
      }
      const body = {
        students: input.students.map((s) => ({
          studentId: s.studentId,
          subjectMarks: s.subjectMarks.map(markBody),
        })),
        examName: input.examName,
        year: input.year,
      };
      return parseSaveResult(await client.put(MARKS_PATHS.save, body));
    },
    studentPdf(p: { studentId: number; year: number; exam: string }) {
      return client.get<ArrayBuffer>(MARKS_PATHS.studentPdf(p.studentId), {
        query: { year: p.year, exam: p.exam },
        responseType: 'arrayBuffer',
        timeoutMs: 130_000,
      });
    },
    summaryPdf(p: { cls: number; year: number; exam: string; section?: string }) {
      return client.get<ArrayBuffer>(MARKS_PATHS.summaryPdf(p.cls), {
        query: { year: p.year, exam: p.exam, ...(p.section ? { section: p.section } : {}) },
        responseType: 'arrayBuffer',
        timeoutMs: 130_000,
      });
    },
    /** Background marksheet / class-bundle generation for one exam (this school only). */
    async marksheetStatus(examId: number, signal?: AbortSignal) {
      return parseMarksheetStatus(
        await client.get<unknown>(marksheetStatusPath(examId), { signal }),
      );
    },
    /** URL of the cached class (or section) bundle PDF. */
    async bundleUrl(p: { cls: number; year: number; exam: string; section?: string }) {
      const data = await client.get<unknown>(MARKS_PATHS.bundle(p.cls), {
        query: { year: p.year, exam: p.exam, ...(p.section ? { section: p.section } : {}) },
        timeoutMs: 130_000,
      });
      const url = isObj(data) && typeof data.url === 'string' ? data.url : '';
      if (!/^https?:\/\//.test(url)) {
        throw new ApiError({
          kind: 'parse',
          message: 'Missing download URL.',
          path: MARKS_PATHS.bundle(p.cls),
        });
      }
      return url;
    },
  };
}

export type MarksApi = ReturnType<typeof createMarksApi>;
