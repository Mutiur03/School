/**
 * Year-end results + promotion (Nest, admin only), verified against
 * server/src/nest/modules/promotion/ (promotions.controller.ts, graduations.controller.ts, dto/)
 * and dashboard/src/queries/promotion.queries.ts:
 *
 *   GET   /api/promotions/:year/stats                 counts for the three steps
 *   GET   /api/promotions/:year/pass-rules            [{ class, max_failed }]
 *   PUT   /api/promotions/:year/pass-rules { rules }  class ∈ 6–10, 0 ≤ max_failed ≤ 15
 *   POST  /api/promotions/:year/results               generate pass/fail + merit
 *   PATCH /api/promotions/:year/results/:enrollmentId { status }   manual override
 *   GET   /api/promotions/:year/results/:enrollmentId/placement?status   where a status change lands them next year
 *   DELETE /api/promotions/:year/results/:enrollmentId/override         back to the calculated result
 *   GET   /api/promotions/:year/corrections/plan   dry run;  POST /api/promotions/:year/corrections { options }
 *   POST  /api/promotions/:year/results/holds    { enrollment_ids }
 *   POST  /api/promotions/:year/results/releases { enrollment_ids }
 *   GET   /api/promotions/:year/plan              dry run;  POST /api/promotions/:year  commits
 *   POST  /api/promotions/:year/retained          number failed class-6 students
 *   GET   /api/graduations/:year/plan             dry run;  POST /api/graduations/:year  commits
 *   POST  /api/graduations/:year/retained         failed class-10 students → next year's class 10
 *   GET   /api/marksheets/students/:id/session?year   PDF;  GET /api/marksheets/session?year  PDF
 */
import type { ApiClient } from './client';
import { ApiError } from './errors';
import {
  bool,
  isObj,
  num,
  numOrNull,
  objArray,
  parseError,
  str,
  strOrNull,
  type Json,
} from './parse';

export const PASS_RULE_CLASSES = [6, 7, 8, 9, 10] as const;
export const MAX_FAILED_LIMIT = 15;
export type EnrollmentStatus = 'Passed' | 'Failed' | 'Pending';
export const ENROLLMENT_STATUS_OPTIONS: readonly EnrollmentStatus[] = [
  'Passed',
  'Failed',
  'Pending',
];

export interface PassRule {
  class: number;
  max_failed: number;
}

interface Tally {
  passed: number;
  failed: number;
  pending: number;
  graduated: number;
  total: number;
}

export interface PromotionStats {
  year: number;
  newYear: number;
  promotion: Tally;
  class10: Tally;
  promoted: boolean;
  next_year_enrollments: number;
  awaiting_roll: number;
  /** After promotion: Passed/Failed students still without a next-year class (results changed since). */
  unplaced: number;
  /** Class-10 students still Failed after graduation (the Retain button's count). */
  awaiting_retain: number;
  graduated: boolean;
  /** Last runs (null = never run, or run before runs were recorded). */
  promotion_run: RunInfo | null;
  graduation_run: RunInfo | null;
}

export interface RunInfo {
  ran_at: string;
  ran_by: string | null;
}

/** Where a result change puts the student next year when promotion/graduation already ran. */
export interface Placement {
  enrollment_id: number;
  name: string;
  class: number;
  /** none = class not promoted yet; move with new_roll null = waits for Assign retained. */
  action: 'none' | 'remove' | 'graduate' | 'unchanged' | 'move';
  new_class: number | null;
  new_section: string | null;
  new_roll: number | null;
}

export type CorrectionKey =
  'reset_promotion' | 'undo_graduation' | 'clear_manual' | 'reset_release_batches';

/** Dry run of "Correct mistakes": what each option would change; `with_marks` > 0 blocks it. */
export interface CorrectionsPreview {
  year: number;
  newYear: number;
  reset_promotion: { available: boolean; rows: number; with_marks: number };
  undo_graduation: { available: boolean; graduated: number; rows: number; with_marks: number };
  clear_manual: { available: boolean; students: number };
  reset_release_batches: { available: boolean; students: number };
}

export interface CorrectionsResult {
  newYear: number;
  promotion_rows_removed: number;
  graduation_undone: number;
  graduation_rows_removed: number;
  manual_cleared: number;
  batches_reset: number;
  regenerated: boolean;
  placements: Placement[];
}

export interface PromotionPlanRow {
  enrollment_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  status: string;
  final_merit: number;
  new_class: number;
  new_section: string;
  new_roll: number | null;
  /** Not auto-promoted (failed, manual, late release): keeps its order after the auto block on re-runs. */
  locked: boolean;
}

