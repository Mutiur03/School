import type { Prisma } from '@/generated/prisma/client.js';

// Pure grading/aggregation shared by the marksheet renderer and the class summary (no DB).

const GROUPED_CLASSES = new Set([9, 10]);

export type ClassStatsSnapshot = {
  highestBySubject: Record<number, number>;
  classHighestTotal: number;
  classHighestGrandTotal: number;
};

export type StatsByGroup = Record<string, ClassStatsSnapshot>;

export type MarksheetSubject = Prisma.subjectsGetPayload<{
  select: typeof MARKSHEET_SUBJECT_SELECT;
}>;

export function isGroupedClass(klass: number): boolean {
  return GROUPED_CLASSES.has(klass);
}

export function normalizeStudentGroup(group: string | null | undefined): string | null {
  const g = typeof group === 'string' ? group.trim() : '';
  return g || null;
}

export function statsFromRow(
  statsRow: {
    highest_by_subject: unknown;
    class_highest_total: number;
    class_highest_grand_total: number;
    stats_by_group?: unknown;
  } | null,
  klass: number,
  group: string | null | undefined,
): ClassStatsSnapshot | null {
  if (!statsRow) return null;
  if (isGroupedClass(klass)) {
    const groupName = normalizeStudentGroup(group);
    if (!groupName) return null;
    const byGroup = (statsRow.stats_by_group ?? {}) as StatsByGroup;
    const gStats = byGroup[groupName];
    if (!gStats) return null;
    return {
      highestBySubject: gStats.highestBySubject ?? {},
      classHighestTotal: gStats.classHighestTotal ?? 0,
      classHighestGrandTotal: gStats.classHighestGrandTotal ?? 0,
    };
  }
  return {
    highestBySubject: (statsRow.highest_by_subject as Record<number, number>) ?? {},
    classHighestTotal: statsRow.class_highest_total ?? 0,
    classHighestGrandTotal: statsRow.class_highest_grand_total ?? 0,
  };
}

export function classStatsEqual(
  a: {
    highestBySubject: unknown;
    classHighestTotal: number;
    classHighestGrandTotal: number;
    statsByGroup?: unknown;
  },
  b: {
    highestBySubject: unknown;
    classHighestTotal: number;
    classHighestGrandTotal: number;
    statsByGroup?: unknown;
  },
): boolean {
  return (
    a.classHighestTotal === b.classHighestTotal &&
    a.classHighestGrandTotal === b.classHighestGrandTotal &&
    JSON.stringify(a.highestBySubject) === JSON.stringify(b.highestBySubject) &&
    JSON.stringify(a.statsByGroup ?? null) === JSON.stringify(b.statsByGroup ?? null)
  );
}

/** Subjects that appear as marksheet rows (papers + singles; not main parents). */
export const MARKSHEET_SUBJECT_SELECT = {
  id: true,
  name: true,
  priority: true,
  assessment_type: true,
  full_mark: true,
  pass_mark: true,
  cq_mark: true,
  mcq_mark: true,
  practical_mark: true,
  cq_pass_mark: true,
  mcq_pass_mark: true,
  practical_pass_mark: true,
  marking_scheme: true,
  subject_type: true,
  parent_id: true,
  group: true,
  parent: { select: { name: true } },
} as const;

export function subjectMatchesStudentGroup(
  subject: { group?: string | null },
  studentGroup?: string | null,
) {
  if (!studentGroup) return true;
  return !subject.group || subject.group === '' || subject.group === studentGroup;
}

/**
 * Ensure every class subject appears on the sheet. Subjects with no marks row
 * are rendered as "-" (null marks) instead of being omitted.
 */
export function fillMissingSubjectMarks(
  existingMarks: any[],
  subjects: MarksheetSubject[],
  studentGroup: string | null | undefined,
  base: {
    enrollment_id: number;
    exam_id: number;
    enrollment?: any;
    exam?: any;
  },
) {
  const bySubjectId = new Map<number, any>();
  for (const m of existingMarks) {
    bySubjectId.set(m.subject_id, m);
  }

  const filled: any[] = [];
  for (const sub of subjects) {
    if (!subjectMatchesStudentGroup(sub, studentGroup)) continue;
    const existing = bySubjectId.get(sub.id);
    if (existing) {
      filled.push(existing);
      bySubjectId.delete(sub.id);
    } else {
      filled.push({
        enrollment_id: base.enrollment_id,
        exam_id: base.exam_id,
        subject_id: sub.id,
        cq_marks: null,
        mcq_marks: null,
        practical_marks: null,
        marks: null,
        enrollment: base.enrollment ?? existingMarks[0]?.enrollment,
        exam: base.exam ?? existingMarks[0]?.exam,
        subject: sub,
      });
    }
  }

  // Keep orphan rows (e.g. subject removed from roster) so data is not lost.
  for (const leftover of bySubjectId.values()) {
    filled.push(leftover);
  }

  filled.sort((a, b) => {
    if (a.subject.assessment_type === 'exam' && b.subject.assessment_type !== 'exam') return -1;
    if (a.subject.assessment_type !== 'exam' && b.subject.assessment_type === 'exam') return 1;
    return (a.subject.priority || 0) - (b.subject.priority || 0);
  });

  return filled;
}

