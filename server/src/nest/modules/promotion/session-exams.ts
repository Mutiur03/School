export type SessionExam = {
  id: number;
  levels: number[];
  is_year_end: boolean;
  sort_order: number;
};

/**
 * Exams that make up a class's session result: the year-end exam plus the latest
 * (highest exam_type.sort_order) non-year-end exam before it that covers the class.
 * Returns null when the class has no year-end exam.
 */
export function sessionExamsForClass(
  exams: SessionExam[],
  classLevel: number,
): { yearEndExamId: number; previousExamId: number | null } | null {
  const forClass = exams.filter((exam) => exam.levels.includes(classLevel));
  const yearEnd = forClass.find((exam) => exam.is_year_end);
  if (!yearEnd) return null;
  const previous = forClass
    .filter((exam) => !exam.is_year_end && exam.sort_order < yearEnd.sort_order)
    .sort((a, b) => b.sort_order - a.sort_order)[0];
  return { yearEndExamId: yearEnd.id, previousExamId: previous?.id ?? null };
}
