/**
 * Admin student endpoints (legacy Express), verified against server/src/modules/student/
 * student.route.ts + student.controller.ts and dashboard/src/pages/Admin/StudentList.tsx:
 *
 *   GET    /api/students?year&page&limit&search&levels&sections&groups&fourthSubjects&sort&order
 *          admin/teacher; one row per enrollment in that year: student fields + enrollment
 *          fields, `id` = student id, `enrollment_id`, `fourth_subject_id`; meta { total, filtered,
 *          page, limit, totalPages, availableClasses, availableSections, availableFourthSubjects }.
 *          sort ∈ name|roll|class|section|group|fourth; fourthSubjects = subject ids and/or 'none'.
 *   PATCH  /api/marks/students/:id/fourth-subject { year, subjectId|null }   admin/teacher (Nest;
 *          the server checks the subject is this school's, same class, not a main subject, group)
 *   PATCH  /api/marks/fourth-subjects { class: 9|10, year, group, subjectId|null }   admin; the
 *          whole class + group for that year → { updatedCount, studentIds }
 *   POST   /api/students/bulk { students: [...] }   admin; 201 with an .xlsx of the new logins
 *          (X-Students-Created / X-Students-Requested headers)
 *   PUT    /api/students/:id          admin; personal fields (updateStudentSchema)
 *   PATCH  /api/enrollments/:id       admin; class/section/roll/group (updateAcademicSchema)
 *   DELETE /api/students/:id          admin
 *   DELETE /api/students { studentIds }   admin; bulk delete (ids unique, at least one)
 *   POST   /api/students/:id/image/upload-url { key, contentType }, PUT /:id/image { key | null }
 *          admin; photo upload / removal
 *   POST   /api/students/password-rotations { studentIds }  admin; .xlsx of the new logins
 *   POST   /api/students/:id/testimonials  admin; testimonial certificate PDF (student id)
 *   POST   /api/students/:id/tc            admin; transfer certificate = mark inactive (JSON)
 *   POST   /api/students/:id/reactivate    admin; mark active again
 *   GET    /api/students/alumni            admin; past batches + inactive students, all rows
 *
 * The school is never sent: the server takes it from the host + token (RLS).
 */
import type { ApiClient } from './client';
import { parsePresigned, putToPresignedUrl, type PickedFile } from './uploads';
import { ApiError } from './errors';
import { bool, isObj, num, str, strOrNull, ymd } from './parse';

export interface StudentRow {
  id: number;
  enrollment_id?: number;
  login_id: string | null;
  name: string;
  father_name: string | null;
  mother_name: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  village: string | null;
  post_office: string | null;
  upazila: string | null;
  district: string | null;
  religion: string | null;
  /** `YYYY-MM-DD` or ''. */
  dob: string;
  roll: number;
  class: number;
  section: string;
  group: string | null;
  /** This year's 4th (optional) subject, classes 9–10. */
  fourth_subject_id: number | null;
  has_stipend: boolean;
  available: boolean;
  image?: string | null;
  /** Year-end result fields of this enrollment (Year-End Promotion page). */
  status: string;
  final_merit: number;
  fail_count: number | null;
  result_held: boolean;
  /** Status set by hand (not calculated from marks). */
  result_manual: boolean;
  next_year_roll: number;
  next_year_section: string | null;
}

export interface StudentListMeta {
  total: number;
  filtered: number;
  page: number;
  limit: number;
  totalPages: number;
  availableClasses: number[];
  availableSections: string[];
  /** Subjects students actually have as their 4th subject this year (for the filter). */
  availableFourthSubjects: { id: number; name: string }[];
  /** Students on stipend among all of this year's students (null when the server omits it). */
  stipendCount: number | null;
}

export const STUDENT_SORT_KEYS = ['name', 'roll', 'class', 'section', 'group', 'fourth'] as const;
export type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];

export interface StudentListResult {
  rows: StudentRow[];
  meta: StudentListMeta;
}

