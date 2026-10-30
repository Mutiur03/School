/**
 * Student-role endpoints, as called by the web dashboard's student pages
 * (dashboard/src/queries/{students,exam,marks,notice}.queries.ts, pages/Students/*), verified
 * against server/:
 *
 *   GET /api/students/me?year                 student only; id from the token (req.user.id)
 *   GET /api/students/me/attendance?month&year student only; id from the token
 *   GET /api/exams/getExams                   no auth, school from host; ALL exams, the page
 *                                             keeps `visible === true` (published) itself
 *   GET /api/marks/students/:id?year&exam     Nest; a student may only pass their own id
 *                                             (canAccessStudent) and only published exams
 *   GET /api/marksheets/students/:id?year&exam Nest; same checks; streams the PDF
 *   GET /api/notices?limit                    no auth, school from host; school-wide
 *
 * The school is never sent. The student id in the marks/marksheet paths is the signed-in
 * user's own id from the session, exactly like the web page (`user.id`).
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';

export type StudentAttendanceStatus = 'present' | 'absent' | 'run-awayed';

export interface StudentProfile {
  id: number;
  name: string;
  login_id: string;
  image: string | null;
  class: number;
  section: string;
  roll: number;
  group: string | null;
  year: number;
  /** Personal details the office recorded (web: Profile → Student information). */
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
  has_stipend: boolean;
  available: boolean;
  /** Every session this student was really enrolled in (the server falls back to the latest one for other years). */
  enrollments: { year: number; class: number }[];
}

export interface StudentAttendanceDay {
  id: number;
  date: string;
  status: StudentAttendanceStatus | 'unknown';
}

export interface StudentAttendanceStats {
  present: number;
  absent: number;
  runAwayed: number;
  total: number;
  attendanceRate: number | null;
}

export interface StudentAttendance {
  records: StudentAttendanceDay[];
  stats: StudentAttendanceStats;
}

export interface PublishedExam {
  id: number;
  exam_name: string;
  exam_year: number;
  start_date: string | null;
  result_date: string | null;
  /** Classes that sit this exam. */
  levels: number[];
}

export interface SubjectMark {
  subject: string;
  marks: number | null;
}

export interface Notice {
  id: number;
  title: string;
  /** R2 key or absolute URL of the attachment (resolved against the public CDN). */
  file: string | null;
  download_url: string | null;
  created_at: string;
}

export const STUDENT_PORTAL_PATHS = {
  me: '/api/students/me',
  attendance: '/api/students/me/attendance',
  /** admin / teacher: one student's attendance */
  attendanceOf: (studentId: number) => `/api/students/${studentId}/attendance`,
  exams: '/api/exams/getExams',
  marks: (studentId: number) => `/api/marks/students/${studentId}`,
  marksheet: (studentId: number) => `/api/marksheets/students/${studentId}`,
  notices: '/api/notices',
} as const;

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const parseError = (path: string) =>
  new ApiError({ kind: 'parse', message: 'Unexpected response from the server.', path });

/** Sessions a student can look at: up to the current year, never a later one (e.g. after promotion). */
export const studentYears = (years: readonly number[], now = new Date().getFullYear()) =>
  [...new Set(years)].filter((y) => y <= now).sort((a, b) => b - a);

export function parseProfile(v: unknown): StudentProfile {
  if (!isObj(v)) throw parseError(STUDENT_PORTAL_PATHS.me);
  return {
    id: num(v.id),
    name: String(v.name ?? ''),
    login_id: String(v.login_id ?? ''),
    image: str(v.image),
    class: num(v.class),
    section: String(v.section ?? ''),
    roll: num(v.roll),
    group: str(v.group),
    year: num(v.year),
    father_name: str(v.father_name),
    mother_name: str(v.mother_name),
    father_phone: str(v.father_phone),
    mother_phone: str(v.mother_phone),
    village: str(v.village),
    post_office: str(v.post_office),
    upazila: str(v.upazila),
    district: str(v.district),
    religion: str(v.religion),
    dob: typeof v.dob === 'string' ? (v.dob.split('T')[0] ?? '') : '',
    has_stipend: v.has_stipend === true,
    available: v.available !== false,
    enrollments: Array.isArray(v.enrollments)
      ? v.enrollments
          .filter(isObj)
          .map((x) => ({ year: num(x.year), class: num(x.class) }))
          .filter((x) => x.year > 0)
      : [],
  };
}

