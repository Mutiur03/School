import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (args?: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const structures = {
  findMany: jest.fn<Fn>(),
  deleteMany: jest.fn<Fn>(),
  createMany: jest.fn<Fn>(),
};
const headsCount = jest.fn<Fn>();
const prisma = {
  fee_structures: structures,
  fee_heads: { count: headsCount },
} as unknown as PrismaClient;

// ESM: mock before importing the service. rlsTransaction just hands the fake client to the callback.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma,
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn(prisma),
}));
const { FeeStructureService } = await import('./fee-structure.service.js');
const service = new FeeStructureService(prisma);

afterEach(() => jest.resetAllMocks());

describe('FeeStructureService.findAll', () => {
  it('filters by school, year and optional class; amounts become numbers', async () => {
    structures.findMany.mockResolvedValue([{ id: 1, class: 8, amount: { toString: () => '500' } }]);
    const rows = await service.findAll(1, { year: 2026, class: 8 });
    expect(structures.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1, year: 2026, class: 8 } }),
    );
    expect(rows[0].amount).toBe(500);
  });

  it('omits the class filter when not given', async () => {
    structures.findMany.mockResolvedValue([]);
    await service.findAll(1, { year: 2026 });
    expect(structures.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1, year: 2026 } }),
    );
  });
});

describe('FeeStructureService.update', () => {
  const dto = {
    year: 2026,
    class: 8,
    items: [
      { fee_head_id: 1, amount: 500 },
      { fee_head_id: 2, amount: 1000 },
    ],
  };

  it('replaces the class fee list inside one transaction', async () => {
    headsCount.mockResolvedValue(2);
    structures.findMany.mockResolvedValue([]);
    await service.update(1, dto);
    expect(headsCount).toHaveBeenCalledWith({ where: { id: { in: [1, 2] }, school_id: 1 } });
    expect(structures.deleteMany).toHaveBeenCalledWith({
      where: { school_id: 1, year: 2026, class: 8 },
    });
    expect(structures.createMany).toHaveBeenCalledWith({
      data: [
        { school_id: 1, year: 2026, class: 8, fee_head_id: 1, amount: 500 },
        { school_id: 1, year: 2026, class: 8, fee_head_id: 2, amount: 1000 },
      ],
    });
  });

  it('rejects duplicate heads', async () => {
    await expect(
      service.update(1, { ...dto, items: [dto.items[0], dto.items[0]] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(structures.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects heads from another school', async () => {
    headsCount.mockResolvedValue(1);
    await expect(service.update(1, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(structures.deleteMany).not.toHaveBeenCalled();
  });

  it('an empty list clears the class', async () => {
    headsCount.mockResolvedValue(0);
    structures.findMany.mockResolvedValue([]);
    await service.update(1, { ...dto, items: [] });
    expect(structures.deleteMany).toHaveBeenCalled();
  });
});

describe('FeeStructureService.create', () => {
  it('copies only classes missing in the target year', async () => {
    structures.findMany
      .mockResolvedValueOnce([
        { class: 6, fee_head_id: 1, amount: 400 },
        { class: 7, fee_head_id: 1, amount: 450 },
      ])
      .mockResolvedValueOnce([{ class: 6 }]);
    const res = await service.create(1, { from_year: 2026, to_year: 2027 });
    expect(res).toEqual({ copied: 1 });
    expect(structures.createMany).toHaveBeenCalledWith({
      data: [{ school_id: 1, year: 2027, class: 7, fee_head_id: 1, amount: 450 }],
    });
  });

  it('does not write when nothing is left to copy', async () => {
    structures.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await service.create(1, { from_year: 2026, to_year: 2027 })).toEqual({ copied: 0 });
    expect(structures.createMany).not.toHaveBeenCalled();
  });

  it('rejects same-year copy', async () => {
    await expect(service.create(1, { from_year: 2026, to_year: 2026 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