export interface StudentListParams {
  year: number;
  page?: number;
  limit?: number;
  search?: string;
  levels?: number[];
  sections?: string[];
  groups?: string[];
  /** Exact roll number. */
  roll?: number;
  /** Leave out inactive (TC'd) students, as results and promotion do. */
  activeOnly?: boolean;
  /** Subject ids as strings, plus 'none' for students without a 4th subject. */
  fourthSubjects?: string[];
  sort?: StudentSortKey;
  order?: 'asc' | 'desc';
}

/** Body of PUT /api/students/:id, same fields the web form sends ("basicDetails"). */
export interface StudentPersonalInput {
  name: string;
  father_name: string;
  mother_name: string;
  father_phone: string;
  mother_phone: string | null;
  village: string;
  post_office: string;
  upazila: string;
  district: string;
  dob: string;
  religion: string;
  available: boolean;
  has_stipend: boolean;
}

/** Body of PATCH /api/enrollments/:id. */
export interface StudentAcademicInput {
  roll: string;
  class: string;
  section: string;
  group: string;
}

export interface StudentCreateResult {
  created: number;
  requested: number;
  /** The credentials workbook (only meaningful when `created > 0`). */
  credentials: ArrayBuffer;
}

export const STUDENT_PATHS = {
  list: '/api/students',
  bulk: '/api/students/bulk',
  one: (id: number) => `/api/students/${id}`,
  enrollment: (enrollmentId: number) => `/api/enrollments/${enrollmentId}`,
  rotations: '/api/students/password-rotations',
  imageUploadUrl: (id: number) => `/api/students/${id}/image/upload-url`,
  image: (id: number) => `/api/students/${id}/image`,
  testimonial: (id: number) => `/api/students/${id}/testimonials`,
  tc: (id: number) => `/api/students/${id}/tc`,
  reactivate: (id: number) => `/api/students/${id}/reactivate`,
  alumni: '/api/students/alumni',
  fourthSubject: (id: number) => `/api/marks/students/${id}/fourth-subject`,
  fourthSubjects: '/api/marks/fourth-subjects',
} as const;

export interface AlumnusRow {
  id: number;
  name: string;
  login_id: string | null;
  batch: string;
  father_name: string | null;
  mother_name: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  dob: string;
  religion: string | null;
  village: string | null;
  post_office: string | null;
  upazila: string | null;
  district: string | null;
  has_stipend: boolean;
  available: boolean;
  image: string | null;
}

export function parseAlumnus(s: Record<string, unknown>): AlumnusRow {
  return {
    id: num(s.id),
    name: str(s.name),
    login_id: strOrNull(s.login_id),
    batch: str(s.batch),
    father_name: strOrNull(s.father_name),
    mother_name: strOrNull(s.mother_name),
    father_phone: strOrNull(s.father_phone),
    mother_phone: strOrNull(s.mother_phone),
    dob: ymd(s.dob),
    religion: strOrNull(s.religion),
    village: strOrNull(s.village),
    post_office: strOrNull(s.post_office),
    upazila: strOrNull(s.upazila),
    district: strOrNull(s.district),
    has_stipend: bool(s.has_stipend),
    available: s.available !== false,
    image: strOrNull(s.image),
  };
}

/** Unique, positive ids (the server rejects duplicates). */
export const uniqueIds = (ids: Iterable<number>) =>
  [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);

const numArray = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => num(x, Number.NaN)).filter((x) => !Number.isNaN(x)) : [];

export function parseStudentRow(s: Record<string, unknown>): StudentRow {
  return {
    id: num(s.id),
    enrollment_id: typeof s.enrollment_id === 'number' ? s.enrollment_id : undefined,
    login_id: strOrNull(s.login_id),
    name: str(s.name),
    father_name: strOrNull(s.father_name),
    mother_name: strOrNull(s.mother_name),
    father_phone: strOrNull(s.father_phone),
    mother_phone: strOrNull(s.mother_phone),
    village: strOrNull(s.village),
    post_office: strOrNull(s.post_office),
    upazila: strOrNull(s.upazila),
    district: strOrNull(s.district),
    religion: strOrNull(s.religion),
    dob: ymd(s.dob),
    roll: num(s.roll),
    class: num(s.class),
    section: str(s.section),
    group: strOrNull(s.group),
    fourth_subject_id:
      typeof s.fourth_subject_id === 'number' && s.fourth_subject_id > 0
        ? s.fourth_subject_id
        : null,
    has_stipend: bool(s.has_stipend),
    available: s.available !== false,
    image: typeof s.image === 'string' ? s.image : null,
    status: str(s.status),
    final_merit: num(s.final_merit),
    fail_count: typeof s.fail_count === 'number' ? s.fail_count : null,
    result_held: bool(s.result_held),
    result_manual: bool(s.result_manual),
    next_year_roll: num(s.next_year_roll),
    next_year_section: strOrNull(s.next_year_section),
  };
}