/** In the year's results but left out of promotion/graduation (TC'd students never appear). */
export interface SkippedStudent {
  enrollment_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  /** held = result withheld; no_result = no Passed/Failed status yet. */
  reason: 'held' | 'no_result';
}

export interface PromotionPlan {
  year: number;
  newYear: number;
  students: PromotionPlanRow[];
  skipped_students: SkippedStudent[];
  summary: {
    total: number;
    passed_promoted: number;
    failed_retained: number;
    awaiting_roll: number;
    /** New class-6 admissions already exist next year, so retained students are numbered at once. */
    class6_admissions: boolean;
    skipped: number;
    section_a: number;
    section_b: number;
    existing_next_year_enrollments: number;
    subjects_will_clone: boolean;
  };
}

export interface GraduationPlanRow {
  enrollment_id: number;
  name: string;
  section: string;
  roll: number;
  status: string;
  final_merit: number;
  action: 'graduate' | 'hold';
  ssc_batch: string | null;
}

export interface GraduationPlan {
  year: number;
  newYear: number;
  sscBatch: string;
  students: GraduationPlanRow[];
  skipped_students: SkippedStudent[];
  summary: {
    total: number;
    graduates: number;
    held: number;
    skipped: number;
  };
}

export interface GenerateResultsOutcome {
  passed: number | null;
  failed: number | null;
  missingYearEnd: number[];
  missingPrevious: number[];
}

export const PROMOTION_PATHS = {
  stats: (y: number) => `/api/promotions/${y}/stats`,
  rules: (y: number) => `/api/promotions/${y}/pass-rules`,
  results: (y: number) => `/api/promotions/${y}/results`,
  result: (y: number, enrollmentId: number) => `/api/promotions/${y}/results/${enrollmentId}`,
  holds: (y: number) => `/api/promotions/${y}/results/holds`,
  placement: (y: number, enrollmentId: number) =>
    `/api/promotions/${y}/results/${enrollmentId}/placement`,
  override: (y: number, enrollmentId: number) =>
    `/api/promotions/${y}/results/${enrollmentId}/override`,
  correctionsPlan: (y: number) => `/api/promotions/${y}/corrections/plan`,
  corrections: (y: number) => `/api/promotions/${y}/corrections`,
  releases: (y: number) => `/api/promotions/${y}/results/releases`,
  plan: (y: number) => `/api/promotions/${y}/plan`,
  promote: (y: number) => `/api/promotions/${y}`,
  retained: (y: number) => `/api/promotions/${y}/retained`,
  graduationPlan: (y: number) => `/api/graduations/${y}/plan`,
  graduate: (y: number) => `/api/graduations/${y}`,
  retainClass10: (y: number) => `/api/graduations/${y}/retained`,
  sessionPdf: (studentId: number) => `/api/marksheets/students/${studentId}/session`,
  allSessionPdf: '/api/marksheets/session',
  /** Nest, admin/teacher/student (server scopes the student): on-screen session preview. */
  sessionPreview: (studentId: number) => `/api/marks/students/${studentId}/session`,
} as const;

const obj = (v: unknown, path: string): Json => {
  if (!isObj(v)) throw new ApiError({ kind: 'parse', message: 'Unexpected response.', path });
  return v;
};
const tally = (v: unknown): Tally => {
  const t = isObj(v) ? v : {};
  return {
    passed: num(t.passed),
    failed: num(t.failed),
    pending: num(t.pending),
    graduated: num(t.graduated),
    total: num(t.total),
  };
};
const numList = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => num(x, Number.NaN)).filter(Number.isFinite) : [];

export function parsePromotionStats(v: unknown, year: number): PromotionStats {
  const s = obj(v, PROMOTION_PATHS.stats(year));
  return {
    year: num(s.year, year),
    newYear: num(s.newYear, year + 1),
    promotion: tally(s.promotion),
    class10: tally(s.class10),
    promoted: bool(s.promoted),
    next_year_enrollments: num(s.next_year_enrollments),
    awaiting_roll: num(s.awaiting_roll),
    unplaced: num(s.unplaced),
    awaiting_retain: num(s.awaiting_retain),
    graduated: s.graduation_run != null,
    promotion_run: parseRun(s.promotion_run),
    graduation_run: parseRun(s.graduation_run),
  };
}

