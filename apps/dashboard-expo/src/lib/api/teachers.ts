/**
 * Admin teacher endpoints (legacy Express), verified against server/src/modules/teacher/
 * teacher.route.ts + teacher.controller.ts + teacher.service.ts and
 * dashboard/src/pages/Admin/TeacherList.tsx:
 *
 *   GET    /api/teachers?page&limit&search  optional auth; available teachers of this school,
 *          `{ data, meta: { total, page, limit, totalPages } }` (limit capped at 200). Admins get
 *          full rows; anyone else gets the public profile only.
 *   POST   /api/teachers { teachers: [form] }  admin; teacherFormSchema per row; emails must be
 *          new. Returns `{ teachers, inserted_count, excelBuffer }` (base64 credentials sheet,
 *          also emailed to the head). The web page ignores the sheet; so do we.
 *   PUT    /api/teachers/:id  admin; teacherFormSchema
 *   DELETE /api/teachers/:id  admin
 *   POST   /api/teachers/password-rotations { teacherIds }  admin; new passwords for those
 *          teachers, returned as an .xlsx (also emailed to the head)
 *   GET    /api/teachers/head-message  public; { head_message, head_role, teacher { id, name,
 *          image } } of this school, or null
 *   POST   /api/teachers/head-message { teacherId?, message?, headRole? }  admin
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import { isObj, num, str, strOrNull } from './parse';

export interface TeacherRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  designation: string | null;
  address: string | null;
  image: string | null;
  signature: string | null;
}

export interface TeacherInput {
  name: string;
  email: string;
  phone: string;
  designation: string;
  address: string;
}

export interface TeacherListResult {
  rows: TeacherRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const TEACHER_PATHS = {
  list: '/api/teachers',
  one: (id: number) => `/api/teachers/${id}`,
  rotations: '/api/teachers/password-rotations',
  headMessage: '/api/teachers/head-message',
} as const;

export const HEAD_ROLES = ['Headmaster', 'Headmaster (Incharge)'] as const;

export interface HeadMessage {
  teacher: { id: number; name: string; image: string | null } | null;
  message: string;
  role: string;
}

export interface HeadMessageInput {
  teacherId?: number;
  message?: string;
  headRole?: string;
}

export function parseHeadMessage(v: unknown): HeadMessage {
  if (!isObj(v)) return { teacher: null, message: '', role: HEAD_ROLES[0] };
  const t = isObj(v.teacher) ? v.teacher : null;
  return {
    teacher: t ? { id: num(t.id), name: str(t.name), image: strOrNull(t.image) } : null,
    message: str(v.head_message),
    role: strOrNull(v.head_role) ?? HEAD_ROLES[0],
  };
}

/** The web page's payload rules: only set fields, message trimmed; empty = nothing to save. */
export function headMessageBody(d: {
  teacherId: number | null;
  message: string;
  role: string;
}): HeadMessageInput | null {
  const body: HeadMessageInput = {};
  if (d.teacherId) body.teacherId = d.teacherId;
  if (d.message.trim()) body.message = d.message.trim();
  if (d.role) body.headRole = d.role;
  return Object.keys(body).length ? body : null;
}

export function parseTeacherRow(t: Record<string, unknown>): TeacherRow {
  return {
    id: num(t.id),
    name: str(t.name),
    email: str(t.email),
    phone: str(t.phone),
    designation: strOrNull(t.designation),
    address: strOrNull(t.address),
    image: strOrNull(t.image),
    signature: strOrNull(t.signature),
  };
}

export function parseTeacherList(v: unknown, page = 1): TeacherListResult {
  if (!isObj(v) || !Array.isArray(v.data)) {
    throw new ApiError({
      kind: 'parse',
      message: 'Unexpected teachers response.',
      path: TEACHER_PATHS.list,
    });
  }
  const rows = v.data.filter(isObj).map(parseTeacherRow);
  const meta = isObj(v.meta) ? v.meta : {};
  return {
    rows,
    meta: {
      total: num(meta.total, rows.length),
      page: num(meta.page, page),
      limit: num(meta.limit, rows.length),
      totalPages: num(meta.totalPages, 1),
    },
  };
}

export function createTeachersApi(client: ApiClient) {
  return {
    async list(
      p: { page?: number; limit?: number; search?: string },
      signal?: AbortSignal,
    ): Promise<TeacherListResult> {
      const search = p.search?.trim();
      const data = await client.get<unknown>(TEACHER_PATHS.list, {
        query: { page: p.page ?? 1, limit: p.limit ?? 50, ...(search ? { search } : {}) },
        signal,
      });
      return parseTeacherList(data, p.page);
    },
    async create(input: TeacherInput): Promise<TeacherRow | null> {
      const data = await client.post<unknown>(TEACHER_PATHS.list, { teachers: [input] });
      const first = isObj(data) && Array.isArray(data.teachers) ? data.teachers[0] : null;
      return isObj(first) ? parseTeacherRow(first) : null;
    },
    async update(id: number, input: TeacherInput): Promise<void> {
      await client.put<unknown>(TEACHER_PATHS.one(id), input);
    },
    async remove(id: number): Promise<void> {
      await client.delete<unknown>(TEACHER_PATHS.one(id));
    },
    /** New passwords for these teachers; the credentials workbook comes back as bytes. */
    async rotatePasswords(teacherIds: readonly number[]): Promise<ArrayBuffer> {
      return client.post<ArrayBuffer>(
        TEACHER_PATHS.rotations,
        { teacherIds: [...new Set(teacherIds)] },
        { responseType: 'arrayBuffer', timeoutMs: 120_000 },
      );
    },
    async headMessage(signal?: AbortSignal): Promise<HeadMessage> {
      return parseHeadMessage(await client.get<unknown>(TEACHER_PATHS.headMessage, { signal }));
    },
    async saveHeadMessage(body: HeadMessageInput): Promise<void> {
      await client.post<unknown>(TEACHER_PATHS.headMessage, body);
    },
  };
}

export type TeachersApi = ReturnType<typeof createTeachersApi>;
