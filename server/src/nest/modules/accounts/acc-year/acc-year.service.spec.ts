import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (args?: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const years = {
  findMany: jest.fn<Fn>(),
  findFirst: jest.fn<Fn>(),
  create: jest.fn<Fn>(),
  delete: jest.fn<Fn>(),
};
const vouchers = { aggregate: jest.fn<Fn>(), create: jest.fn<Fn>(), delete: jest.fn<Fn>() };
const lines = { groupBy: jest.fn<Fn>(), aggregate: jest.fn<Fn>() };
const heads = { findFirst: jest.fn<Fn>(), create: jest.fn<Fn>() };
const prisma = {
  acc_years: years,
  acc_vouchers: vouchers,
  acc_voucher_lines: lines,
  acc_heads: heads,
} as unknown as PrismaClient;

// ESM: mock before importing the service. rlsTransaction just hands the fake client to the callback.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma,
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn(prisma),
}));
const { AccYearService } = await import('./acc-year.service.js');
const service = new AccYearService(prisma);

const thisYear = new Date().getFullYear();
const line = (head_id: number, debit: number, credit: number) => ({
  school_id: 1,
  head_id,
  debit,
  credit,
});

beforeEach(() => {
  years.findMany.mockResolvedValue([]);
  vouchers.aggregate.mockResolvedValue({ _min: { date: new Date(`${thisYear}-02-01`) } });
  heads.findFirst.mockResolvedValue({ id: 90, type: 'equity' });
});
afterEach(() => jest.resetAllMocks());

