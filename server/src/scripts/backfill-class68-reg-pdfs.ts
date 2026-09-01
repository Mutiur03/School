/**
 * Backfill Class 6 / Class 8 registration PDF freeze + R2 cache.
 *
 * For each approved registration:
 * 1. Freeze pdf_settings_snapshot from current school settings (if missing)
 * 2. Generate PDF and store pdf_path / pdf_generated_at (if missing, or --force)
 *
 * Usage (from server/):
 *   pnpm exec tsx src/scripts/backfill-class68-reg-pdfs.ts
 *   pnpm exec tsx src/scripts/backfill-class68-reg-pdfs.ts --dry-run
 *   pnpm exec tsx src/scripts/backfill-class68-reg-pdfs.ts --class=6 --school-id=1
 *   pnpm exec tsx src/scripts/backfill-class68-reg-pdfs.ts --class=8 --limit=20 --force
 */
import 'dotenv/config';
import { Prisma } from '@/generated/prisma/client.js';
import { prisma } from '@/config/prisma.js';
import { runWithRlsContext } from '@/config/rlsContextStore.js';
import { RegistrationFormClass6Service } from '@/modules/registration/class-6/Form/registrationFormClass6.service.js';
import { RegistrationFormClass8Service } from '@/modules/registration/class-8/Form/registrationFormClass8.service.js';

type ClassKind = '6' | '8';

function parseArgs(argv: string[]) {
  const flags = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    classFilter: 'all' as 'all' | ClassKind,
    schoolId: null as number | null,
    limit: null as number | null,
  };

  for (const arg of argv) {
    if (arg.startsWith('--class=')) {
      const value = arg.slice('--class='.length);
      if (value === '6' || value === '8' || value === 'all') {
        flags.classFilter = value;
      } else {
        throw new Error(`Invalid --class=${value}; use 6, 8, or all`);
      }
    }
    if (arg.startsWith('--school-id=')) {
      const parsed = Number(arg.slice('--school-id='.length));
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --school-id`);
      }
      flags.schoolId = parsed;
    }
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit`);
      }
      flags.limit = parsed;
    }
  }

  return flags;
}

type Candidate = {
  id: string;
  year: number;
  name: string;
  hasSnapshot: boolean;
  hasPdf: boolean;
};