function parseRun(v: unknown): RunInfo | null {
  if (!isObj(v) || typeof v.ran_at !== 'string') return null;
  return { ran_at: v.ran_at, ran_by: strOrNull(v.ran_by) };
}

const ACTIONS = ['none', 'remove', 'graduate', 'unchanged', 'move'] as const;
export function parsePlacement(v: unknown, path: string): Placement {
  const p = obj(v, path);
  return {
    enrollment_id: num(p.enrollment_id),
    name: str(p.name),
    class: num(p.class),
    action: ACTIONS.find((a) => a === p.action) ?? 'none',
    new_class: numOrNull(p.new_class),
    new_section: strOrNull(p.new_section),
    new_roll: numOrNull(p.new_roll),
  };
}

const sub = (v: unknown): Json => (isObj(v) ? v : {});
export function parseCorrectionsPreview(v: unknown, year: number): CorrectionsPreview {
  const p = obj(v, PROMOTION_PATHS.correctionsPlan(year));
  const a = sub(p.reset_promotion);
  const g = sub(p.undo_graduation);
  const m = sub(p.clear_manual);
  const r = sub(p.reset_release_batches);
  return {
    year: num(p.year, year),
    newYear: num(p.newYear, year + 1),
    reset_promotion: {
      available: bool(a.available),
      rows: num(a.rows),
      with_marks: num(a.with_marks),
    },
    undo_graduation: {
      available: bool(g.available),
      graduated: num(g.graduated),
      rows: num(g.rows),
      with_marks: num(g.with_marks),
    },
    clear_manual: { available: bool(m.available), students: num(m.students) },
    reset_release_batches: { available: bool(r.available), students: num(r.students) },
  };
}

export function parseCorrectionsResult(v: unknown, year: number): CorrectionsResult {
  const path = PROMOTION_PATHS.corrections(year);
  const p = obj(v, path);
  return {
    newYear: num(p.newYear, year + 1),
    promotion_rows_removed: num(p.promotion_rows_removed),
    graduation_undone: num(p.graduation_undone),
    graduation_rows_removed: num(p.graduation_rows_removed),
    manual_cleared: num(p.manual_cleared),
    batches_reset: num(p.batches_reset),
    regenerated: bool(p.regenerated),
    placements: Array.isArray(p.placements) ? p.placements.map((x) => parsePlacement(x, path)) : [],
  };
}

/** Saved rules for every class; a class without a saved rule is strict (0). */
export function normalizeRules(v: unknown, path = 'pass-rules'): PassRule[] {
  const saved = objArray(v, path);
  return PASS_RULE_CLASSES.map((cls) => ({
    class: cls,
    max_failed: num(saved.find((r) => num(r.class) === cls)?.max_failed, 0),
  }));
}

/** A typed rule value → integer in [0, 15]; anything else → 0 (like the web input). */
export const clampMaxFailed = (raw: string | number) => {
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_FAILED_LIMIT, Math.trunc(n))) : 0;
};

function parseSkipped(v: unknown): SkippedStudent[] {
  return (Array.isArray(v) ? v : []).filter(isObj).map((r) => ({
    enrollment_id: num(r.enrollment_id),
    name: str(r.name),
    class: num(r.class),
    section: str(r.section),
    roll: num(r.roll),
    reason: r.reason === 'held' ? 'held' : 'no_result',
  }));
}

export function parsePlan(v: unknown, year: number): PromotionPlan {
  const p = obj(v, PROMOTION_PATHS.plan(year));
  const s = isObj(p.summary) ? p.summary : {};
  return {
    year: num(p.year, year),
    newYear: num(p.newYear, year + 1),
    students: (Array.isArray(p.students) ? p.students : []).filter(isObj).map((r) => ({
      enrollment_id: num(r.enrollment_id),
      name: str(r.name),
      class: num(r.class),
      section: str(r.section),
      roll: num(r.roll),
      status: str(r.status),
      final_merit: num(r.final_merit),
      new_class: num(r.new_class),
      new_section: str(r.new_section),
      new_roll: numOrNull(r.new_roll),
      locked: r.locked === true,
    })),
    skipped_students: parseSkipped(p.skipped_students),
    summary: {
      total: num(s.total),
      passed_promoted: num(s.passed_promoted),
      failed_retained: num(s.failed_retained),
      awaiting_roll: num(s.awaiting_roll),
      class6_admissions: bool(s.class6_admissions),
      skipped: num(s.skipped),
      section_a: num(s.section_a),
      section_b: num(s.section_b),
      existing_next_year_enrollments: num(s.existing_next_year_enrollments),
      subjects_will_clone: bool(s.subjects_will_clone),
    },
  };
}

