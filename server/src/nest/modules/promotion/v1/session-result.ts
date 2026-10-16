// Promotion rules v1: pure session-result engine (no DB). Callers load subjects/marks and pass them in.
import type { marks, subjects } from '@/generated/prisma/client.js';

export type SubjectInput = Pick<
  subjects,
  | 'id'
  | 'name'
  | 'class'
  | 'group'
  | 'priority'
  | 'parent_id'
  | 'subject_type'
  | 'assessment_type'
  | 'marking_scheme'
  | 'full_mark'
  | 'pass_mark'
  | 'cq_mark'
  | 'mcq_mark'
  | 'practical_mark'
  | 'cq_pass_mark'
  | 'mcq_pass_mark'
  | 'practical_pass_mark'
>;

export type MarkInput = Pick<
  marks,
  'subject_id' | 'exam_id' | 'marks' | 'cq_marks' | 'mcq_marks' | 'practical_marks'
>;

export interface StudentInput {
  enrollmentId: number;
  classLevel: number;
  group: string | null;
  section: string;
  roll: number;
  fourthSubjectId: number | null;
  subjects: SubjectInput[];
  marks: MarkInput[];
  previousExamId: number | null;
  yearEndExamId: number;
  maxAllowedFails?: number;
}

export interface ExamMarks {
  marks: number | null;
  cq: number | null;
  mcq: number | null;
  practical: number | null;
}

export interface SubjectResult {
  subjectId: number;
  name: string;
  priority: number;
  isContinuous: boolean;
  isFourth: boolean;
  previous: ExamMarks | null;
  yearEnd: ExamMarks;
  combined: number;
  fullMark: number;
  passMark: number;
  grade: string;
  gp: number;
  passed: boolean;
}

export interface StudentSessionResult {
  enrollmentId: number;
  classLevel: number;
  group: string | null;
  section: string;
  roll: number;
  subjects: SubjectResult[];
  totalMarks: number;
  grandTotal: number;
  gpa: number;
  failCount: number;
  isFailed: boolean;
  /** Late-release batch (0 = on time); later batches rank after earlier ones. Set by the loader, not the engine. */
  releaseBatch?: number;
}

export type ExamMode = 'both' | 'yearEndOnly';

export const examsForClass = (classLevel: number): ExamMode =>
  classLevel === 10 ? 'yearEndOnly' : 'both';

// TOTAL-scheme pass marks keyed by class, then per-exam full mark.
// 6-9 are two-exam combined thresholds; 10 is year-end only.
const PASS_TABLE: Record<number, Record<number, number>> = {
  6: { 150: 98, 50: 30, 100: 64 },
  7: { 150: 98, 50: 30, 100: 64 },
  8: { 150: 98, 50: 30, 100: 64 },
  9: { 200: 130, 50: 30, 100: 64 },
  10: { 200: 64, 50: 15, 100: 30 },
};

const GRADES: [min: number, grade: string, gp: number][] = [
  [80, 'A+', 5],
  [70, 'A', 4],
  [60, 'A-', 3.5],
  [50, 'B', 3],
  [40, 'C', 2],
];

const gradeFor = (percentage: number) => {
  const hit = GRADES.find(([min]) => percentage >= min);
  return hit ? { grade: hit[1], gp: hit[2] } : { grade: 'D', gp: 1 };
};

const add = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);

/** Sum the marks rows of the given subject ids for one exam (paper children → main). */
const examMarks = (rows: MarkInput[], ids: Set<number>, examId: number): ExamMarks =>
  rows
    .filter((r) => r.exam_id === examId && ids.has(r.subject_id))
    .reduce<ExamMarks>(
      (acc, r) => ({
        marks: add(acc.marks, r.marks),
        cq: add(acc.cq, r.cq_marks),
        mcq: add(acc.mcq, r.mcq_marks),
        practical: add(acc.practical, r.practical_marks),
      }),
      { marks: null, cq: null, mcq: null, practical: null },
    );

const sumOf = (subs: SubjectInput[], key: keyof SubjectInput) =>
  subs.reduce((s, x) => s + Number(x[key] ?? 0), 0);