async function listClass6Candidates(force: boolean): Promise<Candidate[]> {
  const rows = await prisma.student_registration_class6.findMany({
    where: {
      status: 'approved',
      ...(force
        ? {}
        : {
            OR: [{ pdf_settings_snapshot: { equals: Prisma.DbNull } }, { pdf_path: null }],
          }),
    },
    select: {
      id: true,
      class6_year: true,
      student_name_en: true,
      pdf_settings_snapshot: true,
      pdf_path: true,
    },
    orderBy: [{ class6_year: 'desc' }, { section: 'asc' }, { roll: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    year: row.class6_year,
    name: row.student_name_en,
    hasSnapshot: row.pdf_settings_snapshot != null,
    hasPdf: Boolean(row.pdf_path),
  }));
}

async function listClass8Candidates(force: boolean): Promise<Candidate[]> {
  const rows = await prisma.student_registration_class8.findMany({
    where: {
      status: 'approved',
      ...(force
        ? {}
        : {
            OR: [{ pdf_settings_snapshot: { equals: Prisma.DbNull } }, { pdf_path: null }],
          }),
    },
    select: {
      id: true,
      class8_year: true,
      student_name_en: true,
      pdf_settings_snapshot: true,
      pdf_path: true,
    },
    orderBy: [{ class8_year: 'desc' }, { section: 'asc' }, { roll: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    year: row.class8_year,
    name: row.student_name_en,
    hasSnapshot: row.pdf_settings_snapshot != null,
    hasPdf: Boolean(row.pdf_path),
  }));
}

async function backfillClass6(candidate: Candidate, force: boolean) {
  if (!candidate.hasSnapshot) {
    await RegistrationFormClass6Service.updateRegistrationStatus(candidate.id, 'approved');
  } else if (force && candidate.hasPdf) {
    await prisma.student_registration_class6.update({
      where: { id: candidate.id },
      data: { pdf_path: null, pdf_generated_at: null },
    });
  }

  const result = await RegistrationFormClass6Service.downloadRegistrationPDF(candidate.id);
  if (!('pdfBuffer' in result) || !result.pdfBuffer?.length) {
    throw new Error('PDF generation returned no buffer');
  }
}

async function backfillClass8(candidate: Candidate, force: boolean) {
  if (!candidate.hasSnapshot) {
    await RegistrationFormClass8Service.updateRegistrationStatus(candidate.id, 'approved');
  } else if (force && candidate.hasPdf) {
    await prisma.student_registration_class8.update({
      where: { id: candidate.id },
      data: { pdf_path: null, pdf_generated_at: null },
    });
  }

  const result = await RegistrationFormClass8Service.downloadRegistrationPDF(candidate.id);
  if (!('pdfBuffer' in result) || !result.pdfBuffer?.length) {
    throw new Error('PDF generation returned no buffer');
  }
}

async function processSchool(
  schoolId: number,
  schoolLabel: string,
  classKinds: ClassKind[],
  opts: { dryRun: boolean; force: boolean; limit: number | null },
) {
  const summary = { ok: 0, failed: 0 };

  await runWithRlsContext({ schoolId, isSuperAdmin: false }, async () => {
    for (const kind of classKinds) {
      const candidates =
        kind === '6'
          ? await listClass6Candidates(opts.force)
          : await listClass8Candidates(opts.force);

      const remaining =
        opts.limit != null ? Math.max(opts.limit - (summary.ok + summary.failed), 0) : null;
      const limited = remaining != null ? candidates.slice(0, remaining) : candidates;

      console.log(
        `\n[school ${schoolId} ${schoolLabel}] class ${kind}: ${candidates.length} candidate(s)` +
          (remaining != null ? ` (processing ${limited.length})` : ''),
      );

      for (const candidate of limited) {
        const label = `class${kind} ${candidate.id} (${candidate.name}, year ${candidate.year})`;
        if (opts.dryRun) {
          console.log(
            `  DRY  ${label} snapshot=${candidate.hasSnapshot ? 'yes' : 'no'} pdf=${candidate.hasPdf ? 'yes' : 'no'}`,
          );
          summary.ok += 1;
          continue;
        }

        try {
          if (kind === '6') {
            await backfillClass6(candidate, opts.force);
          } else {
            await backfillClass8(candidate, opts.force);
          }
          console.log(`  OK   ${label}`);
          summary.ok += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  FAIL ${label}: ${message}`);
          summary.failed += 1;
        }
      }
    }
  });

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const classKinds: ClassKind[] = args.classFilter === 'all' ? ['6', '8'] : [args.classFilter];

  const schools = await runWithRlsContext({ isSuperAdmin: true }, async () =>
    prisma.school.findMany({
      where: args.schoolId ? { id: args.schoolId } : undefined,
      select: { id: true, name: true, subdomain: true },
      orderBy: { id: 'asc' },
    }),
  );

  if (schools.length === 0) {
    console.error('No schools found for the given filters.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Backfill Class 6/8 registration PDFs` +
      `\n  dryRun=${args.dryRun} force=${args.force} class=${args.classFilter}` +
      `\n  schools=${schools.length}`,
  );

  let totalOk = 0;
  let totalFailed = 0;
  let remaining = args.limit;

  for (const school of schools) {
    if (remaining != null && remaining <= 0) break;

    const label = school.name || school.subdomain || '';
    const result = await processSchool(school.id, label, classKinds, {
      dryRun: args.dryRun,
      force: args.force,
      limit: remaining,
    });
    totalOk += result.ok;
    totalFailed += result.failed;
    if (remaining != null) {
      remaining -= result.ok + result.failed;
    }
  }

  console.log(`\nDone. ok=${totalOk} failed=${totalFailed}`);
  if (totalFailed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
