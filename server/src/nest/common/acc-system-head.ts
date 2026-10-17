import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client.js';

/** A school's system-managed equity head (Opening Balance Equity, Retained Earnings), created on first use. */
export async function equityHeadId(tx: Prisma.TransactionClient, schoolId: number, name: string) {
  const found = await tx.acc_heads.findFirst({
    where: { school_id: schoolId, name },
    select: { id: true, type: true },
  });
  if (found) {
    if (found.type !== 'equity') {
      throw new BadRequestException(`"${name}" already exists and is not an equity head`);
    }
    return found.id;
  }
  const created = await tx.acc_heads.create({
    data: { school_id: schoolId, name, type: 'equity' },
    select: { id: true },
  });
  return created.id;
}