export function parseGraduationPlan(v: unknown, year: number): GraduationPlan {
  const p = obj(v, PROMOTION_PATHS.graduationPlan(year));
  const s = isObj(p.summary) ? p.summary : {};
  return {
    year: num(p.year, year),
    newYear: num(p.newYear, year + 1),
    sscBatch: str(p.sscBatch),
    students: (Array.isArray(p.students) ? p.students : []).filter(isObj).map((r) => ({
      enrollment_id: num(r.enrollment_id),
      name: str(r.name),
      section: str(r.section),
      roll: num(r.roll),
      status: str(r.status),
      final_merit: num(r.final_merit),
      action: r.action === 'graduate' ? 'graduate' : 'hold',
      ssc_batch: strOrNull(r.ssc_batch),
    })),
    skipped_students: parseSkipped(p.skipped_students),
    summary: {
      total: num(s.total),
      graduates: num(s.graduates),
      held: num(s.held),
      skipped: num(s.skipped),
    },
  };
}

export function createPromotionsApi(client: ApiClient) {
  const pdf = (path: string, query: Record<string, number>) =>
    client.get<ArrayBuffer>(path, { query, responseType: 'arrayBuffer', timeoutMs: 180_000 });
  return {
    async stats(year: number, signal?: AbortSignal) {
      return parsePromotionStats(await client.get(PROMOTION_PATHS.stats(year), { signal }), year);
    },
    async passRules(year: number, signal?: AbortSignal) {
      return normalizeRules(
        await client.get(PROMOTION_PATHS.rules(year), { signal }),
        PROMOTION_PATHS.rules(year),
      );
    },
    async savePassRules(year: number, rules: readonly PassRule[]): Promise<void> {
      const body = {
        rules: rules
          .filter((r) => (PASS_RULE_CLASSES as readonly number[]).includes(r.class))
          .map((r) => ({ class: r.class, max_failed: clampMaxFailed(r.max_failed) })),
      };
      await client.put<unknown>(PROMOTION_PATHS.rules(year), body);
    },
    async generateResults(year: number): Promise<GenerateResultsOutcome> {
      const d = await client.post<unknown>(PROMOTION_PATHS.results(year));
      const o = isObj(d) ? d : {};
      return {
        passed: numOrNull(o.passed),
        failed: numOrNull(o.failed),
        missingYearEnd: numList(o.missingYearEnd),
        missingPrevious: numList(o.missingPrevious),
      };
    },
    /** Where the status change puts them next year (matters once promotion already ran). */
    async placement(
      year: number,
      enrollmentId: number,
      status: EnrollmentStatus,
      signal?: AbortSignal,
    ) {
      const path = PROMOTION_PATHS.placement(year, enrollmentId);
      return parsePlacement(await client.get(path, { query: { status }, signal }), path);
    },
    async overrideStatus(year: number, enrollmentId: number, status: EnrollmentStatus) {
      const path = PROMOTION_PATHS.result(year, enrollmentId);
      const d = await client.patch<unknown>(path, { status });
      return isObj(d) ? parsePlacement(d, path) : null;
    },
    /** "Use calculated result": drops the manual status; returns the new placement and status. */
    async clearOverride(year: number, enrollmentId: number) {
      const path = PROMOTION_PATHS.override(year, enrollmentId);
      const o = obj(await client.delete<unknown>(path), path);
      return { ...parsePlacement(o, path), status: str(o.status) };
    },
    async correctionsPlan(year: number, signal?: AbortSignal) {
      return parseCorrectionsPreview(
        await client.get(PROMOTION_PATHS.correctionsPlan(year), { signal }),
        year,
      );
    },
    async applyCorrections(year: number, options: Partial<Record<CorrectionKey, boolean>>) {
      return parseCorrectionsResult(
        await client.post<unknown>(PROMOTION_PATHS.corrections(year), options, {
          timeoutMs: 180_000,
        }),
        year,
      );
    },
    async hold(year: number, enrollmentIds: readonly number[]) {
      await client.post<unknown>(PROMOTION_PATHS.holds(year), {
        enrollment_ids: [...enrollmentIds],
      });
    },
    async release(year: number, enrollmentIds: readonly number[]) {
      await client.post<unknown>(PROMOTION_PATHS.releases(year), {
        enrollment_ids: [...enrollmentIds],
      });
    },
    async plan(year: number) {
      return parsePlan(await client.get(PROMOTION_PATHS.plan(year), { timeoutMs: 120_000 }), year);
    },
    async promote(year: number) {
      const d = await client.post<unknown>(PROMOTION_PATHS.promote(year), undefined, {
        timeoutMs: 180_000,
      });
      const o = isObj(d) ? d : {};
      return {
        promoted: numOrNull(o.promoted),
        awaitingRoll: num(o.awaitingRoll),
        skipped: num(o.skipped),
        newYear: num(o.newYear, year + 1),
      };
    },
    async assignRetained(year: number) {
      const d = await client.post<unknown>(PROMOTION_PATHS.retained(year));
      const o = isObj(d) ? d : {};
      return { assigned: num(o.assigned), newYear: num(o.newYear, year + 1) };
    },
    async graduationPlan(year: number) {
      return parseGraduationPlan(
        await client.get(PROMOTION_PATHS.graduationPlan(year), { timeoutMs: 120_000 }),
        year,
      );
    },
    async graduate(year: number) {
      const d = await client.post<unknown>(PROMOTION_PATHS.graduate(year), undefined, {
        timeoutMs: 180_000,
      });
      const o = isObj(d) ? d : {};
      return { graduated: numOrNull(o.graduated), held: num(o.held) };
    },
    async retainClass10(year: number) {
      const d = await client.post<unknown>(PROMOTION_PATHS.retainClass10(year));
      const o = isObj(d) ? d : {};
      return { retained: num(o.retained), newYear: num(o.newYear, year + 1) };
    },
    async sessionPreview(studentId: number, year: number, signal?: AbortSignal) {
      const path = PROMOTION_PATHS.sessionPreview(studentId);
      return parseSessionMarksheet(
        await client.get<unknown>(path, { query: { year }, signal }),
        path,
      );
    },
    sessionPdf: (studentId: number, year: number) =>
      pdf(PROMOTION_PATHS.sessionPdf(studentId), { year }),
    allSessionPdf: (year: number) => pdf(PROMOTION_PATHS.allSessionPdf, { year }),
  };
}

