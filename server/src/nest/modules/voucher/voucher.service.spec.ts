import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const vouchers = {
  findMany: jest.fn<Fn>(),
  findUniqueOrThrow: jest.fn<Fn>(),
  create: jest.fn<Fn>(),
  update: jest.fn<Fn>(),
  delete: jest.fn<Fn>(),
};
const headsFindMany = jest.fn<Fn>();
const costCentersCount = jest.fn<Fn>();
const linesDeleteMany = jest.fn<Fn>();
const prisma = {
  acc_vouchers: vouchers,
  acc_heads: { findMany: headsFindMany },
  acc_cost_centers: { count: costCentersCount },
  acc_voucher_lines: { deleteMany: linesDeleteMany },
} as unknown as PrismaClient;

// ESM: mock before importing the service. rlsTransaction just hands the fake client to the callback.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma,
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn(prisma),
}));
const { VoucherService } = await import('./voucher.service.js');
const service = new VoucherService(prisma);

const cash = { id: 1, is_cash_bank: true };
const rent = { id: 2, is_cash_bank: false };
const lines = [
  { head_id: 2, debit: 500.5 },
  { head_id: 1, credit: 500.5 },
];
const dto = { type: 'payment' as const, date: '2026-03-30', lines };

const row = {
  id: 7,
  type: 'payment',
  date: new Date('2026-03-30'),
  narration: null,
  reference: null,
  lines: [
    {
      id: 1,
      head_id: 2,
      head: { id: 2, name: 'Rent', type: 'expense' },
      cost_center_id: null,
      cost_center: null,
      debit: { toString: () => '500.5' },
      credit: { toString: () => '0' },
      note: null,
    },
  ],
};

const include = {
  lines: {
    orderBy: { id: 'asc' },
    include: {
      head: { select: { id: true, name: true, type: true } },
      cost_center: { select: { id: true, name: true } },
    },
  },
};

afterEach(() => jest.resetAllMocks());

describe('VoucherService.create', () => {
  it('validates heads by school and creates with school_id on voucher and lines', async () => {
    headsFindMany.mockResolvedValue([rent, cash]);
    vouchers.create.mockResolvedValue(row);

    const res = await service.create(1, { ...dto, narration: 'Rent' });

    expect(headsFindMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 1] }, school_id: 1 },
      select: { id: true, is_cash_bank: true },
    });
    expect(vouchers.create).toHaveBeenCalledWith({
      data: {
        school_id: 1,
        type: 'payment',
        date: new Date('2026-03-30'),
        narration: 'Rent',
        reference: null,
        lines: {
          create: [
            { school_id: 1, head_id: 2, cost_center_id: null, debit: 500.5, credit: 0, note: null },
            { school_id: 1, head_id: 1, cost_center_id: null, debit: 0, credit: 500.5, note: null },
          ],
        },
      },
      include,
    });
    expect(res).toMatchObject({
      id: 7,
      voucher_no: 'PV-7',
      date: '2026-03-30',
      total: 500.5,
      lines: [{ debit: 500.5, credit: 0 }],
    });
  });

  it.each([
    [
      'unbalanced',
      [
        { head_id: 2, debit: 100 },
        { head_id: 1, credit: 99.99 },
      ],
    ],
    [
      'both sides on a line',
      [
        { head_id: 2, debit: 100, credit: 100 },
        { head_id: 1, credit: 0 },
      ],
    ],
    ['empty line', [{ head_id: 2 }, { head_id: 1 }]],
  ])('%s → 400, no DB calls', async (_name, bad) => {
    await expect(service.create(1, { ...dto, lines: bad })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(headsFindMany).not.toHaveBeenCalled();
    expect(vouchers.create).not.toHaveBeenCalled();
  });

  it('balances in paisa (0.1 + 0.2 = 0.3)', async () => {
    headsFindMany.mockResolvedValue([rent, cash]);
    vouchers.create.mockResolvedValue(row);
    await service.create(1, {
      ...dto,
      lines: [
        { head_id: 2, debit: 0.1 },
        { head_id: 2, debit: 0.2 },
        { head_id: 1, credit: 0.3 },
      ],
    });
    expect(vouchers.create).toHaveBeenCalled();
  });

  it('foreign head (fewer found) → 400', async () => {
    headsFindMany.mockResolvedValue([cash]);
    await expect(service.create(1, dto)).rejects.toThrow('Unknown account head');
    expect(vouchers.create).not.toHaveBeenCalled();
  });

  it('foreign cost center → 400', async () => {
    headsFindMany.mockResolvedValue([rent, cash]);
    costCentersCount.mockResolvedValue(0);
    await expect(
      service.create(1, { ...dto, lines: [{ ...lines[0], cost_center_id: 9 }, lines[1]] }),
    ).rejects.toThrow('Unknown cost center');
    expect(costCentersCount).toHaveBeenCalledWith({ where: { id: { in: [9] }, school_id: 1 } });
  });

  it('contra with non-cash head → 400', async () => {
    headsFindMany.mockResolvedValue([rent, cash]);
    await expect(service.create(1, { ...dto, type: 'contra' })).rejects.toThrow(
      'Contra vouchers may only use cash/bank heads',
    );
  });

  it('payment with no cash head → 400', async () => {
    headsFindMany.mockResolvedValue([rent, { id: 1, is_cash_bank: false }]);
    await expect(service.create(1, dto)).rejects.toThrow('needs a cash/bank head');
  });

  it('journal without cash head is fine', async () => {
    headsFindMany.mockResolvedValue([rent, { id: 1, is_cash_bank: false }]);
    vouchers.create.mockResolvedValue({ ...row, type: 'journal' });
    await expect(service.create(1, { ...dto, type: 'journal' })).resolves.toMatchObject({
      voucher_no: 'JV-7',
    });
  });
});