export function parseStudentList(value: unknown, params: StudentListParams): StudentListResult {
  const v = value as { data?: unknown; meta?: Record<string, unknown> } | null;
  if (!v || !Array.isArray(v.data)) {
    throw new ApiError({
      kind: 'parse',
      message: 'Unexpected students response.',
      path: STUDENT_PATHS.list,
    });
  }
  const rows = v.data.filter(isObj).map(parseStudentRow);
  const meta = v.meta ?? {};
  return {
    rows,
    meta: {
      total: num(meta.total, rows.length),
      filtered: num(meta.filtered, rows.length),
      page: num(meta.page, params.page ?? 1),
      limit: num(meta.limit, params.limit ?? rows.length),
      totalPages: num(meta.totalPages, 1),
      availableClasses: numArray(meta.availableClasses),
      availableSections: Array.isArray(meta.availableSections)
        ? meta.availableSections.filter((x): x is string => typeof x === 'string')
        : [],
      stipendCount: typeof meta.stipendCount === 'number' ? meta.stipendCount : null,
      availableFourthSubjects: Array.isArray(meta.availableFourthSubjects)
        ? meta.availableFourthSubjects
            .filter(isObj)
            .map((x) => ({ id: num(x.id), name: str(x.name) }))
            .filter((x) => x.id > 0)
        : [],
    },
  };
}

