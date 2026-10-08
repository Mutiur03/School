// Loads one school's session (previous + year-end) results for a year and runs the school's promotion engine.
// Plain function (prisma passed in) so both Nest and legacy Express code can call it.
import type { PrismaClient } from '@/generated/prisma/client.js';
import { sessionExamsForClass } from './session-exams.js';
import type { StudentSessionResult } from './v1/session-result.js';
import { getPromotionEngine } from './versions.js';

export type SessionResultRow = StudentSessionResult & {
  position: number;
  studentId: number;
  studentName: string;
  previousExamId: number | null;
  yearEndExamId: number;
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
      result: engine.computeStudentResult({
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
    };
  });
  const positions = engine.rankStudents(computed.map((c) => c.result));

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
    }))
    .sort(
      (a, b) =>
        a.classLevel - b.classLevel ||
        (a.group ?? '').localeCompare(b.group ?? '') ||
        a.position - b.position,
    );

  return { version: school.promotionVersion, results, missingYearEnd, missingPrevious };
}
