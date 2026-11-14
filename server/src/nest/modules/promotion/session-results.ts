// Loads one school's session (previous + year-end) results for a year and runs the school's promotion engine.
// Plain function (prisma passed in) so both Nest and legacy Express code can call it.
import type { PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { isExamFrozen } from '@/modules/exam/exam-year-end.js';
import { sessionExamsForClass } from './session-exams.js';
import type { StudentSessionResult } from './v1/session-result.js';
import { getPromotionEngine } from './versions.js';

export type SessionResultRow = StudentSessionResult & {
  position: number;
  studentId: number;
  studentName: string;
  previousExamId: number | null;
  yearEndExamId: number;
  /** Withheld: not ranked (position 0), not written by generation. */
  held: boolean;
  /** Manual pass/fail override: generation keeps the saved status. */
  manual: boolean;
  /** What the last "Generate pass/fail" wrote (student_enrollments). The only official result. */
  saved: { status: string; merit: number; failCount: number };
};

export type SessionResults = {
  version: string;
  results: SessionResultRow[];
  /** Classes with enrolled students but no year-end exam (skipped). */
  missingYearEnd: number[];
  /** Classes 6-9 with a year-end exam but no previous exam (computed with previous = 0). */
  missingPrevious: number[];
};

// ponytail: Map.groupBy needs lib es2024; swap in once tsconfig targets it.
const groupBy = <T, K>(items: T[], key: (item: T) => K) => {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
};

export async function loadSessionResults(
  prisma: PrismaClient,
  schoolId: number,
  year: number,
  opts: { classLevel?: number; enrollmentIds?: number[] } = {},
): Promise<SessionResults> {
  const [school, exams, passRules] = await Promise.all([
    prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { promotionVersion: true },
    }),
    prisma.exams.findMany({
      where: { school_id: schoolId, exam_year: year },
      select: {
        id: true,
        levels: true,
        is_year_end: true,
        exam_type: { select: { sort_order: true } },
      },
    }),
    prisma.promotion_pass_rules.findMany({
      where: { school_id: schoolId, year },
      select: { class: true, max_failed: true },
    }),
  ]);
  const engine = getPromotionEngine(school.promotionVersion);
  const sessionExams = exams.map((e) => ({ ...e, sort_order: e.exam_type.sort_order }));

  // Whole classes are always loaded: positions rank the full class even when output is filtered.
  const enrollments = await prisma.student_enrollments.findMany({
    where: {
      school_id: schoolId,
      year,
      student: { available: true },
      ...(opts.classLevel != null && { class: opts.classLevel }),
    },
    select: {
      id: true,
      student_id: true,
      class: true,
      group: true,
      section: true,
      roll: true,
      fourth_subject_id: true,
      result_held: true,
      result_manual: true,
      release_batch: true,
      status: true,
      final_merit: true,
      fail_count: true,
      student: { select: { name: true } },
    },
  });

  const classes = [...new Set(enrollments.map((e) => e.class))].sort((a, b) => a - b);
  const examsByClass = new Map(classes.map((c) => [c, sessionExamsForClass(sessionExams, c)]));
  const missingYearEnd = classes.filter((c) => !examsByClass.get(c));
  const missingPrevious = classes.filter((c) => {
    const ex = examsByClass.get(c);
    return ex && ex.previousExamId == null && engine.examsForClass(c) === 'both';
  });

  const computable = enrollments.filter((e) => examsByClass.get(e.class));
  const examIds = [
    ...new Set(
      [...examsByClass.values()].flatMap((ex) => (ex ? [ex.yearEndExamId, ex.previousExamId] : [])),
    ),
  ].filter((id): id is number => id != null);

  const [subjects, marks] = await Promise.all([
    prisma.subjects.findMany({
      where: { school_id: schoolId, year, class: { in: classes } },
      select: {
        id: true,
        name: true,
        class: true,
        group: true,
        priority: true,
        parent_id: true,
        subject_type: true,
        assessment_type: true,
        marking_scheme: true,
        full_mark: true,
        pass_mark: true,
        cq_mark: true,
        mcq_mark: true,
        practical_mark: true,
        cq_pass_mark: true,
        mcq_pass_mark: true,
        practical_pass_mark: true,
      },
    }),
    prisma.marks.findMany({
      where: {
        school_id: schoolId,
        exam_id: { in: examIds },
        enrollment_id: { in: computable.map((e) => e.id) },
      },
      select: {
        enrollment_id: true,
        subject_id: true,
        exam_id: true,
        marks: true,
        cq_marks: true,
        mcq_marks: true,
        practical_marks: true,
      },
    }),
  ]);

  const subjectsByClass = groupBy(subjects, (s) => s.class);
  const marksByEnrollment = groupBy(marks, (m) => m.enrollment_id);
  const maxFailed = new Map(passRules.map((r) => [r.class, r.max_failed]));

  const computed = computable.map((e) => {
    const ex = examsByClass.get(e.class)!;
    return {
      e,
      ex,
      result: {
        ...engine.computeStudentResult({
          enrollmentId: e.id,
          classLevel: e.class,
          group: e.group,
          section: e.section,
          roll: e.roll,
          fourthSubjectId: e.fourth_subject_id,
          subjects: subjectsByClass.get(e.class) ?? [],
          marks: marksByEnrollment.get(e.id) ?? [],
          previousExamId: ex.previousExamId,
          yearEndExamId: ex.yearEndExamId,
          maxAllowedFails: maxFailed.get(e.class) ?? 0,
        }),
        releaseBatch: e.release_batch,
      },
    };
  });
  // Held students are not ranked, so releasing or regenerating never shifts anyone's merit.
  const positions = engine.rankStudents(
    computed.filter((c) => !c.e.result_held).map((c) => c.result),
  );

  const classResults = new Map<string, typeof computed>();
  for (const item of computed) {
    const key = String(item.e.class);
    const list = classResults.get(key);
    if (list) list.push(item);
    else classResults.set(key, [item]);
  }
  for (const [key, list] of classResults) {
    const highestBySubject: Record<number, number> = {};
    for (const item of list) {
      for (const subject of item.result.subjects) {
        highestBySubject[subject.subjectId] = Math.max(
          highestBySubject[subject.subjectId] ?? 0,
          subject.combined,
        );
        for (const paper of subject.papers ?? []) {
          highestBySubject[paper.subjectId] = Math.max(
            highestBySubject[paper.subjectId] ?? 0,
            paper.combined,
          );
        }
      }
    }
    const classHighestTotal = Math.max(...list.map(({ result }) => result.totalMarks), 0);
    const classHighestGrandTotal = Math.max(...list.map(({ result }) => result.grandTotal), 0);
    for (const item of list) {
      item.result.classHighestBySubject = highestBySubject;
      item.result.classHighestTotal = classHighestTotal;
      item.result.classHighestGrandTotal = classHighestGrandTotal;
      for (const subject of item.result.subjects) {
        subject.classHighestMark = highestBySubject[subject.subjectId] ?? 0;
        for (const paper of subject.papers ?? []) {
          paper.classHighestMark = highestBySubject[paper.subjectId] ?? 0;
        }
      }
    }
    classResults.set(key, list);
  }

  const wanted = opts.enrollmentIds && new Set(opts.enrollmentIds);
  const results = computed
    .filter(({ e }) => !wanted || wanted.has(e.id))
    .map(({ e, ex, result }) => ({
      ...result,
      position: positions.get(e.id) ?? 0,
      studentId: e.student_id,
      studentName: e.student.name,
      previousExamId: ex.previousExamId,
      yearEndExamId: ex.yearEndExamId,
      held: e.result_held,
      manual: e.result_manual,
      saved: { status: e.status, merit: e.final_merit, failCount: e.fail_count },
    }))
    .sort((a, b) => a.classLevel - b.classLevel || a.position - b.position);

  return { version: school.promotionVersion, results, missingYearEnd, missingPrevious };
}