describe('AccYearService.update (close)', () => {
  it('rejects a future year', async () => {
    await expect(service.update(1, thisYear + 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(years.create).not.toHaveBeenCalled();
  });

  it('rejects an already closed year', async () => {
    years.findMany.mockResolvedValue([{ year: thisYear }]);
    await expect(service.update(1, thisYear)).rejects.toThrow('already closed');
  });

  it('needs earlier years with activity closed first, oldest first', async () => {
    vouchers.aggregate.mockResolvedValue({ _min: { date: new Date(`${thisYear - 2}-05-01`) } });
    years.findMany.mockResolvedValue([{ year: thisYear - 2 }]);
    await expect(service.update(1, thisYear)).rejects.toThrow(`Close ${thisYear - 1} first`);
    expect(vouchers.create).not.toHaveBeenCalled();
  });

  it('reverses each income/expense head into Retained Earnings and freezes the year', async () => {
    lines.groupBy.mockResolvedValue([
      { head_id: 5, _sum: { debit: '0', credit: '1000' } }, // income: net credit
      { head_id: 6, _sum: { debit: '400', credit: '0' } }, // expense: net debit
      { head_id: 7, _sum: { debit: '50', credit: '50' } }, // nets to zero: skipped
    ]);
    vouchers.create.mockResolvedValue({ id: 33 });
    const res = await service.update(1, thisYear);

    expect(lines.groupBy).toHaveBeenCalledWith({
      by: ['head_id'],
      where: {
        school_id: 1,
        head: { type: { in: ['income', 'expense'] } },
        voucher: {
          date: { gte: new Date(`${thisYear}-01-01`), lte: new Date(`${thisYear}-12-31`) },
          is_closing: false,
        },
      },
      _sum: { debit: true, credit: true },
    });
    expect(vouchers.create).toHaveBeenCalledWith({
      data: {
        school_id: 1,
        type: 'journal',
        date: new Date(`${thisYear}-12-31`),
        narration: `Year-end closing ${thisYear}`,
        is_closing: true,
        lines: { create: [line(5, 1000, 0), line(6, 0, 400), line(90, 0, 600)] },
      },
      select: { id: true },
    });
    expect(years.create).toHaveBeenCalledWith({
      data: { school_id: 1, year: thisYear, closing_voucher_id: 33 },
    });
    expect(res).toEqual({ year: thisYear, closed: true });
  });

  it('a loss debits Retained Earnings', async () => {
    lines.groupBy.mockResolvedValue([{ head_id: 6, _sum: { debit: '400', credit: '100' } }]);
    vouchers.create.mockResolvedValue({ id: 33 });
    await service.update(1, thisYear);
    expect(vouchers.create.mock.calls[0][0].data.lines.create).toEqual([
      line(6, 0, 300),
      line(90, 300, 0),
    ]);
  });

  it('a year with nothing to close is still frozen, without a voucher', async () => {
    lines.groupBy.mockResolvedValue([]);
    await service.update(1, thisYear);
    expect(vouchers.create).not.toHaveBeenCalled();
    expect(years.create).toHaveBeenCalledWith({
      data: { school_id: 1, year: thisYear, closing_voucher_id: null },
    });
  });
});

describe('AccYearService.remove (reopen)', () => {
  it('404 when the year is not closed', async () => {
    years.findFirst.mockResolvedValue(null);
    await expect(service.remove(1, 2025)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('latest closed year first', async () => {
    years.findFirst
      .mockResolvedValueOnce({ id: 1, year: 2025, closing_voucher_id: 4 })
      .mockResolvedValueOnce({ year: 2026 });
    await expect(service.remove(1, 2025)).rejects.toThrow('Reopen 2026 first');
    expect(years.delete).not.toHaveBeenCalled();
  });

  it('deletes the year row, then its closing voucher', async () => {
    years.findFirst
      .mockResolvedValueOnce({ id: 1, year: 2025, closing_voucher_id: 4 })
      .mockResolvedValueOnce(null);
    const order: string[] = [];
    years.delete.mockImplementation(async () => void order.push('year'));
    vouchers.delete.mockImplementation(async () => void order.push('voucher'));
    await service.remove(1, 2025);
    expect(years.delete).toHaveBeenCalledWith({ where: { id: 1, school_id: 1 } });
    expect(vouchers.delete).toHaveBeenCalledWith({ where: { id: 4, school_id: 1 } });
    expect(order).toEqual(['year', 'voucher']);
  });

  it('a year closed without a voucher just drops the row', async () => {
    years.findFirst
      .mockResolvedValueOnce({ id: 1, year: 2025, closing_voucher_id: null })
      .mockResolvedValueOnce(null);
    await service.remove(1, 2025);
    expect(vouchers.delete).not.toHaveBeenCalled();
  });
});

describe('AccYearService.findAll', () => {
  it('lists years newest first with results and which button is allowed', async () => {
    vouchers.aggregate.mockResolvedValue({
      _min: { date: new Date(`${thisYear - 1}-03-01`) },
      _max: { date: new Date(`${thisYear}-03-01`) },
    });
    years.findMany.mockResolvedValue([{ year: thisYear - 1, closed_at: new Date('2027-01-02') }]);
    lines.aggregate.mockImplementation(async (a: any) =>
      a.where.head.type === 'income'
        ? { _sum: { debit: '0', credit: '900' } }
        : { _sum: { debit: '350', credit: '0' } },
    );
    const res = await service.findAll(1);
    expect(res.map((y) => [y.year, y.closed, y.can_close, y.can_reopen])).toEqual([
      [thisYear, false, true, false],
      [thisYear - 1, true, false, true],
    ]);
    expect(res[0]).toMatchObject({ income: 900, expense: 350, net: 550 });
  });

  it('an older open year blocks closing the newer one', async () => {
    vouchers.aggregate.mockResolvedValue({
      _min: { date: new Date(`${thisYear - 1}-03-01`) },
      _max: { date: new Date(`${thisYear}-03-01`) },
    });
    lines.aggregate.mockResolvedValue({ _sum: { debit: '0', credit: '0' } });
    const res = await service.findAll(1);
    expect(res.map((y) => [y.year, y.can_close])).toEqual([
      [thisYear, false],
      [thisYear - 1, true],
    ]);
  });
});