export function normalizeStatus(s: unknown): StudentAttendanceDay['status'] {
  const v = String(s ?? '')
    .trim()
    .toLowerCase();
  return v === 'present' || v === 'absent' || v === 'run-awayed' ? v : 'unknown';
}

export function parseStudentAttendance(v: unknown): StudentAttendance {
  if (!isObj(v) || !Array.isArray(v.records)) throw parseError(STUDENT_PORTAL_PATHS.attendance);
  const s = isObj(v.stats) ? v.stats : {};
  return {
    records: v.records.filter(isObj).map((r) => ({
      id: num(r.id),
      date: String(r.date ?? ''),
      status: normalizeStatus(r.status),
    })),
    stats: {
      present: num(s.present),
      absent: num(s.absent),
      runAwayed: num(s.runAwayed),
      total: num(s.total),
      attendanceRate: s.attendanceRate == null ? null : num(s.attendanceRate),
    },
  };
}

const dateMs = (v: string | null) => {
  if (!v) return null;
  const t = Date.parse(v.split('T')[0]!);
  return Number.isNaN(t) ? null : t;
};

/** comparePublishedExams() from pages/Students/Result.tsx: start date, then result date, then id. */
export function comparePublishedExams(a: PublishedExam, b: PublishedExam): number {
  for (const k of ['start_date', 'result_date'] as const) {
    const x = dateMs(a[k]);
    const y = dateMs(b[k]);
    if (x !== null && y !== null && x !== y) return x - y;
    if (x !== null && y === null) return -1;
    if (x === null && y !== null) return 1;
  }
  return a.id - b.id;
}

/** Published (visible) exams of one session, sorted like the web page. */
/**
 * Published (visible) exams of one session, sorted like the web page. With `studentClass`, only
 * the exams that include that class: a student never sees another class's exams.
 */
export function parsePublishedExams(
  v: unknown,
  year: number,
  studentClass?: number,
): PublishedExam[] {
  if (!Array.isArray(v)) throw parseError(STUDENT_PORTAL_PATHS.exams);
  return v
    .filter(isObj)
    .filter((e) => e.visible === true && num(e.exam_year) === year)
    .map((e) => ({
      id: num(e.id),
      exam_name: String(e.exam_name ?? ''),
      exam_year: num(e.exam_year),
      start_date: str(e.start_date),
      result_date: str(e.result_date),
      levels: Array.isArray(e.levels)
        ? e.levels.map((x) => num(x, Number.NaN)).filter((x) => Number.isInteger(x))
        : [],
    }))
    .filter((e) => studentClass === undefined || e.levels.includes(studentClass))
    .sort(comparePublishedExams);
}

