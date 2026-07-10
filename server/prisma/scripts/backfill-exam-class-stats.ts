/**
 * One-off: populate the exam_class_stats cache for marks that predate the
 * cache feature. Idempotent — safe to re-run; each row is upserted.
 *
 * For every (school, exam, class, year) that has marks, it computes:
 *   - highest_by_subject      : max mark per subject (all assessment types)
 *   - class_highest_total      : max per-student total (exam-type subjects only)
 *   - class_highest_grand_total: max per-student total (ALL subjects)
 * matching MarksService.computeStats exactly.
 *
 * Usage (from server/):
 *   npx tsx prisma/scripts/backfill-exam-class-stats.ts
 *   npx tsx prisma/scripts/backfill-exam-class-stats.ts --dry   (or DRY_RUN=1)
 *
 * Uses a raw PrismaClient (no RLS extension), so every query is scoped by an
 * explicit school_id. The BEFORE INSERT trigger still requires a non-null
 * school_id, which we provide.
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

const prisma = new PrismaClient();
const dryRun =
  process.env.DRY_RUN === "1" ||
  process.env.DRY_RUN === "true" ||
  process.argv.includes("--dry");

type Combo = {
  schoolId: number;
  examId: number;
  klass: number;
  year: number;
};

async function main() {
  // Map every enrollment to its (class, year, school).
  const enrollments = await prisma.student_enrollments.findMany({
    select: { id: true, class: true, year: true, school_id: true },
  });
  const enrById = new Map(enrollments.map((e) => [e.id, e]));

  // Distinct (exam, enrollment) pairs that have marks, collapsed to
  // (school, exam, class, year).
  const pairs = await prisma.marks.groupBy({
    by: ["exam_id", "enrollment_id"],
  });

  const combos = new Map<string, Combo>();
  let skippedNoSchool = 0;
  for (const p of pairs) {
    const en = enrById.get(p.enrollment_id);
    if (!en) continue;
    if (en.school_id == null) {
      skippedNoSchool++;
      continue;
    }
    const key = `${en.school_id}_${p.exam_id}_${en.class}_${en.year}`;
    if (!combos.has(key)) {
      combos.set(key, {
        schoolId: en.school_id,
        examId: p.exam_id,
        klass: en.class,
        year: en.year,
      });
    }
  }

  console.log(
    `${combos.size} (school,exam,class,year) combo(s) to backfill` +
      (skippedNoSchool ? `, ${skippedNoSchool} pair(s) skipped (null school_id)` : "") +
      (dryRun ? " (DRY_RUN)" : ""),
  );
  if (dryRun) return;

  let done = 0;
  for (const c of combos.values()) {
    const [bySubject, byEnrollmentExam, byEnrollmentAll] = await Promise.all([
      prisma.marks.groupBy({
        by: ["subject_id"],
        where: {
          exam_id: c.examId,
          school_id: c.schoolId,
          enrollment: { class: c.klass, year: c.year },
        },
        _max: { marks: true },
      }),
      prisma.marks.groupBy({
        by: ["enrollment_id"],
        where: {
          exam_id: c.examId,
          school_id: c.schoolId,
          enrollment: { class: c.klass, year: c.year },
          subject: { assessment_type: "exam" },
        },
        _sum: { marks: true },
      }),
      prisma.marks.groupBy({
        by: ["enrollment_id"],
        where: {
          exam_id: c.examId,
          school_id: c.schoolId,
          enrollment: { class: c.klass, year: c.year },
        },
        _sum: { marks: true },
      }),
    ]);

    const highestBySubject: Record<string, number> = {};
    for (const g of bySubject) {
      highestBySubject[g.subject_id] = Number(g._max.marks ?? 0);
    }
    const examTotals = byEnrollmentExam.map((g) => Number(g._sum.marks ?? 0));
    const classHighestTotal = examTotals.length > 0 ? Math.max(...examTotals) : 0;
    const grandTotals = byEnrollmentAll.map((g) => Number(g._sum.marks ?? 0));
    const classHighestGrandTotal =
      grandTotals.length > 0 ? Math.max(...grandTotals) : 0;

    await prisma.exam_class_stats.upsert({
      where: {
        unique_exam_class_stats: {
          exam_id: c.examId,
          class: c.klass,
          year: c.year,
          school_id: c.schoolId,
        },
      },
      create: {
        exam_id: c.examId,
        class: c.klass,
        year: c.year,
        school_id: c.schoolId,
        highest_by_subject: highestBySubject,
        class_highest_total: classHighestTotal,
        class_highest_grand_total: classHighestGrandTotal,
      },
      update: {
        highest_by_subject: highestBySubject,
        class_highest_total: classHighestTotal,
        class_highest_grand_total: classHighestGrandTotal,
      },
    });
    done++;
  }

  console.log(`Backfilled ${done} exam_class_stats row(s). Done.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
