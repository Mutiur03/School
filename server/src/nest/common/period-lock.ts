import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client.js';

/** Vouchers and fee receipts dated in a closed financial year are frozen. Pass every date being written. */
export async function assertYearOpen(
  db: Pick<Prisma.TransactionClient, 'acc_years'>,
  schoolId: number,
  ...dates: (string | Date | null | undefined)[]
) {
  const years = [...new Set(dates.flatMap((d) => (d ? [new Date(d).getUTCFullYear()] : [])))];
  if (years.length === 0) return;
  const closed = await db.acc_years.findFirst({
    where: { school_id: schoolId, year: { in: years } },
    select: { year: true },
  });
  if (closed) {
    throw new BadRequestException(
      `Year ${closed.year} is closed. Reopen it in Accounts > Fiscal Years to change it.`,
    );
  }
}