export function parseMarks(v: unknown): SubjectMark[] {
  if (!Array.isArray(v)) throw parseError('/api/marks/students');
  return v
    .filter(isObj)
    .map((m) => ({
      subject: String(m.subject ?? ''),
      marks: m.marks == null ? null : num(m.marks),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export const totalMarks = (rows: readonly SubjectMark[]) =>
  rows.reduce((sum, r) => sum + (r.marks ?? 0), 0);

export function parseNotices(v: unknown): Notice[] {
  if (!Array.isArray(v)) throw parseError(STUDENT_PORTAL_PATHS.notices);
  return v.filter(isObj).map((n) => ({
    id: num(n.id),
    title: String(n.title ?? ''),
    file: str(n.file),
    download_url: str(n.download_url),
    created_at: String(n.created_at ?? ''),
  }));
}

export function createStudentPortalApi(client: ApiClient) {
  return {
    async me(year: number, signal?: AbortSignal) {
      return parseProfile(await client.get(STUDENT_PORTAL_PATHS.me, { query: { year }, signal }));
    },
    /** `month` is 0-11 like the server and the web page. */
    async attendance(p: { month: number; year: number }, signal?: AbortSignal) {
      return parseStudentAttendance(
        await client.get(STUDENT_PORTAL_PATHS.attendance, { query: p, signal }),
      );
    },
    async attendanceOf(
      p: { studentId: number; month: number; year: number },
      signal?: AbortSignal,
    ) {
      return parseStudentAttendance(
        await client.get(STUDENT_PORTAL_PATHS.attendanceOf(p.studentId), {
          query: { month: p.month, year: p.year },
          signal,
        }),
      );
    },
    /**
     * Sessions where this student has marks in a published exam of their class (newest first).
     * Only sessions the student was really enrolled in count: for any other year the server
     * answers with the latest enrollment, so the profile alone proves nothing.
     */
    async resultYears(signal?: AbortSignal): Promise<number[]> {
      const [exams, me] = await Promise.all([
        client.get(STUDENT_PORTAL_PATHS.exams, { signal }),
        client.get(STUDENT_PORTAL_PATHS.me, { signal }).then(parseProfile),
      ]);
      const hasMarks = async (year: number, exam: string) => {
        try {
          const rows = parseMarks(
            await client.get(STUDENT_PORTAL_PATHS.marks(me.id), { query: { year, exam }, signal }),
          );
          return rows.some((r) => r.marks !== null);
        } catch (e) {
          // 4xx (not published / nothing for this exam) means no data; real failures surface.
          if (e instanceof ApiError && e.status != null && e.status < 500) return false;
          throw e;
        }
      };
      const years = await Promise.all(
        me.enrollments
          .filter((en) => en.year <= new Date().getFullYear())
          .map(async (en) => {
            const published = parsePublishedExams(exams, en.year, en.class);
            const checks = await Promise.all(published.map((x) => hasMarks(en.year, x.exam_name)));
            return checks.some(Boolean) ? en.year : null;
          }),
      );
      return years.filter((y): y is number => y !== null).sort((x, y) => y - x);
    },
    /** Published exams of the session that include the class this student was in that year. */
    async publishedExams(year: number, signal?: AbortSignal) {
      const [exams, me] = await Promise.all([
        client.get(STUDENT_PORTAL_PATHS.exams, { signal }),
        client.get(STUDENT_PORTAL_PATHS.me, { query: { year }, signal }).then(parseProfile),
      ]);
      const enrolled = me.enrollments.find((en) => en.year === year);
      // Not enrolled that year: no results (never the fallback enrollment's class).
      return enrolled ? parsePublishedExams(exams, year, enrolled.class) : [];
    },
    async marks(p: { studentId: number; year: number; exam: string }, signal?: AbortSignal) {
      return parseMarks(
        await client.get(STUDENT_PORTAL_PATHS.marks(p.studentId), {
          query: { year: p.year, exam: p.exam },
          signal,
        }),
      );
    },
    async marksheetPdf(p: { studentId: number; year: number; exam: string }): Promise<Blob> {
      return client.get<Blob>(STUDENT_PORTAL_PATHS.marksheet(p.studentId), {
        query: { year: p.year, exam: p.exam },
        responseType: 'blob',
        timeoutMs: 130_000,
      });
    },
    /** Raw PDF bytes for native saving (RN's Blob has no reliable arrayBuffer()). */
    async marksheetBytes(p: {
      studentId: number;
      year: number;
      exam: string;
    }): Promise<ArrayBuffer> {
      return client.get<ArrayBuffer>(STUDENT_PORTAL_PATHS.marksheet(p.studentId), {
        query: { year: p.year, exam: p.exam },
        responseType: 'arrayBuffer',
        timeoutMs: 130_000,
      });
    },
    async notices(signal?: AbortSignal) {
      return parseNotices(await client.get(STUDENT_PORTAL_PATHS.notices, { signal }));
    },
  };
}

export type StudentPortalApi = ReturnType<typeof createStudentPortalApi>;