/** Status generation writes for a row: a manual override keeps its saved status. */
export const generatedStatus = (r: SessionResultRow) =>
  r.manual ? r.saved.status : r.isFailed ? 'Failed' : 'Passed';

/** Saved result no longer matches the marks/rules (held rows are never written). */
export const isResultStale = (r: SessionResultRow) =>
  !r.held &&
  (r.saved.merit !== r.position ||
    r.saved.failCount !== r.failCount ||
    r.saved.status !== generatedStatus(r));

/**
 * Result printed on marksheets: only what generation saved, never the live calculation.
 * null = not generated yet (shown as "-").
 */
export function officialResult(r: SessionResultRow): string | null {
  if (r.held) return 'Withheld';
  const decided = r.saved.merit > 0 || r.manual;
  return decided && (r.saved.status === 'Passed' || r.saved.status === 'Failed')
    ? r.saved.status
    : null;
}

/** Classes whose results were generated (some student has a saved rank). */
export async function generatedClasses(prisma: PrismaClient, schoolId: number, year: number) {
  const rows = await prisma.student_enrollments.findMany({
    where: { school_id: schoolId, year, final_merit: { gt: 0 }, student: { available: true } },
    select: { class: true },
    distinct: ['class'],
  });
  return rows.map((r) => r.class);
}