export interface SessionRow {
  subject: string;
  /** split: [previous, year-end, total]; otherwise [year-end]. "-" = not entered. */
  marks: string[];
  fullMark: string;
  passMark: string;
  grade: string;
  gp: string;
}

export interface SessionMarksheet {
  student: { name: string; class: number; section: string; roll: number; year: number };
  previousExam: string | null;
  yearEndExam: string;
  split: boolean;
  examRows: SessionRow[];
  continuousRows: SessionRow[];
  totals: string[];
  grandTotal: string;
  gpa: string;
  failed: boolean;
  failCount: number;
  position: number | null;
}

const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

function parseSessionRows(v: unknown, path: string): SessionRow[] {
  return objArray(v ?? [], path).map((r) => ({
    subject: str(r.subject),
    marks: Array.isArray(r.marks) ? r.marks.map(cell) : [],
    fullMark: cell(r.fullMark),
    passMark: cell(r.passMark),
    grade: cell(r.grade),
    gp: cell(r.gp),
  }));
}

export function parseSessionMarksheet(v: unknown, path: string): SessionMarksheet | null {
  if (v === null || v === undefined) return null;
  if (!isObj(v) || !isObj(v.student)) throw parseError(path);
  const s = v.student;
  const gpa = Number(v.gpa);
  return {
    student: {
      name: str(s.name),
      class: num(s.class),
      section: str(s.section),
      roll: num(s.roll),
      year: num(s.year),
    },
    previousExam: strOrNull(v.previous_exam_name),
    yearEndExam: str(v.year_end_exam_name, 'Year-end exam'),
    split: v.split === true,
    examRows: parseSessionRows(v.examRows, path),
    continuousRows: parseSessionRows(v.continuousRows, path),
    totals: Array.isArray(v.totals) ? v.totals.map(cell) : [],
    grandTotal: cell(v.grand_total),
    // Display only: the server computed it; toFixed just formats.
    gpa: Number.isFinite(gpa) ? gpa.toFixed(2) : '-',
    failed: v.is_failed === true,
    failCount: num(v.fail_count),
    position: num(v.position) > 0 ? num(v.position) : null,
  };
}

/** Column heads for the obtained-marks group. */
export const sessionMarkHeads = (m: SessionMarksheet) =>
  m.split ? [m.previousExam ?? 'Previous exam', m.yearEndExam, 'Total'] : [m.yearEndExam];

export type PromotionsApi = ReturnType<typeof createPromotionsApi>;
