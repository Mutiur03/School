import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { FeeReportService } from './fee-report.service.js';

type Fn = (args?: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const receipts = { groupBy: jest.fn<Fn>(), aggregate: jest.fn<Fn>(), findMany: jest.fn<Fn>() };
const items = { groupBy: jest.fn<Fn>(), findMany: jest.fn<Fn>() };
const enrollments = { findMany: jest.fn<Fn>() };
const structures = { findMany: jest.fn<Fn>() };
const waivers = { findMany: jest.fn<Fn>() };
const feeHeads = { findMany: jest.fn<Fn>() };
const accHeads = { findMany: jest.fn<Fn>() };
const prisma = {
  fee_receipts: receipts,
  fee_receipt_items: items,
  student_enrollments: enrollments,
  fee_structures: structures,
  fee_waivers: waivers,
  fee_heads: feeHeads,
  acc_heads: accHeads,
} as unknown as PrismaClient;
const service = new FeeReportService(prisma);

const dec = (n: number) => ({ toString: () => String(n), valueOf: () => n });
afterEach(() => jest.resetAllMocks());

describe('FeeReportService.collection', () => {
  it('rejects an inverted range', async () => {
    await expect(
      service.collection(1, { from: '2026-04-02', to: '2026-04-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes every query to the school and date range, and names the groups', async () => {
    receipts.groupBy
      .mockResolvedValueOnce([
        { date: new Date('2026-03-05'), _count: 2, _sum: { total: dec(900) } },
      ])
      .mockResolvedValueOnce([{ class: 8, _count: 2, _sum: { total: dec(900) } }]);
    // first by deposit account (one receipt can land in several), then by fee head
    items.groupBy
      .mockResolvedValueOnce([
        { deposit_head_id: 10, _sum: { amount: dec(800) } },
        { deposit_head_id: 11, _sum: { amount: dec(100) } },
      ])
      .mockResolvedValueOnce([
        { fee_head_id: 1, _count: 3, _sum: { amount: dec(900), waiver: dec(100) } },
      ]);
    receipts.aggregate.mockResolvedValue({ _count: 2, _sum: { total: dec(900) } });
    feeHeads.findMany.mockResolvedValue([{ id: 1, name: 'Tuition' }]);
    accHeads.findMany.mockResolvedValue([
      { id: 10, name: 'Cash' },
      { id: 11, name: 'Bank A' },
    ]);

    const r = await service.collection(1, { from: '2026-03-01', to: '2026-03-31' });

    const date = { gte: new Date('2026-03-01T00:00:00Z'), lte: new Date('2026-03-31T00:00:00Z') };
    expect(receipts.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['date'], where: { school_id: 1, date } }),
    );
    expect(items.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['deposit_head_id'],
        where: { school_id: 1, receipt: { date } },
      }),
    );
    expect(r).toMatchObject({
      total: 900,
      count: 2,
      by_day: [{ date: '2026-03-05', count: 2, total: 900 }],
      by_class: [{ class: 8, total: 900 }],
      by_account: [
        { deposit_head_id: 10, name: 'Cash', total: 800 },
        { deposit_head_id: 11, name: 'Bank A', total: 100 },
      ],
      by_head: [{ fee_head_id: 1, name: 'Tuition', waiver: 100, total: 900 }],
    });
  });
});

describe('FeeReportService.dues', () => {
  const head = {
    fee_head_id: 1,
    amount: dec(500),
    fee_head: { name: 'Tuition', frequency: 'monthly', is_waivable: true, sort_order: 0 },
  };
  const student = (id: number, roll: number) => ({
    student_id: id,
    section: 'A',
    roll,
    student: { id, name: `S${id}`, login_id: BigInt(1000 + id) },
  });

  it('lists only students with a balance, honouring waivers, payments and upto_month', async () => {
    enrollments.findMany.mockResolvedValue([student(1, 1), student(2, 2), student(3, 3)]);
    structures.findMany.mockResolvedValue([head]);
    waivers.findMany.mockResolvedValue([
      { student_id: 2, fee_head_id: null, percent: true, value: dec(100) }, // 100% waiver → nothing due
    ]);
    items.findMany.mockResolvedValue([
      { student_id: 3, fee_head_id: 1, month: 1, amount: dec(500) },
      { student_id: 3, fee_head_id: 1, month: 2, amount: dec(500) },
    ]);

    const r = await service.dues(1, { year: 2026, class: 8, upto_month: 2 });

    expect(enrollments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1, year: 2026, class: 8 } }),
    );
    expect(r.rows).toEqual([
      expect.objectContaining({ student_id: 1, charge: 1000, paid: 0, due: 1000 }),
    ]);
    expect(r.total_due).toBe(1000);
  });

  it('filters by section when given', async () => {
    enrollments.findMany.mockResolvedValue([]);
    structures.findMany.mockResolvedValue([]);
    waivers.findMany.mockResolvedValue([]);
    items.findMany.mockResolvedValue([]);
    await service.dues(1, { year: 2026, class: 8, section: 'B' });
    expect(enrollments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1, year: 2026, class: 8, section: 'B' } }),
    );
  });
});

describe('FeeReportService.summary', () => {
  it('totals today / month / year and fills all 7 trend days', async () => {
    receipts.aggregate
      .mockResolvedValueOnce({ _sum: { total: dec(100) } })
      .mockResolvedValueOnce({ _sum: { total: dec(700) } })
      .mockResolvedValueOnce({ _sum: { total: dec(9000) } });
    receipts.groupBy.mockResolvedValue([
      { date: new Date('2026-03-05'), _sum: { total: dec(100) } },
    ]);
    receipts.findMany.mockResolvedValue([]);

    const r = await service.summary(1, '2026-03-05');

    expect(r).toMatchObject({ today: 100, month: 700, year: 9000 });
    expect(r.last_7_days).toHaveLength(7);
    expect(r.last_7_days[0].date).toBe('2026-02-27');
    expect(r.last_7_days[6]).toEqual({ date: '2026-03-05', total: 100 });
    expect(r.last_7_days[3].total).toBe(0);
  });
});