export type YearEndOfClass = {
  examId: number;
  examName: string;
  resultDate: string;
  /** Result date has passed: results are final, automatic refresh stops. */
  locked: boolean;
};

/**
 * Each class's own year-end exam. Classes can finish at different times (e.g. class 10's Test in
 * November, classes 6-9's Annual in December), so generation, refresh and locking go per class.
 */
export async function yearEndByClass(
  prisma: PrismaClient,
  schoolId: number,
  year: number,
): Promise<Map<number, YearEndOfClass>> {
  const exams = await prisma.exams.findMany({
    where: { school_id: schoolId, exam_year: year },
    select: {
      id: true,
      exam_name: true,
      levels: true,
      is_year_end: true,
      result_date: true,
      exam_type: { select: { sort_order: true } },
    },
  });
  const sessionExams = exams.map((e) => ({ ...e, sort_order: e.exam_type.sort_order }));
  const classes = [...new Set(exams.filter((e) => e.is_year_end).flatMap((e) => e.levels))];
  const out = new Map<number, YearEndOfClass>();
  for (const c of classes) {
    const id = sessionExamsForClass(sessionExams, c)?.yearEndExamId;
    const exam = exams.find((e) => e.id === id);
    if (!exam) continue;
    out.set(c, {
      examId: exam.id,
      examName: exam.exam_name,
      resultDate: exam.result_date,
      locked: isExamFrozen(exam.result_date),
    });
  }
  return out;
}

/** Year-end marks still missing on this row (a subject with no year-end mark). */
export const missingYearEndMarks = (r: SessionResultRow) =>
  r.subjects.some((s) => s.yearEnd.marks == null);

/**
 * Compute and save pass/fail, fail count and rank for the year. Only rows that changed are written.
 * Load + write run in one transaction under a per-(school, year) advisory lock, so a manual
 * "Generate" and the automatic refresh never interleave and the last writer used the latest marks.
 * Held students are never written. `classes` limits the write to those classes (each class is
 * generated when its own year-end exam is done); `only` to those enrollments (release).
 */
export async function writeSessionResults(
  schoolId: number,
  year: number,
  scope: { only?: number[]; classes?: number[] } = {},
) {
  const { only, classes } = scope;
  return rlsTransaction(
    async (tx) => {
      // Namespaced key: no clash with any other advisory lock on (schoolId, year).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`session-results:${schoolId}:${year}`}))`;
      const sr = await loadSessionResults(tx as unknown as PrismaClient, schoolId, year);
      const results = sr.results.filter(
        (r) =>
          !sr.missingPrevious.includes(r.classLevel) &&
          !r.held &&
          (!classes || classes.includes(r.classLevel)) &&
          (!only || only.includes(r.enrollmentId)),
      );
      const changed = results.filter(isResultStale);
      for (const r of changed) {
        await tx.student_enrollments.update({
          where: { id: r.enrollmentId, school_id: schoolId },
          data: {
            ...(!r.manual && { status: r.isFailed ? 'Failed' : 'Passed' }),
            fail_count: r.failCount,
            final_merit: r.position,
          },
        });
      }
      return {
        results,
        missingYearEnd: sr.missingYearEnd,
        missingPrevious: sr.missingPrevious,
        changedClasses: [...new Set(changed.map((r) => r.classLevel))],
      };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
