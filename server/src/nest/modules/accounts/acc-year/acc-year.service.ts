import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../../common/prisma.module.js';
import { equityHeadId } from '../../../common/acc-system-head.js';

export const RETAINED_EARNINGS = 'Retained Earnings';

const cents = (x: unknown) => Math.round(Number(x ?? 0) * 100);
const range = (year: number) => ({
  gte: new Date(`${year}-01-01`),
  lte: new Date(`${year}-12-31`),
});

/**
 * Financial year = calendar year (ponytail: fixed Jan-Dec; add a school start-month setting and a
 * range helper if a Jul-Jun school appears). A closed year is a row in acc_years; closing posts one
 * journal voucher that zeroes the year's income and expenses into Retained Earnings.
 */
@Injectable()
export class AccYearService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Every year with activity (plus this year), newest first, with its result and close/reopen state. */
  async findAll(schoolId: number) {
    const [closed, span] = await Promise.all([
      this.prisma.acc_years.findMany({ where: { school_id: schoolId } }),
      this.prisma.acc_vouchers.aggregate({
        where: { school_id: schoolId, is_closing: false },
        _min: { date: true },
        _max: { date: true },
      }),
    ]);
    const thisYear = new Date().getFullYear();
    const first = span._min.date?.getUTCFullYear() ?? thisYear;
    const last = Math.max(span._max.date?.getUTCFullYear() ?? thisYear, thisYear);
    const closedAt = new Map(closed.map((c) => [c.year, c.closed_at]));
    const years = [
      ...new Set([
        ...Array.from({ length: last - first + 1 }, (_, i) => first + i),
        ...closedAt.keys(),
      ]),
    ].sort((a, b) => b - a);

    return Promise.all(
      years.map(async (year) => {
        const { income, expense } = await this.result(schoolId, year);
        const isClosed = closedAt.has(year);
        return {
          year,
          closed: isClosed,
          closed_at: closedAt.get(year) ?? null,
          income: income / 100,
          expense: expense / 100,
          net: (income - expense) / 100,
          // closing/reopening goes in order, so the UI knows which button is allowed
          can_close: !isClosed && years.every((y) => y >= year || closedAt.has(y)),
          can_reopen: isClosed && ![...closedAt.keys()].some((y) => y > year),
        };
      }),
    );
  }

  /** Close the year: post the closing voucher and freeze the year. */
  async update(schoolId: number, year: number) {
    if (year > new Date().getFullYear()) {
      throw new BadRequestException('A future year cannot be closed');
    }
    return rlsTransaction(async (tx) => {
      const closed = await tx.acc_years.findMany({
        where: { school_id: schoolId },
        select: { year: true },
      });
      const done = new Set(closed.map((c) => c.year));
      if (done.has(year)) throw new BadRequestException(`Year ${year} is already closed`);
      const span = await tx.acc_vouchers.aggregate({
        where: { school_id: schoolId, is_closing: false },
        _min: { date: true },
      });
      for (let y = span._min.date?.getUTCFullYear() ?? year; y < year; y++) {
        if (!done.has(y)) throw new BadRequestException(`Close ${y} first`);
      }

      const groups = await tx.acc_voucher_lines.groupBy({
        by: ['head_id'],
        where: {
          school_id: schoolId,
          head: { type: { in: ['income', 'expense'] } },
          voucher: { date: range(year), is_closing: false },
        },
        _sum: { debit: true, credit: true },
      });
      // reverse each head's net to zero it; the difference is the year's result
      const lines = groups
        .map((g) => ({ head_id: g.head_id, net: cents(g._sum.debit) - cents(g._sum.credit) }))
        .filter((g) => g.net !== 0)
        .map((g) => ({
          school_id: schoolId,
          head_id: g.head_id,
          debit: g.net < 0 ? -g.net / 100 : 0,
          credit: g.net > 0 ? g.net / 100 : 0,
        }));

      let closing_voucher_id: number | null = null;
      if (lines.length > 0) {
        const diff = lines.reduce((t, l) => t + cents(l.debit) - cents(l.credit), 0);
        const equity = await equityHeadId(tx, schoolId, RETAINED_EARNINGS);
        const voucher = await tx.acc_vouchers.create({
          data: {
            school_id: schoolId,
            type: 'journal',
            date: new Date(`${year}-12-31`),
            narration: `Year-end closing ${year}`,
            is_closing: true,
            lines: {
              create: [
                ...lines,
                {
                  school_id: schoolId,
                  head_id: equity,
                  debit: diff < 0 ? -diff / 100 : 0,
                  credit: diff > 0 ? diff / 100 : 0,
                },
              ],
            },
          },
          select: { id: true },
        });
        closing_voucher_id = voucher.id;
      }
      await tx.acc_years.create({ data: { school_id: schoolId, year, closing_voucher_id } });
      return { year, closed: true };
    });
  }

  /** Reopen the year: undo the closing voucher and unfreeze it. Latest closed year first. */
  async remove(schoolId: number, year: number) {
    await rlsTransaction(async (tx) => {
      const row = await tx.acc_years.findFirst({ where: { school_id: schoolId, year } });
      if (!row) throw new NotFoundException(`Year ${year} is not closed`);
      const later = await tx.acc_years.findFirst({
        where: { school_id: schoolId, year: { gt: year } },
        orderBy: { year: 'desc' },
        select: { year: true },
      });
      if (later) throw new BadRequestException(`Reopen ${later.year} first`);
      await tx.acc_years.delete({ where: { id: row.id, school_id: schoolId } });
      if (row.closing_voucher_id) {
        await tx.acc_vouchers.delete({
          where: { id: row.closing_voucher_id, school_id: schoolId },
        });
      }
    });
  }

  /** Income and expense of a year in paisa, closing vouchers left out. */
  private async result(schoolId: number, year: number) {
    const sum = (type: 'income' | 'expense') =>
      this.prisma.acc_voucher_lines.aggregate({
        where: {
          school_id: schoolId,
          head: { type },
          voucher: { date: range(year), is_closing: false },
        },
        _sum: { debit: true, credit: true },
      });
    const [inc, exp] = await Promise.all([sum('income'), sum('expense')]);
    return {
      income: cents(inc._sum.credit) - cents(inc._sum.debit),
      expense: cents(exp._sum.debit) - cents(exp._sum.credit),
    };
  }
}
