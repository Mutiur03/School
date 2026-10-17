import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { FeeHeadService } from './fee-head.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const feeHeads = {
  findMany: jest.fn<Fn>(),
  findFirstOrThrow: jest.fn<Fn>(),
  create: jest.fn<Fn>(),
  update: jest.fn<Fn>(),
  delete: jest.fn<Fn>(),
};
const accCount = jest.fn<Fn>();
const prisma = { fee_heads: feeHeads, acc_heads: { count: accCount } } as unknown as PrismaClient;
const service = new FeeHeadService(prisma);

const include = { income_head: { select: { id: true, name: true } } };

beforeEach(() => accCount.mockResolvedValue(1));
afterEach(() => jest.resetAllMocks());

describe('FeeHeadService', () => {
  it('findAll filters by school_id, ordered', async () => {
    feeHeads.findMany.mockResolvedValue([]);
    await service.findAll(1);
    expect(feeHeads.findMany).toHaveBeenCalledWith({
      where: { school_id: 1 },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include,
    });
  });

  it('findOne scopes by id and school_id', async () => {
    feeHeads.findFirstOrThrow.mockResolvedValue({ id: 5 });
    await service.findOne(1, 5);
    expect(feeHeads.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 5, school_id: 1 },
      include,
    });
  });

  it('create sets school_id after checking the income head belongs to the school', async () => {
    feeHeads.create.mockResolvedValue({ id: 1 });
    await service.create(1, { name: 'Tuition', income_head_id: 20 });
    expect(accCount).toHaveBeenCalledWith({ where: { id: 20, school_id: 1, type: 'income' } });
    expect(feeHeads.create).toHaveBeenCalledWith({
      data: { name: 'Tuition', income_head_id: 20, school_id: 1 },
      include,
    });
  });

  it('create rejects a non-income or foreign head', async () => {
    accCount.mockResolvedValue(0);
    await expect(service.create(1, { name: 'X', income_head_id: 9 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(feeHeads.create).not.toHaveBeenCalled();
  });

  it('update scopes by id and school_id, skips the head check when unchanged', async () => {
    feeHeads.update.mockResolvedValue({ id: 5 });
    await service.update(1, 5, { is_active: false });
    expect(accCount).not.toHaveBeenCalled();
    expect(feeHeads.update).toHaveBeenCalledWith({
      where: { id: 5, school_id: 1 },
      data: { is_active: false },
      include,
    });
  });

  it('update re-checks a changed income head', async () => {
    accCount.mockResolvedValue(0);
    await expect(service.update(1, 5, { income_head_id: 9 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('remove deletes with school_id in where', async () => {
    feeHeads.delete.mockResolvedValue(undefined);
    await service.remove(1, 5);
    expect(feeHeads.delete).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it.each(['P2002', 'P2003', 'P2025'])(
    'Prisma %s bubbles up for the global filter',
    async (code) => {
      feeHeads.delete.mockRejectedValue(Object.assign(new Error(code), { code }));
      await expect(service.remove(1, 5)).rejects.toMatchObject({ code });
    },
  );
});