export function computeStudentResult(input: StudentInput): StudentSessionResult {
  const { classLevel, group, fourthSubjectId, yearEndExamId } = input;
  const both = examsForClass(classLevel) === 'both';
  const M = both ? 2 : 1;

  // Only the student's class (and group for 9-10); leftover cross-group rows drop out here.
  const own = input.subjects.filter(
    (s) => s.class === classLevel && (classLevel < 9 || s.group == null || s.group === group),
  );

  const results: SubjectResult[] = [];
  for (const unit of own.filter((s) => s.subject_type !== 'paper')) {
    const papers = own.filter((s) => s.subject_type === 'paper' && s.parent_id === unit.id);
    const parts = unit.subject_type === 'main' ? papers : [unit];
    if (!parts.length) continue;

    const ids = new Set(parts.map((p) => p.id));
    const yearEnd = examMarks(input.marks, ids, yearEndExamId);
    // ponytail: a missing previousExamId for 6-9 counts as 0 marks (strict v1 rule), not as year-end only.
    const previous = both
      ? input.previousExamId == null
        ? { marks: null, cq: null, mcq: null, practical: null }
        : examMarks(input.marks, ids, input.previousExamId)
      : null;
    const comb = (k: keyof ExamMarks) => (yearEnd[k] ?? 0) + (previous?.[k] ?? 0);

    const examFull = sumOf(parts, 'full_mark');
    const combined = comb('marks');
    const fullMark = examFull * M;
    const isContinuous = unit.assessment_type !== 'exam';
    const isFourth = unit.id === fourthSubjectId;

    let passMark = 0;
    let passed = true;
    if (!isContinuous) {
      if (parts.some((p) => p.marking_scheme === 'BREAKDOWN')) {
        passMark = sumOf(parts, 'pass_mark') * M;
        const components: [keyof ExamMarks, keyof SubjectInput, keyof SubjectInput][] = [
          ['cq', 'cq_mark', 'cq_pass_mark'],
          ['mcq', 'mcq_mark', 'mcq_pass_mark'],
          ['practical', 'practical_mark', 'practical_pass_mark'],
        ];
        passed =
          combined >= passMark &&
          components.every(
            ([k, full, pass]) => sumOf(parts, full) <= 0 || comb(k) >= sumOf(parts, pass) * M,
          );
      } else {
        passMark = PASS_TABLE[classLevel]?.[examFull] ?? sumOf(parts, 'pass_mark') * M;
        passed = combined >= passMark;
      }
    }

    const { grade, gp } = passed
      ? gradeFor(fullMark > 0 ? (combined / fullMark) * 100 : 0)
      : { grade: 'F', gp: 0 };

    results.push({
      subjectId: unit.id,
      name: unit.name,
      priority: unit.priority,
      isContinuous,
      isFourth,
      previous,
      yearEnd,
      combined,
      fullMark,
      passMark,
      grade,
      gp,
      passed,
    });
  }
  results.sort((a, b) => a.priority - b.priority);

  const exam = results.filter((r) => !r.isContinuous);
  const compulsory = exam.filter((r) => !r.isFourth);
  const fourth = exam.find((r) => r.isFourth);
  const failCount = compulsory.filter((r) => !r.passed).length;
  const isFailed = failCount > Math.max(0, input.maxAllowedFails ?? 0);
  const totalMarks = exam.reduce((s, r) => s + r.combined, 0);
  const grandTotal =
    totalMarks + results.filter((r) => r.isContinuous).reduce((s, r) => s + r.combined, 0);

  // Plain average over compulsory subjects. Legacy calculateGPA's 9-10 "no 4th subject"
  // normalization ((sum-2)/(n-1)) compensated for the class-wide bonus rule; v1 uses the
  // per-student fourth_subject_id, so it is intentionally not mirrored.
  const bonus = fourth && fourth.gp > 2 ? fourth.gp - 2 : 0;
  const gpaRaw =
    isFailed || !compulsory.length
      ? 0
      : (compulsory.reduce((s, r) => s + r.gp, 0) + bonus) / compulsory.length;
  const gpa = Math.round(Math.min(gpaRaw, 5) * 100) / 100;

  return {
    enrollmentId: input.enrollmentId,
    classLevel,
    group: input.group,
    section: input.section,
    roll: input.roll,
    subjects: results,
    totalMarks,
    grandTotal,
    gpa,
    failCount,
    isFailed,
  };
}

/** Merit position per enrollment: by class (+ group for class 10 only; class 9 ranks across groups), passed first, then release batch, then marks/GPA/section/roll. */
export function rankStudents(results: StudentSessionResult[]): Map<number, number> {
  const buckets = new Map<string, StudentSessionResult[]>();
  for (const r of results) {
    const key = `${r.classLevel}|${r.classLevel === 10 ? (r.group ?? '') : ''}`;
    buckets.set(key, [...(buckets.get(key) ?? []), r]);
  }
  const positions = new Map<number, number>();
  for (const list of buckets.values()) {
    list
      .sort(
        (a, b) =>
          Number(a.isFailed) - Number(b.isFailed) ||
          (a.releaseBatch ?? 0) - (b.releaseBatch ?? 0) ||
          b.totalMarks - a.totalMarks ||
          b.gpa - a.gpa ||
          a.section.localeCompare(b.section) ||
          a.roll - b.roll,
      )
      .forEach((r, i) => positions.set(r.enrollmentId, i + 1));
  }
  return positions;
}

export const v1Engine = { computeStudentResult, rankStudents, examsForClass };
