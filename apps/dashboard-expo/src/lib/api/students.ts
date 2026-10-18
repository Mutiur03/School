/**
 * GET /api/students (legacy Express, admin/teacher), verified against
 * server/src/modules/student/student.controller.ts and dashboard/src/queries/students.queries.ts:
 * query `year` (required), `page`, `limit`, `search`, ...; legacy envelope with
 * `data: { data: Student[], meta: { total, filtered, page, limit, totalPages, ... } }`.
 * One row per enrollment in that year. Only fields this app shows are typed.
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export interface StudentRow {
  id: number;
  enrollment_id?: number;
  name: string;
  father_name: string | null;
  roll: number;
  class: number;
  section: string;
  available: boolean;
  image?: string | null;
}

export interface StudentListMeta {
  total: number;
  filtered: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StudentListResult {
  rows: StudentRow[];
  meta: StudentListMeta;
}

export interface StudentListParams {
  year: number;
  page?: number;
  limit?: number;
  search?: string;
}

export const STUDENT_PATHS = { list: '/api/students' } as const;

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

export function parseStudentList(value: unknown, params: StudentListParams): StudentListResult {
  const v = value as { data?: unknown; meta?: Record<string, unknown> } | null;
  if (!v || !Array.isArray(v.data)) {
    throw new ApiError({
      kind: 'parse',
      message: 'Unexpected students response.',
      path: STUDENT_PATHS.list,
    });
  }
  const rows = v.data
    .filter((s): s is Record<string, any> => typeof s === 'object' && s !== null)
    .map((s) => ({
      id: num(s.id),
      enrollment_id: typeof s.enrollment_id === 'number' ? s.enrollment_id : undefined,
      name: String(s.name ?? ''),
      father_name: typeof s.father_name === 'string' ? s.father_name : null,
      roll: num(s.roll),
      class: num(s.class),
      section: String(s.section ?? ''),
      available: s.available !== false,
      image: typeof s.image === 'string' ? s.image : null,
    }));
  const meta = v.meta ?? {};
  return {
    rows,
    meta: {
      total: num(meta.total, rows.length),
      filtered: num(meta.filtered, rows.length),
      page: num(meta.page, params.page ?? 1),
      limit: num(meta.limit, params.limit ?? rows.length),
      totalPages: num(meta.totalPages, 1),
    },
  };
}

export function createStudentsApi(client: ApiClient) {
  return {
    async list(params: StudentListParams, signal?: AbortSignal): Promise<StudentListResult> {
      const search = params.search?.trim();
      const data = await client.get<unknown>(STUDENT_PATHS.list, {
        query: {
          year: params.year,
          page: params.page ?? 1,
          limit: params.limit ?? 50,
          ...(search ? { search } : {}),
        },
        signal,
      });
      return parseStudentList(data, params);
    },
  };
}

export type StudentsApi = ReturnType<typeof createStudentsApi>;