export function aggregatePaperMarks(marksList: any[]) {
  const aggregatedData: Record<number, any> = {};
  const finalData: any[] = [];

  marksList.forEach((mark) => {
    const sub = mark.subject;
    if (sub.subject_type === 'paper' && sub.parent_id) {
      const pid = sub.parent_id;
      if (!aggregatedData[pid]) {
        aggregatedData[pid] = {
          subject: sub.parent?.name || 'Main Subject',
          marks: null as number | null,
          cq_marks: null as number | null,
          mcq_marks: null as number | null,
          practical_marks: null as number | null,
          full_mark: 0,
          cq_mark: 0,
          mcq_mark: 0,
          practical_mark: 0,
          cq_pass_mark: 0,
          mcq_pass_mark: 0,
          practical_pass_mark: 0,
          pass_mark: 0,
          priority: sub.priority,
          assessment_type: sub.assessment_type,
          marking_scheme: 'TOTAL',
          papers: [],
          isGroup: true,
          subject_id: pid,
        };
      }
      const g = aggregatedData[pid];
      if (mark.marks != null) g.marks = (g.marks ?? 0) + mark.marks;
      if (mark.cq_marks != null) g.cq_marks = (g.cq_marks ?? 0) + mark.cq_marks;
      if (mark.mcq_marks != null) g.mcq_marks = (g.mcq_marks ?? 0) + mark.mcq_marks;
      if (mark.practical_marks != null) {
        g.practical_marks = (g.practical_marks ?? 0) + mark.practical_marks;
      }
      g.full_mark += sub.full_mark || 0;
      g.cq_mark += sub.cq_mark || 0;
      g.mcq_mark += sub.mcq_mark || 0;
      g.practical_mark += sub.practical_mark || 0;
      g.cq_pass_mark += sub.cq_pass_mark || 0;
      g.mcq_pass_mark += sub.mcq_pass_mark || 0;
      g.practical_pass_mark += sub.practical_pass_mark || 0;
      g.pass_mark += sub.pass_mark || 0;
      g.priority = Math.min(g.priority, sub.priority);
      if ((sub as any).marking_scheme === 'BREAKDOWN') {
        g.marking_scheme = 'BREAKDOWN';
      }

      // Push simplified mark data for the paper
      g.papers.push({
        subject: sub.name,
        marks: mark.marks,
        cq_marks: mark.cq_marks,
        mcq_marks: mark.mcq_marks,
        practical_marks: mark.practical_marks,
        full_mark: sub.full_mark,
        highest_mark: mark.highest_mark || 0,
        subject_id: mark.subject_id,
        priority: sub.priority,
      });
    } else {
      finalData.push({
        subject: sub.name,
        marks: mark.marks,
        cq_marks: mark.cq_marks,
        mcq_marks: mark.mcq_marks,
        practical_marks: mark.practical_marks,
        full_mark: sub.full_mark,
        cq_mark: sub.cq_mark,
        mcq_mark: sub.mcq_mark,
        practical_mark: sub.practical_mark,
        cq_pass_mark: sub.cq_pass_mark,
        mcq_pass_mark: sub.mcq_pass_mark,
        practical_pass_mark: sub.practical_pass_mark,
        pass_mark: sub.pass_mark,
        priority: sub.priority,
        assessment_type: sub.assessment_type,
        marking_scheme: (sub as any).marking_scheme,
        isGroup: false,
        highest_mark: mark.highest_mark || 0,
        subject_id: mark.subject_id,
      });
    }
  });

  Object.values(aggregatedData).forEach((g) => {
    // Sort papers within the group by priority
    g.papers.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
    finalData.push(g);
  });

  return finalData.sort((a, b) => {
    if (a.assessment_type === 'exam' && b.assessment_type !== 'exam') return -1;
    if (a.assessment_type !== 'exam' && b.assessment_type === 'exam') return 1;
    return (a.priority || 0) - (b.priority || 0);
  });
}

