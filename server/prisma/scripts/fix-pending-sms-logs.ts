/**
 * One-off: mark all stuck "pending" sms_logs as "sent" and flip attendence.send_msg = true
 * for the corresponding student+date pairs.
 *
 * Run ONLY when you are sure the pending SMS messages were actually delivered by the provider
 * but the status was never updated due to phone-number key mismatch in processBatchResults.
 *
 * Usage (from server/):
 *   npx tsx prisma/scripts/fix-pending-sms-logs.ts
 *   DRY_RUN=1 npx tsx prisma/scripts/fix-pending-sms-logs.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Use migration/superuser URL when available — school_app RLS hides rows without tenant context
const databaseUrl =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});
const DRY_RUN = process.env.DRY_RUN === "1";

async function setSuperAdminContext() {
  await prisma.$executeRaw`SELECT set_config('app.is_super_admin', '1', false)`;
}

async function main() {
  console.log(DRY_RUN ? "[DRY RUN] No changes will be written." : "[LIVE] Writing changes...");
  await setSuperAdminContext();

  // Fetch all pending logs
  const pendingLogs = await prisma.sms_logs.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      student_id: true,
      attendance_date: true,
      phone_number: true,
    },
  });

  if (pendingLogs.length === 0) {
    console.log("No pending SMS logs found. Nothing to do.");
    return;
  }

  console.log(`Found ${pendingLogs.length} pending SMS log(s).`);

  // Build unique student_id+date pairs for attendence update
  const attendancePairs = new Map<string, { studentId: number; date: string }>();
  for (const log of pendingLogs) {
    const key = `${log.student_id}::${log.attendance_date}`;
    if (!attendancePairs.has(key)) {
      attendancePairs.set(key, { studentId: log.student_id, date: log.attendance_date });
    }
  }

  if (!DRY_RUN) {
    // 1. Mark all pending sms_logs as sent
    const updated = await prisma.sms_logs.updateMany({
      where: { status: "pending" },
      data: {
        status: "sent",
        updated_at: new Date(),
      },
    });
    console.log(`Updated ${updated.count} sms_logs → status: "sent"`);

    // 2. Flip send_msg = true on attendance records
    let attendanceUpdated = 0;
    for (const { studentId, date } of attendancePairs.values()) {
      const res = await prisma.attendence.updateMany({
        where: { student_id: studentId, date },
        data: { send_msg: true },
      });
      attendanceUpdated += res.count;
    }
    console.log(`Updated ${attendanceUpdated} attendence row(s) → send_msg: true`);
  } else {
    console.log(`[DRY RUN] Would update ${pendingLogs.length} sms_logs → "sent"`);
    console.log(`[DRY RUN] Would update ${attendancePairs.size} attendence row(s) → send_msg: true`);

    // Print a sample
    const sample = pendingLogs.slice(0, 5);
    console.log("\nSample pending logs:");
    for (const log of sample) {
      console.log(`  id=${log.id}  student=${log.student_id}  date=${log.attendance_date}  phone=${log.phone_number}`);
    }
    if (pendingLogs.length > 5) {
      console.log(`  ... and ${pendingLogs.length - 5} more`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
