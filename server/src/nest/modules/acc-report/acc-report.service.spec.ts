import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { AccReportService } from './acc-report.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const groupBy = jest.fn<Fn>();
const aggregate = jest.fn<Fn>();
const linesFindMany = jest.fn<Fn>();
const headsFindMany = jest.fn<Fn>();
const headsFindFirst = jest.fn<Fn>();
const centersFindMany = jest.fn<Fn>();
const prisma = {
  acc_voucher_lines: { groupBy, aggregate, findMany: linesFindMany },
  acc_heads: { findMany: headsFindMany, findFirst: headsFindFirst },
  acc_cost_centers: { findMany: centersFindMany },
} as unknown as PrismaClient;
const service = new AccReportService(prisma);

const D = (n: number) => new Prisma.Decimal(n);
const sums = (debit: number, credit: number) => ({ debit: D(debit), credit: D(credit) });

// Balanced books: opening JV Dr Cash 1000 / Cr Capital 1000,
// RV Dr Cash 500 / Cr Tuition 500, PV Dr Salary 200 / Cr Cash 200.
const heads = [
  { id: 1, code: 'A1', name: 'Cash', type: 'asset', parent_id: null },
  { id: 2, code: 'E1', name: 'Capital', type: 'equity', parent_id: null },
  { id: 3, code: 'I1', name: 'Tuition', type: 'income', parent_id: null },
  { id: 4, code: 'X1', name: 'Salary', type: 'expense', parent_id: null },
  { id: 5, code: 'L1', name: 'Unused loan', type: 'liability', parent_id: null },
];
const groups = [
  { head_id: 1, _sum: sums(1500, 200) },
  { head_id: 2, _sum: sums(0, 1000) },
  { head_id: 3, _sum: sums(0, 500) },
  { head_id: 4, _sum: sums(200, 0) },
  { head_id: 5, _sum: sums(50, 50) }, // zero net → omitted
];

afterEach(() => jest.resetAllMocks());

const mockBooks = () => {
  groupBy.mockResolvedValue(groups);
  headsFindMany.mockResolvedValue(heads);
};

describe('date range', () => {
  it('groups by head with school_id and date filter', async () => {
    mockBooks();
    await service.trialBalance(1, { from: '2026-01-01', to: '2026-12-31' });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['head_id'],
      where: {
        school_id: 1,
        voucher: { date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') } },
      },
      _sum: { debit: true, credit: true },
    });
    expect(headsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1 } }),
    );
  });

  it('from after to → 400, no query', async () => {
    await expect(
      service.incomeExpense(1, { from: '2026-05-01', to: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(groupBy).not.toHaveBeenCalled();
  });
});

describe('AccReportService.trialBalance', () => {
  it('totals balance, zero heads omitted, sorted by type', async () => {
    mockBooks();
    const tb = await service.trialBalance(1, {});
    expect(tb.rows.map((r) => [r.name, r.debit, r.credit])).toEqual([
      ['Cash', 1300, 0],
      ['Capital', 0, 1000],
      ['Tuition', 0, 500],
      ['Salary', 200, 0],
    ]);
    expect(tb.total_debit).toBe(1500);
    expect(tb.total_credit).toBe(1500);
  });
});

describe('AccReportService.incomeExpense', () => {
  it('income credit-debit, expense debit-credit, net', async () => {
    mockBooks();
    const r = await service.incomeExpense(1, {});
    expect(r.income).toEqual([{ head_id: 3, name: 'Tuition', parent_id: null, amount: 500 }]);
    expect(r.expense).toEqual([{ head_id: 4, name: 'Salary', parent_id: null, amount: 200 }]);
    expect(r).toMatchObject({ total_income: 500, total_expense: 200, net: 300 });
  });
});

describe('AccReportService.balanceSheet', () => {
  it('balances: assets 1300 = equity 1000 + surplus 300; ignores from', async () => {
    mockBooks();
    const bs = await service.balanceSheet(1, { from: '2026-06-01', to: '2026-12-31' });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { school_id: 1, voucher: { date: { lte: new Date('2026-12-31') } } },
      }),
    );
    expect(bs.assets).toEqual([{ head_id: 1, name: 'Cash', parent_id: null, amount: 1300 }]);
    expect(bs.liabilities).toEqual([]);
    expect(bs.equity).toEqual([{ head_id: 2, name: 'Capital', parent_id: null, amount: 1000 }]);
    expect(bs.surplus).toBe(300);
    expect(bs.total_assets).toBe(1300);
    expect(bs.total_liabilities_equity).toBe(1300);
  });
});