export function calculateGPA(
  marksData: any[],
  fourthSubjectId: number | null,
  applyBonus: boolean,
  className?: number,
  maxAllowedFails = 0,
) {
  let totalMarks = 0;
  let totalGP = 0;
  let failedSubjectCount = 0;
  let subjectCount = 0;
  const hasFourthSubject = fourthSubjectId !== null;

  marksData.forEach((row) => {
    if (row.assessment_type === 'exam') {
      const obtained = Number(row.marks);
      const fullMark = Number(row.full_mark || 100);

      if (!Number.isFinite(obtained) || !Number.isFinite(fullMark) || fullMark <= 0) {
        return;
      }

      totalMarks += obtained;
      const percentage = (obtained / fullMark) * 100;

      const isOptional = row.subject_id === fourthSubjectId;

      const grade = getGradeByPercentage(percentage, {
        total: row.marks,
        total_pass: row.pass_mark,
        cq: row.cq_marks,
        cq_pass: row.cq_pass_mark,
        mcq: row.mcq_marks,
        mcq_pass: row.mcq_pass_mark,
        pr: row.practical_marks,
        pr_pass: row.practical_pass_mark,
        className: className,
        isOptional: isOptional,
        marking_scheme: row.marking_scheme,
      });

      if (isOptional && applyBonus) {
        // 4th subject logic: Add points above 2.0
        if (grade.gp > 2.0) {
          totalGP += grade.gp - 2.0;
        }
        // 4th subject doesn't increase subjectCount and doesn't cause failure
      } else {
        totalGP += grade.gp;
        if (grade.lg === 'F') failedSubjectCount += 1;
        subjectCount++;
      }
    }
  });

  const allowedFails = Math.max(0, maxAllowedFails);
  const isFailed = failedSubjectCount > allowedFails;

  let gpaResult = 0.0;
  if (!isFailed) {
    if (!hasFourthSubject) {
      if (className === 6 || className === 7 || className === 8) {
        gpaResult = subjectCount > 0 ? totalGP / subjectCount : 0.0;
      } else {
        // When no 4th subject is provided, apply requested normalization:
        // GPA = (sum of exam-subject GPs - 2) / (exam-subject count - 1)
        gpaResult = subjectCount > 1 ? (totalGP - 2.0) / (subjectCount - 1) : 0.0;
      }
    } else {
      gpaResult = subjectCount > 0 ? totalGP / subjectCount : 0.0;
    }
  }

  return {
    gpa: Math.min(gpaResult, 5.0),
    totalMarks,
    failedSubjectCount,
    isFailed: isFailed && subjectCount > 0,
  };
}

export function getGradeByPercentage(
  percentage: number,
  breakdown?: {
    total?: number;
    total_pass?: number;
    cq?: number;
    cq_pass?: number;
    mcq?: number;
    mcq_pass?: number;
    pr?: number;
    pr_pass?: number;
    className?: number;
    isOptional?: boolean;
    marking_scheme?: string;
  },
) {
  if (
    breakdown &&
    (breakdown.className === 9 || breakdown.className === 10) &&
    !breakdown.isOptional
  ) {
    // Component-wise pass checks only apply to BREAKDOWN subjects;
    // TOTAL subjects store null CQ/MCQ/PRAC marks which would wrongly read as 0.
    if (
      breakdown.marking_scheme === 'BREAKDOWN' &&
      ((breakdown.cq_pass && (breakdown.cq || 0) < (breakdown.cq_pass || 0)) ||
        (breakdown.mcq_pass && (breakdown.mcq || 0) < (breakdown.mcq_pass || 0)) ||
        (breakdown.pr_pass && (breakdown.pr || 0) < (breakdown.pr_pass || 0)))
    ) {
      return { lg: 'F', gp: 0.0 };
    }
  }

  // Pass mark is an absolute mark, so compare it against obtained marks,
  // not the percentage (they only coincide when full mark is 100).
  if (
    breakdown?.total !== undefined &&
    breakdown?.total !== null &&
    breakdown?.total_pass !== undefined &&
    breakdown?.total_pass !== null &&
    Number(breakdown.total) < Number(breakdown.total_pass)
  ) {
    return { lg: 'F', gp: 0.0 };
  }

  if (percentage < 33) {
    return { lg: 'F', gp: 0.0 };
  }

  if (percentage >= 80) return { lg: 'A+', gp: 5.0 };
  if (percentage >= 70) return { lg: 'A', gp: 4.0 };
  if (percentage >= 60) return { lg: 'A-', gp: 3.5 };
  if (percentage >= 50) return { lg: 'B', gp: 3.0 };
  if (percentage >= 40) return { lg: 'C', gp: 2.0 };
  if (percentage >= 33) return { lg: 'D', gp: 1.0 };
  return { lg: 'F', gp: 0.0 };
}
