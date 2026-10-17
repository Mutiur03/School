import { BadRequestException, Injectable } from '@nestjs/common';
import { OPENING_EQUITY_NAME } from '@school/shared-schemas';
import type { AccHeadType, Prisma } from '@/generated/prisma/client.js';
import { equityHeadId } from '../../common/acc-system-head.js';
import { assertYearOpen } from '../../common/period-lock.js';

type Head = { id: number; type: AccHeadType };
type Line = { head_id: number; debit: number; credit: number };

const DEBIT_TYPES: AccHeadType[] = ['asset', 'expense'];
const cents = (x: unknown) => Math.round(Number(x) * 100);

/**
 * Opening balances are lines of ONE journal voucher per school (`is_opening`). Each head's amount
 * is a line on its natural side (assets debit; liabilities/equity credit); the Opening Balance
 * Equity head takes the difference so the voucher always balances.
 */
@Injectable()
export class OpeningBalanceService {
  /** The school's opening voucher with its lines, or null. */
  find(db: Pick<Prisma.TransactionClient, 'acc_vouchers'>, schoolId: number) {
    return db.acc_vouchers.findFirst({
      where: { school_id: schoolId, is_opening: true },
      select: {
        id: true,
        date: true,
        lines: { select: { head_id: true, debit: true, credit: true } },
      },
    });
  }

  /** Amount a line holds on the head's natural side (negative = opposite side). */
  static amountOf(type: AccHeadType, line: { debit: unknown; credit: unknown }) {
    const net = (cents(line.debit) - cents(line.credit)) / 100;
    return DEBIT_TYPES.includes(type) ? net : -net;
  }

  /** Set (or with 0, clear) one head's opening balance, then re-balance the voucher. */
  async set(
    tx: Prisma.TransactionClient,
    schoolId: number,
    head: Head,
    amount: number,
    date?: string | null,
  ) {
    const voucher = await this.find(tx, schoolId);
    if (!voucher && cents(amount) === 0) return;
    const equityId = await equityHeadId(tx, schoolId, OPENING_EQUITY_NAME);
    // a brand-new voucher lands on `date`, or 1 Jan of this year
    const when = date ?? (voucher ? null : `${new Date().getFullYear()}-01-01`);
    await assertYearOpen(tx, schoolId, voucher?.date, when);
    if (head.id === equityId) {
      throw new BadRequestException(`${OPENING_EQUITY_NAME} is calculated automatically`);
    }

    const lines: Line[] = (voucher?.lines ?? [])
      .filter((l) => l.head_id !== head.id && l.head_id !== equityId)
      .map((l) => ({ head_id: l.head_id, debit: Number(l.debit), credit: Number(l.credit) }));
    if (cents(amount) !== 0) {
      const debit = DEBIT_TYPES.includes(head.type) === amount > 0;
      lines.push({
        head_id: head.id,
        debit: debit ? Math.abs(amount) : 0,
        credit: debit ? 0 : Math.abs(amount),
      });
    }

    if (lines.length === 0) {
      // last opening balance removed
      if (voucher) await tx.acc_vouchers.delete({ where: { id: voucher.id, school_id: schoolId } });
      return;
    }
    const diff = lines.reduce((t, l) => t + cents(l.debit) - cents(l.credit), 0);
    const all =
      diff === 0
        ? lines
        : [
            ...lines,
            {
              head_id: equityId,
              debit: diff < 0 ? -diff / 100 : 0,
              credit: diff > 0 ? diff / 100 : 0,
            },
          ];
    const rows = all.map((l) => ({ ...l, school_id: schoolId }));

    if (voucher) {
      await tx.acc_voucher_lines.deleteMany({
        where: { voucher_id: voucher.id, school_id: schoolId },
      });
      await tx.acc_vouchers.update({
        where: { id: voucher.id, school_id: schoolId },
        data: { ...(date && { date: new Date(date) }), lines: { create: rows } },
      });
    } else {
      await tx.acc_vouchers.create({
        data: {
          school_id: schoolId,
          type: 'journal',
          date: new Date(when!),
          narration: 'Opening balances',
          is_opening: true,
          lines: { create: rows },
        },
      });
    }
  }
}