describe('VoucherService.findAll', () => {
  it('only school_id when no filters', async () => {
    vouchers.findMany.mockResolvedValue([]);
    await service.findAll(1, {});
    expect(vouchers.findMany).toHaveBeenCalledWith({
      where: { school_id: 1 },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include,
    });
  });

  it('maps all filters', async () => {
    vouchers.findMany.mockResolvedValue([row]);
    const res = await service.findAll(1, {
      type: 'payment',
      from: '2026-01-01',
      to: '2026-12-31',
      head_id: 2,
      cost_center_id: 3,
    });
    expect(vouchers.findMany).toHaveBeenCalledWith({
      where: {
        school_id: 1,
        type: 'payment',
        date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
        lines: { some: { head_id: 2, cost_center_id: 3 } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include,
    });
    expect(res[0].voucher_no).toBe('PV-7');
  });
});

describe('VoucherService.findOne', () => {
  it('scopes by school_id; P2025 bubbles up', async () => {
    vouchers.findUniqueOrThrow.mockRejectedValue({ code: 'P2025' });
    await expect(service.findOne(1, 99)).rejects.toMatchObject({ code: 'P2025' });
    expect(vouchers.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 99, school_id: 1 },
      include,
    });
  });
});

describe('VoucherService.update', () => {
  it('narration only → plain update, no validation', async () => {
    vouchers.update.mockResolvedValue(row);
    await service.update(1, 7, { narration: 'x' });
    expect(headsFindMany).not.toHaveBeenCalled();
    expect(vouchers.update).toHaveBeenCalledWith({
      where: { id: 7, school_id: 1 },
      data: { narration: 'x' },
      include,
    });
  });

  it('type change validates against stored lines', async () => {
    vouchers.findUniqueOrThrow.mockResolvedValue({
      type: 'journal',
      lines: [
        { head_id: 2, cost_center_id: null, debit: '10', credit: '0' },
        { head_id: 1, cost_center_id: null, debit: '0', credit: '10' },
      ],
    });
    headsFindMany.mockResolvedValue([rent, cash]);
    await expect(service.update(1, 7, { type: 'contra' })).rejects.toThrow(
      'Contra vouchers may only use cash/bank heads',
    );
    expect(vouchers.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 7, school_id: 1 },
      include: { lines: true },
    });
    expect(vouchers.update).not.toHaveBeenCalled();
  });

  it('new lines → replaces lines inside rlsTransaction', async () => {
    vouchers.findUniqueOrThrow.mockResolvedValue({ type: 'payment', lines: [] });
    headsFindMany.mockResolvedValue([rent, cash]);
    vouchers.update.mockResolvedValue(row);
    await service.update(1, 7, { lines });
    expect(linesDeleteMany).toHaveBeenCalledWith({ where: { voucher_id: 7, school_id: 1 } });
    expect(vouchers.update).toHaveBeenCalledWith({
      where: { id: 7, school_id: 1 },
      data: {
        lines: {
          create: [
            { school_id: 1, head_id: 2, cost_center_id: null, debit: 500.5, credit: 0, note: null },
            { school_id: 1, head_id: 1, cost_center_id: null, debit: 0, credit: 500.5, note: null },
          ],
        },
      },
      include,
    });
  });

  it('unbalanced new lines → 400, nothing written', async () => {
    vouchers.findUniqueOrThrow.mockResolvedValue({ type: 'payment', lines: [] });
    await expect(
      service.update(1, 7, { lines: [lines[0], { head_id: 1, credit: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(linesDeleteMany).not.toHaveBeenCalled();
  });
});

describe('VoucherService.remove', () => {
  it('deletes with school_id in where', async () => {
    vouchers.delete.mockResolvedValue(undefined);
    await service.remove(1, 5);
    expect(vouchers.delete).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });
});
