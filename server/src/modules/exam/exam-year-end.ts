export type YearEndExam = { id: number; levels: number[]; exam_name?: string };

export type YearEndCascadeInstance = {
  id: number;
  school_id: number;
  exam_year: number;
  levels: number[];
  result_date: string | null;
  is_year_end: boolean;
};

export type YearEndCascadeOther = {
  school_id: number;
  exam_year: number;
  exam_name: string;
  levels: number[];
};

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/** result_date (YYYY-MM-DD) strictly before today → frozen. Missing/unparseable → open. */
export function isExamFrozen(
  resultDate: string | null | undefined,
  today: string = localToday(),
): boolean {
  if (!resultDate) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(resultDate.trim());
  if (!m) return false;
  return `${m[1]}-${m[2]}-${m[3]}` < today;
}

export function planYearEndCascade(
  nextFlag: boolean,
  instances: YearEndCascadeInstance[],
  others: YearEndCascadeOther[],
  today: string = localToday(),
): { updateIds: number[]; skippedFrozen: number; skippedOverlap: number } {
  const othersByKey = new Map<string, YearEndCascadeOther[]>();
  for (const other of others) {
    const key = `${other.school_id}:${other.exam_year}`;
    const list = othersByKey.get(key);
    if (list) list.push(other);
    else othersByKey.set(key, [other]);
  }

  const updateIds: number[] = [];
  let skippedFrozen = 0;
  let skippedOverlap = 0;

  for (const exam of instances) {
    if (exam.is_year_end === nextFlag) continue;
    if (isExamFrozen(exam.result_date, today)) {
      skippedFrozen += 1;
      continue;
    }
    if (nextFlag) {
      const clash = overlappingYearEndName(
        exam.levels,
        othersByKey.get(`${exam.school_id}:${exam.exam_year}`) ?? [],
      );
      if (clash) {
        skippedOverlap += 1;
        continue;
      }
    }
    updateIds.push(exam.id);
  }

  return { updateIds, skippedFrozen, skippedOverlap };
}

export function levelsOverlap(a: number[], b: number[]): boolean {
  return a.some((level) => b.includes(level));
}

export function overlappingYearEndName(
  levels: number[],
  others: { exam_name: string; levels: number[] }[],
): string | null {
  const hit = others.find((other) => levelsOverlap(levels, other.levels));
  return hit?.exam_name ?? null;
}

export function yearEndExamIdForClass(
  yearEndExams: YearEndExam[],
  classNum: number,
): number | undefined {
  return yearEndExams.find((exam) => exam.levels.includes(classNum))?.id;
}

export function missingYearEndClasses(yearEndExams: YearEndExam[], classes: number[]): number[] {
  return classes.filter((classNum) => yearEndExamIdForClass(yearEndExams, classNum) === undefined);
}