describe('AccReportService.costCenter', () => {
  it('income/expense per cost center', async () => {
    groupBy.mockResolvedValue([
      { cost_center_id: 9, head_id: 3, _sum: sums(0, 500) },
      { cost_center_id: 9, head_id: 4, _sum: sums(200, 0) },
      { cost_center_id: 9, head_id: 1, _sum: sums(500, 0) }, // asset → ignored
    ]);
    headsFindMany.mockResolvedValue(heads);
    centersFindMany.mockResolvedValue([
      { id: 9, name: 'Hostel' },
      { id: 10, name: 'Unused' },
    ]);
    const r = await service.costCenter(1, { to: '2026-12-31' });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['cost_center_id', 'head_id'],
      where: {
        school_id: 1,
        cost_center_id: { not: null },
        voucher: { date: { lte: new Date('2026-12-31') } },
      },
      _sum: { debit: true, credit: true },
    });
    expect(r.rows).toEqual([
      { cost_center_id: 9, cost_center_name: 'Hostel', income: 500, expense: 200, net: 300 },
    ]);
  });
});

describe('AccReportService.ledger', () => {
  const line = (id: number, vid: number, type: string, date: string, debit: number, credit: number) => ({
    id,
    debit: D(debit),
    credit: D(credit),
    note: null,
    voucher: { id: vid, type, date: new Date(date), narration: `v${vid}` },
  });

  it('unknown / other-tenant head → 404', async () => {
    headsFindFirst.mockResolvedValue(null);
    await expect(service.ledger(1, { head_id: 99 })).rejects.toBeInstanceOf(NotFoundException);
    expect(headsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99, school_id: 1 } }),
    );
  });

  it('opening from lines before `from`, running balance, closing', async () => {
    headsFindFirst.mockResolvedValue({ id: 1, name: 'Cash', type: 'asset' });
    aggregate.mockResolvedValue({ _sum: sums(1000, 0) });
    linesFindMany.mockResolvedValue([
      line(11, 2, 'receipt', '2026-02-01', 500, 0),
      line(12, 3, 'payment', '2026-02-05', 0, 200.5),
    ]);
    const r = await service.ledger(1, { head_id: 1, from: '2026-02-01', to: '2026-02-28' });

    expect(aggregate).toHaveBeenCalledWith({
      where: { school_id: 1, head_id: 1, voucher: { date: { lt: new Date('2026-02-01') } } },
      _sum: { debit: true, credit: true },
    });
    expect(linesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          school_id: 1,
          head_id: 1,
          voucher: { date: { gte: new Date('2026-02-01'), lte: new Date('2026-02-28') } },
        },
        orderBy: [{ voucher: { date: 'asc' } }, { voucher_id: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(r.head).toEqual({ id: 1, name: 'Cash', type: 'asset' });
    expect(r.opening).toBe(1000);
    expect(r.rows).toEqual([
      {
        voucher_id: 2,
        voucher_no: 'RV-2',
        date: '2026-02-01',
        type: 'receipt',
        narration: 'v2',
        note: null,
        debit: 500,
        credit: 0,
        balance: 1500,
      },
      expect.objectContaining({ voucher_no: 'PV-3', credit: 200.5, balance: 1299.5 }),
    ]);
    expect(r.closing).toBe(1299.5);
  });

  it('no from → opening 0, no aggregate query', async () => {
    headsFindFirst.mockResolvedValue({ id: 2, name: 'Capital', type: 'equity' });
    linesFindMany.mockResolvedValue([line(1, 1, 'journal', '2026-01-01', 0, 1000)]);
    const r = await service.ledger(1, { head_id: 2 });
    expect(aggregate).not.toHaveBeenCalled();
    expect(r.opening).toBe(0);
    expect(r.rows[0]).toMatchObject({ voucher_no: 'JV-1', balance: -1000 });
    expect(r.closing).toBe(-1000);
  });
});
