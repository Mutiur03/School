/**
 * One-off: point every row that references a school to a single target school (default: id 1).
 *
 * Usage (from server/):
 *   TARGET_SCHOOL_ID=1 npx tsx prisma/scripts/reassign-all-school-ids.ts
 *   DRY_RUN=1 npx tsx prisma/scripts/reassign-all-school-ids.ts
 *
 * Backup the database first. This deletes extra `school_site_configs` rows when more than
 * one school has a config (keeps the target school's row, or one arbitrary row if none).
 * Merging can still fail on unique constraints (e.g. subjects, class_routine) if the same
 * logical key exists for multiple schools — the preflight check aborts when that happens.
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

const prisma = new PrismaClient();

function parseTargetId(): number {
  const fromEnv = process.env.TARGET_SCHOOL_ID;
  const raw = fromEnv ?? process.argv[2] ?? "1";
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid TARGET_SCHOOL_ID / argv: ${raw}`);
  }
  return n;
}

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function preflightMergeConflicts(targetId: number): Promise<void> {
  type Row = {
    name: string;
    class: number;
    group: string | null;
    year: number;
  };

  const subjectRows = await prisma.subjects.findMany({
    where: { school_id: { not: null } },
    select: {
      name: true,
      class: true,
      group: true,
      year: true,
      school_id: true,
    },
  });

  const subjectSchoolsByKey = new Map<string, Set<number>>();
  for (const row of subjectRows) {
    if (row.school_id == null) continue;
    const key = `${row.name}::${row.class}::${row.group ?? ""}::${row.year}`;
    const schools = subjectSchoolsByKey.get(key) ?? new Set<number>();
    schools.add(row.school_id);
    subjectSchoolsByKey.set(key, schools);
  }

  const subjectDups: Row[] = [];
  for (const [key, schools] of subjectSchoolsByKey.entries()) {
    if (schools.size <= 1) continue;
    const [name, cls, grp, yr] = key.split("::");
    subjectDups.push({
      name,
      class: Number(cls),
      group: grp === "" ? null : grp,
      year: Number(yr),
    });
  }

  if (subjectDups.length > 0) {
    console.error(
      "Preflight failed: duplicate subject keys across different schools (would violate unique after merge).",
      "First few:",
      subjectDups.slice(0, 5),
    );
    process.exit(1);
  }

  type CrRow = { class: number; slot_id: number; day: string };

  const routineRows = await prisma.class_routine.findMany({
    where: { school_id: { not: null } },
    select: {
      class: true,
      slot_id: true,
      day: true,
      school_id: true,
    },
  });

  const routineSchoolsByKey = new Map<string, Set<number>>();
  for (const row of routineRows) {
    if (row.school_id == null) continue;
    const key = `${row.class}::${row.slot_id}::${row.day}`;
    const schools = routineSchoolsByKey.get(key) ?? new Set<number>();
    schools.add(row.school_id);
    routineSchoolsByKey.set(key, schools);
  }

  const routineDups: CrRow[] = [];
  for (const [key, schools] of routineSchoolsByKey.entries()) {
    if (schools.size <= 1) continue;
    const [cls, slot, day] = key.split("::");
    routineDups.push({
      class: Number(cls),
      slot_id: Number(slot),
      day,
    });
  }

  if (routineDups.length > 0) {
    console.error(
      "Preflight failed: duplicate class_routine keys across different schools.",
      "First few:",
      routineDups.slice(0, 5),
    );
    process.exit(1);
  }

  const school = await prisma.school.findUnique({ where: { id: targetId } });
  if (!school) {
    console.error(`Target school id ${targetId} does not exist.`);
    process.exit(1);
  }
}

async function reconcileSchoolSiteConfigs(targetId: number): Promise<void> {
  const forTarget = await prisma.schoolSiteConfig.findUnique({
    where: { schoolId: targetId },
  });
  const others = await prisma.schoolSiteConfig.findMany({
    where: { schoolId: { not: targetId } },
  });

  if (others.length === 0) return;

  if (dryRun) {
    console.log(
      `[DRY_RUN] Would reconcile school_site_configs: ${others.length} non-target row(s); target has config: ${!!forTarget}`,
    );
    return;
  }

  if (forTarget) {
    await prisma.schoolSiteConfig.deleteMany({
      where: { schoolId: { not: targetId } },
    });
    return;
  }

  const [keep, ...rest] = others;
  await prisma.schoolSiteConfig.update({
    where: { id: keep.id },
    data: { schoolId: targetId },
  });
  if (rest.length > 0) {
    await prisma.schoolSiteConfig.deleteMany({
      where: { id: { in: rest.map((r) => r.id) } },
    });
  }
}

function schoolIdWhere(targetId: number) {
  return {
    OR: [{ school_id: null }, { school_id: { not: targetId } }],
  };
}

async function main() {
  const targetId = parseTargetId();
  console.log(`Target school id: ${targetId}${dryRun ? " (DRY_RUN)" : ""}`);

  await preflightMergeConflicts(targetId);
  await reconcileSchoolSiteConfigs(targetId);

  if (dryRun) {
    const w = schoolIdWhere(targetId);
    const c = async (label: string, n: number) =>
      console.log(`[DRY_RUN] ${label}: rows to update: ${n}`);

    await c("admin", await prisma.admin.count({ where: w }));
    await c("students", await prisma.students.count({ where: w }));
    await c(
      "student_enrollments",
      await prisma.student_enrollments.count({ where: w }),
    );
    await c("attendence", await prisma.attendence.count({ where: w }));
    await c("exams", await prisma.exams.count({ where: w }));
    await c("holidays", await prisma.holidays.count({ where: w }));
    await c("teachers", await prisma.teachers.count({ where: w }));
    await c("staffs", await prisma.staffs.count({ where: w }));
    await c("levels", await prisma.levels.count({ where: w }));
    await c("subjects", await prisma.subjects.count({ where: w }));
    await c("marks", await prisma.marks.count({ where: w }));
    await c("categories", await prisma.categories.count({ where: w }));
    await c("events", await prisma.events.count({ where: w }));
    await c("gallery", await prisma.gallery.count({ where: w }));
    await c("notices", await prisma.notices.count({ where: w }));
    await c("admission", await prisma.admission.count({ where: w }));
    await c("syllabus", await prisma.syllabus.count({ where: w }));
    await c(
      "class_slot_time",
      await prisma.class_slot_time.count({ where: w }),
    );
    await c("class_routine", await prisma.class_routine.count({ where: w }));
    await c("exam_routines", await prisma.exam_routines.count({ where: w }));
    await c(
      "class_routine_pdf",
      await prisma.class_routine_pdf.count({ where: w }),
    );
    await c("citizenCharter", await prisma.citizenCharter.count({ where: w }));
    await c("head_msg", await prisma.head_msg.count({ where: w }));
    await c("ssc_reg", await prisma.ssc_reg.count({ where: w }));
    await c(
      "student_registration_ssc",
      await prisma.student_registration_ssc.count({ where: w }),
    );
    await c("admission_form", await prisma.admission_form.count({ where: w }));
    await c(
      "admission_result",
      await prisma.admission_result.count({ where: w }),
    );
    await c("sms_logs", await prisma.sms_logs.count({ where: w }));
    await c("class6_reg", await prisma.class6_reg.count({ where: w }));
    await c(
      "student_registration_class6",
      await prisma.student_registration_class6.count({ where: w }),
    );
    await c("class8_reg", await prisma.class8_reg.count({ where: w }));
    await c(
      "student_registration_class8",
      await prisma.student_registration_class8.count({ where: w }),
    );
    // schoolDomain model no longer exists; subdomain/domain now live on School.
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {};

    const bump = (name: string, n: number) => {
      counts[name] = n;
    };

    bump(
      "admin",
      (
        await tx.admin.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "students",
      (
        await tx.students.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "student_enrollments",
      (
        await tx.student_enrollments.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "attendence",
      (
        await tx.attendence.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "exams",
      (
        await tx.exams.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "holidays",
      (
        await tx.holidays.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "teachers",
      (
        await tx.teachers.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "staffs",
      (
        await tx.staffs.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "levels",
      (
        await tx.levels.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "subjects",
      (
        await tx.subjects.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "marks",
      (
        await tx.marks.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "categories",
      (
        await tx.categories.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "events",
      (
        await tx.events.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "gallery",
      (
        await tx.gallery.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "notices",
      (
        await tx.notices.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "admission",
      (
        await tx.admission.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "syllabus",
      (
        await tx.syllabus.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "class_slot_time",
      (
        await tx.class_slot_time.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "class_routine",
      (
        await tx.class_routine.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "exam_routines",
      (
        await tx.exam_routines.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "class_routine_pdf",
      (
        await tx.class_routine_pdf.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "citizenCharter",
      (
        await tx.citizenCharter.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "head_msg",
      (
        await tx.head_msg.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "ssc_reg",
      (
        await tx.ssc_reg.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "student_registration_ssc",
      (
        await tx.student_registration_ssc.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "admission_form",
      (
        await tx.admission_form.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "admission_result",
      (
        await tx.admission_result.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "sms_logs",
      (
        await tx.sms_logs.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "class6_reg",
      (
        await tx.class6_reg.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "student_registration_class6",
      (
        await tx.student_registration_class6.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "class8_reg",
      (
        await tx.class8_reg.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );
    bump(
      "student_registration_class8",
      (
        await tx.student_registration_class8.updateMany({
          where: schoolIdWhere(targetId),
          data: { school_id: targetId },
        })
      ).count,
    );

    return counts;
  });

  console.log("Updated row counts (0 = already aligned):");
  for (const [k, v] of Object.entries(result).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
