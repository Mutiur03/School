import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client.js';
import { OpeningBalanceService } from './opening-balance.service.js';

type Fn = (args: any) => Promise<any>;

// Fake transaction client: no DB, no tenant.
const vouchers = {
  findFirst: jest.fn<Fn>(),
  create: jest.fn<Fn>(),
  update: jest.fn<Fn>(),
  delete: jest.fn<Fn>(),
};
const heads = { findFirst: jest.fn<Fn>(), create: jest.fn<Fn>() };
const lines = { deleteMany: jest.fn<Fn>() };
const years = { findFirst: jest.fn<Fn>() };
const tx = {
  acc_vouchers: vouchers,
  acc_heads: heads,
  acc_voucher_lines: lines,
  acc_years: years,
} as unknown as Prisma.TransactionClient;

const service = new OpeningBalanceService();
const EQUITY = { id: 90, type: 'equity' };
const bank = { id: 1, type: 'asset' as const };
const loan = { id: 2, type: 'liability' as const };
const line = (head_id: number, debit: number, credit: number, school_id = 1) => ({
  head_id,
  debit,
  credit,
  school_id,
});

beforeEach(() => heads.findFirst.mockResolvedValue(EQUITY));
afterEach(() => jest.resetAllMocks());

describe('OpeningBalanceService.amountOf', () => {
  it.each([
    ['asset', '500', '0', 500],
    ['asset', '0', '30', -30],
    ['liability', '0', '200', 200],
    ['liability', '10', '0', -10],
  ] as const)('%s dr %s cr %s → %s', (type, debit, credit, expected) => {
    expect(OpeningBalanceService.amountOf(type, { debit, credit })).toBe(expected);
  });
});

describe('OpeningBalanceService.set', () => {
  it('first balance creates the voucher, balanced against Opening Balance Equity', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    await service.set(tx, 1, bank, 50000, '2026-01-01');
    expect(vouchers.create).toHaveBeenCalledWith({
      data: {
        school_id: 1,
        type: 'journal',
        date: new Date('2026-01-01'),
        narration: 'Opening balances',
        is_opening: true,
        lines: { create: [line(1, 50000, 0), line(90, 0, 50000)] },
      },
    });
  });

  it('defaults the date to 1 January of this year', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    await service.set(tx, 1, bank, 10);
    const { date } = vouchers.create.mock.calls[0][0].data;
    expect(date).toEqual(new Date(`${new Date().getFullYear()}-01-01`));
  });

  it('creates the equity head when the school has none yet', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    heads.findFirst.mockResolvedValue(null);
    heads.create.mockResolvedValue({ id: 91 });
    await service.set(tx, 1, bank, 10, '2026-01-01');
    expect(heads.create).toHaveBeenCalledWith({
      data: { school_id: 1, name: 'Opening Balance Equity', type: 'equity' },
      select: { id: true },
    });
    expect(vouchers.create.mock.calls[0][0].data.lines.create).toContainEqual(line(91, 0, 10));
  });

  it('another head adds to the existing voucher and re-balances the equity line', async () => {
    vouchers.findFirst.mockResolvedValue({
      id: 7,
      date: new Date('2026-01-01'),
      lines: [
        { head_id: 1, debit: '50000', credit: '0' },
        { head_id: 90, debit: '0', credit: '50000' },
      ],
    });
    await service.set(tx, 1, loan, 20000);
    expect(lines.deleteMany).toHaveBeenCalledWith({ where: { voucher_id: 7, school_id: 1 } });
    expect(vouchers.update).toHaveBeenCalledWith({
      where: { id: 7, school_id: 1 },
      data: { lines: { create: [line(1, 50000, 0), line(2, 0, 20000), line(90, 0, 30000)] } },
    });
  });

  it('changing a head replaces its own line, not a duplicate', async () => {
    vouchers.findFirst.mockResolvedValue({
      id: 7,
      date: new Date('2026-01-01'),
      lines: [
        { head_id: 1, debit: '50000', credit: '0' },
        { head_id: 90, debit: '0', credit: '50000' },
      ],
    });
    await service.set(tx, 1, bank, 60000, '2026-02-01');
    expect(vouchers.update).toHaveBeenCalledWith({
      where: { id: 7, school_id: 1 },
      data: {
        date: new Date('2026-02-01'),
        lines: { create: [line(1, 60000, 0), line(90, 0, 60000)] },
      },
    });
  });

  it('a negative amount goes on the opposite side', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    await service.set(tx, 1, bank, -300, '2026-01-01');
    expect(vouchers.create.mock.calls[0][0].data.lines.create).toEqual([
      line(1, 0, 300),
      line(90, 300, 0),
    ]);
  });

  it('balanced inputs need no equity line', async () => {
    vouchers.findFirst.mockResolvedValue({
      id: 7,
      date: new Date('2026-01-01'),
      lines: [
        { head_id: 1, debit: '100', credit: '0' },
        { head_id: 90, debit: '0', credit: '100' },
      ],
    });
    await service.set(tx, 1, loan, 100);
    expect(vouchers.update.mock.calls[0][0].data.lines.create).toEqual([
      line(1, 100, 0),
      line(2, 0, 100),
    ]);
  });

  it('0 with no opening voucher does nothing, not even creating the equity head', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    await service.set(tx, 1, bank, 0);
    expect(heads.findFirst).not.toHaveBeenCalled();
    expect(vouchers.create).not.toHaveBeenCalled();
  });

  it('clearing the last balance deletes the voucher', async () => {
    vouchers.findFirst.mockResolvedValue({
      id: 7,
      date: new Date('2026-01-01'),
      lines: [
        { head_id: 1, debit: '50000', credit: '0' },
        { head_id: 90, debit: '0', credit: '50000' },
      ],
    });
    await service.set(tx, 1, bank, 0);
    expect(vouchers.delete).toHaveBeenCalledWith({ where: { id: 7, school_id: 1 } });
    expect(vouchers.update).not.toHaveBeenCalled();
  });

  it('a closed year refuses changes', async () => {
    vouchers.findFirst.mockResolvedValue({
      id: 7,
      date: new Date('2026-01-01'),
      lines: [{ head_id: 1, debit: '5', credit: '0' }],
    });
    years.findFirst.mockResolvedValue({ year: 2026 });
    await expect(service.set(tx, 1, bank, 9)).rejects.toThrow('Year 2026 is closed');
    expect(vouchers.update).not.toHaveBeenCalled();
  });

  it('the equity head itself cannot take a balance', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    await expect(service.set(tx, 1, { id: 90, type: 'equity' }, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(vouchers.create).not.toHaveBeenCalled();
  });

  it('a same-named non-equity head is refused', async () => {
    vouchers.findFirst.mockResolvedValue(null);
    heads.findFirst.mockResolvedValue({ id: 5, type: 'asset' });
    await expect(service.set(tx, 1, bank, 5)).rejects.toThrow('not an equity head');
  });
});