/** The X-Students-* counts, defaulting to "1 requested, 1 created" when absent (one-row add). */
export function readCreatedCounts(headers: Headers | null): { created: number; requested: number } {
  const read = (name: string) => {
    const raw = headers?.get(name);
    const n = raw == null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const requested = read('X-Students-Requested') ?? 1;
  return { requested, created: read('X-Students-Created') ?? requested };
}

export function createStudentsApi(client: ApiClient) {
  /** Spreadsheet import (up to 500 rows, the web limit) or one student from the form. */
  async function createMany(
    students: readonly (StudentPersonalInput & StudentAcademicInput)[],
  ): Promise<StudentCreateResult> {
    let headers = null as Headers | null;
    const credentials = await client.post<ArrayBuffer>(
      STUDENT_PATHS.bulk,
      { students },
      {
        responseType: 'arrayBuffer',
        onHeaders: (h) => {
          headers = h;
        },
      },
    );
    return { ...readCreatedCounts(headers), credentials };
  }

  return {
    async list(params: StudentListParams, signal?: AbortSignal): Promise<StudentListResult> {
      const search = params.search?.trim();
      const data = await client.get<unknown>(STUDENT_PATHS.list, {
        query: {
          year: params.year,
          page: params.page ?? 1,
          limit: params.limit ?? 50,
          ...(search ? { search } : {}),
          ...(params.levels?.length ? { levels: params.levels.join(',') } : {}),
          ...(params.sections?.length ? { sections: params.sections.join(',') } : {}),
          ...(params.groups?.length ? { groups: params.groups.join(',') } : {}),
          ...(params.activeOnly ? { activeOnly: 'true' } : {}),
          ...(params.roll ? { roll: params.roll } : {}),
          ...(params.fourthSubjects?.length
            ? { fourthSubjects: params.fourthSubjects.join(',') }
            : {}),
          ...(params.sort ? { sort: params.sort, order: params.order ?? 'asc' } : {}),
        },
        signal,
      });
      return parseStudentList(data, params);
    },

    /** Add one student (the web "Add student" dialog sends a one-row bulk upload). */
    async create(
      student: StudentPersonalInput & StudentAcademicInput,
    ): Promise<StudentCreateResult> {
      return createMany([student]);
    },

    createMany,

    /** Edit = personal fields on the student, then academic fields on this year's enrollment. */
    async update(
      row: Pick<StudentRow, 'id' | 'enrollment_id'>,
      personal: StudentPersonalInput,
      academic: StudentAcademicInput,
    ): Promise<void> {
      await client.put<unknown>(STUDENT_PATHS.one(row.id), personal);
      if (row.enrollment_id) {
        await client.patch<unknown>(STUDENT_PATHS.enrollment(row.enrollment_id), academic);
      }
    },

    async remove(id: number): Promise<void> {
      await client.delete<unknown>(STUDENT_PATHS.one(id));
    },

    /** Photo (the web uploadImageToR2): presign for this student, PUT to storage, save the key. */
    async uploadImage(id: number, file: PickedFile, fetchImpl?: typeof fetch): Promise<string> {
      if (!file.type.startsWith('image/')) throw new Error('Photo must be an image');
      const presignPath = STUDENT_PATHS.imageUploadUrl(id);
      const data = await client.post<unknown>(presignPath, {
        key: `${Date.now()}-${file.name.replace(/\s+/g, '-')}`,
        contentType: file.type,
      });
      const { uploadUrl, key } = parsePresigned(data, presignPath);
      await putToPresignedUrl(uploadUrl, file, fetchImpl);
      await client.put<unknown>(STUDENT_PATHS.image(id), { key });
      return key;
    },
    async removeImage(id: number): Promise<void> {
      await client.put<unknown>(STUDENT_PATHS.image(id), { key: null });
    },

    /** One student's 4th subject for `year` (null clears it). */
    async setFourthSubject(
      studentId: number,
      year: number,
      subjectId: number | null,
    ): Promise<void> {
      await client.patch<unknown>(STUDENT_PATHS.fourthSubject(studentId), { year, subjectId });
    },
    /** The same 4th subject for every class 9/10 student of one group in `year`. */
    async setFourthSubjectForGroup(input: {
      class: 9 | 10;
      year: number;
      group: string;
      subjectId: number | null;
    }): Promise<number> {
      const data = await client.patch<unknown>(STUDENT_PATHS.fourthSubjects, input);
      return isObj(data) ? num(data.updatedCount, 0) : 0;
    },

    async removeMany(ids: Iterable<number>): Promise<number> {
      const studentIds = uniqueIds(ids);
      const data = await client.request<unknown>(STUDENT_PATHS.list, {
        method: 'DELETE',
        body: { studentIds },
      });
      return isObj(data) ? num(data.deletedCount, studentIds.length) : studentIds.length;
    },

    /** New passwords for these students; the credentials workbook comes back as bytes. */
    async rotatePasswords(ids: Iterable<number>): Promise<ArrayBuffer> {
      return client.post<ArrayBuffer>(
        STUDENT_PATHS.rotations,
        { studentIds: uniqueIds(ids) },
        { responseType: 'arrayBuffer', timeoutMs: 180_000 },
      );
    },

    async testimonial(id: number): Promise<ArrayBuffer> {
      return client.post<ArrayBuffer>(
        STUDENT_PATHS.testimonial(id),
        {},
        { responseType: 'arrayBuffer', timeoutMs: 120_000 },
      );
    },

    async issueTc(id: number): Promise<void> {
      await client.post<unknown>(STUDENT_PATHS.tc(id));
    },

    async reactivate(id: number): Promise<void> {
      await client.post<unknown>(STUDENT_PATHS.reactivate(id));
    },

    async alumni(signal?: AbortSignal): Promise<AlumnusRow[]> {
      const data = await client.get<unknown>(STUDENT_PATHS.alumni, { signal });
      if (!Array.isArray(data)) {
        throw new ApiError({
          kind: 'parse',
          message: 'Unexpected alumni response.',
          path: STUDENT_PATHS.alumni,
        });
      }
      return data.filter(isObj).map(parseAlumnus);
    },
  };
}

export type StudentsApi = ReturnType<typeof createStudentsApi>;
