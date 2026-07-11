/**
 * One-off / on-demand: warm the marksheet cache for exams that are already
 * published (visible = true) but whose PDFs were never pre-generated.
 *
 * It does NOT render here. It creates `pending` marksheet_files rows and pushes
 * jobs onto the same Bull queue the server consumes, so the running server's
 * worker renders them with the correct per-school RLS context. The server must
 * be up (Redis + worker) for the jobs to drain.
 *
 * Usage (from server/):
 *   npx tsx prisma/scripts/pregenerate-marksheets.ts
 *   npx tsx prisma/scripts/pregenerate-marksheets.ts --dry   (or DRY_RUN=1)
 *
 * Raw PrismaClient (no RLS extension): every query is explicitly school-scoped.
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import Bull from "bull";

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

const host = process.env.REDIS_HOST || "127.0.0.1";
const queue = new Bull("marksheetQueue", { redis: { host, port: 6379 } });

async function main() {
  const exams = await prisma.exams.findMany({
    where: { visible: true, school_id: { not: null } },
    select: { id: true, exam_name: true, exam_year: true, school_id: true },
  });

  console.log(
    `${exams.length} published exam(s) with school_id${dryRun ? " (DRY_RUN)" : ""}`,
  );

  let totalJobs = 0;
  for (const exam of exams) {
    const schoolId = exam.school_id as number;

    const marks = await prisma.marks.findMany({
      where: { exam_id: exam.id, school_id: schoolId, marks: { not: null } },
      distinct: ["enrollment_id"],
      select: {
        enrollment: { select: { student_id: true, year: true, class: true } },
      },
    });

    const targets = new Map<number, number>(); // studentId -> year
    const classes = new Map<number, number>(); // class -> year
    for (const m of marks) {
      const sid = m.enrollment?.student_id;
      const yr = m.enrollment?.year;
      const cls = m.enrollment?.class;
      if (sid != null && yr != null) targets.set(sid, yr);
      if (cls != null && yr != null) classes.set(cls, yr);
    }

    console.log(
      `  exam ${exam.id} "${exam.exam_name}" (${exam.exam_year}): ${targets.size} student(s), ${classes.size} class bundle(s)`,
    );
    if (dryRun) {
      totalJobs += targets.size + classes.size;
      continue;
    }

    for (const [cls, yr] of classes) {
      await prisma.marksheet_bundles.upsert({
        where: {
          exam_id_class_section: { exam_id: exam.id, class: cls, section: "ALL" },
        },
        create: {
          exam_id: exam.id,
          exam_name: exam.exam_name,
          year: yr,
          class: cls,
          section: "ALL",
          school_id: schoolId,
          status: "pending",
        },
        update: { status: "pending", error: null, exam_name: exam.exam_name },
      });
      await queue.add(
        {
          kind: "bundle",
          examId: exam.id,
          examName: exam.exam_name,
          year: yr,
          class: cls,
          schoolId,
        },
        {
          jobId: `msb:${exam.id}:${cls}`,
          priority: 2,
          attempts: 3,
          backoff: { type: "fixed", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 200,
        },
      );
      totalJobs++;
    }

    for (const [studentId, yr] of targets) {
      await prisma.marksheet_files.upsert({
        where: { student_id_exam_id: { student_id: studentId, exam_id: exam.id } },
        create: {
          student_id: studentId,
          exam_id: exam.id,
          exam_name: exam.exam_name,
          year: yr,
          school_id: schoolId,
          status: "pending",
        },
        update: { status: "pending", error: null, exam_name: exam.exam_name },
      });
      await queue.add(
        {
          studentId,
          examId: exam.id,
          examName: exam.exam_name,
          year: yr,
          schoolId,
        },
        {
          jobId: `ms:${exam.id}:${studentId}`,
          priority: 2,
          attempts: 3,
          backoff: { type: "fixed", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 200,
        },
      );
      totalJobs++;
    }
  }

  console.log(
    dryRun
      ? `Would queue ${totalJobs} job(s).`
      : `Queued ${totalJobs} job(s). Server worker will render them.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await queue.close();
    await prisma.$disconnect();
  });
