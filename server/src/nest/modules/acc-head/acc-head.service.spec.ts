import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { AccHeadService } from './acc-head.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const findMany = jest.fn<Fn>();
const findFirst = jest.fn<Fn>();
const findFirstOrThrow = jest.fn<Fn>();
const create = jest.fn<Fn>();
const update = jest.fn<Fn>();
const del = jest.fn<Fn>();
const prisma = {
  acc_heads: { findMany, findFirst, findFirstOrThrow, create, update, delete: del },
} as unknown as PrismaClient;
const service = new AccHeadService(prisma);

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: 'test' });

afterEach(() => jest.resetAllMocks());

describe('AccHeadService.findAll', () => {
  it('filters by school_id, sorted by type then name', async () => {
    findMany.mockResolvedValue([]);
    await service.findAll(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { school_id: 1 },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });
});

describe('AccHeadService.findOne', () => {
  it('scopes by id and school_id', async () => {
    findFirstOrThrow.mockResolvedValue({ id: 5 });
    await service.findOne(1, 5);
    expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it('P2025 bubbles up for global filter', async () => {
    findFirstOrThrow.mockRejectedValue(prismaError('P2025'));
    await expect(service.findOne(1, 99)).rejects.toMatchObject({ code: 'P2025' });
  });
});

describe('AccHeadService.create', () => {
  it('inserts with school_id, no parent lookup without parent_id', async () => {
    create.mockResolvedValue({ id: 1 });
    await service.create(1, { name: 'Cash', type: 'asset', is_cash_bank: true });
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: { name: 'Cash', type: 'asset', is_cash_bank: true, school_id: 1 },
    });
  });

  it('looks up parent within the same school', async () => {
    findFirst.mockResolvedValue({ id: 3, type: 'expense' });
    create.mockResolvedValue({ id: 4 });
    await service.create(1, { name: 'Electricity', type: 'expense', parent_id: 3 });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 3, school_id: 1 } });
    expect(create).toHaveBeenCalledWith({
      data: { name: 'Electricity', type: 'expense', parent_id: 3, school_id: 1 },
    });
  });

  it.each([
    ['cash/bank on non-asset', { name: 'X', type: 'income' as const, is_cash_bank: true }, null],
    ['parent missing / other school', { name: 'X', type: 'expense' as const, parent_id: 3 }, null],
    [
      'parent of different type',
      { name: 'X', type: 'expense' as const, parent_id: 3 },
      { id: 3, type: 'income' },
    ],
  ])('%s → 400, no insert', async (_name, dto, parent) => {
    findFirst.mockResolvedValue(parent);
    await expect(service.create(1, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('P2002 bubbles up for global filter', async () => {
    create.mockRejectedValue(prismaError('P2002'));
    await expect(service.create(1, { name: 'Cash', type: 'asset' })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

describe('AccHeadService.update', () => {
  const current = { id: 5, type: 'expense', parent_id: null, is_cash_bank: false };

  it('name-only update skips validation', async () => {
    update.mockResolvedValue({ id: 5 });
    await service.update(1, 5, { name: 'New' });
    expect(findFirstOrThrow).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 5, school_id: 1 },
      data: { name: 'New' },
    });
  });

  it('parent change validated against current type', async () => {
    findFirstOrThrow.mockResolvedValue(current);
    findFirst.mockResolvedValue({ id: 3, type: 'expense' });
    update.mockResolvedValue({ id: 5 });
    await service.update(1, 5, { parent_id: 3 });
    expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 3, school_id: 1 } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 5, school_id: 1 },
      data: { parent_id: 3 },
    });
  });

  it('self as parent → 400', async () => {
    findFirstOrThrow.mockResolvedValue(current);
    await expect(service.update(1, 5, { parent_id: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('type change mismatching current parent → 400', async () => {
    findFirstOrThrow.mockResolvedValue({ ...current, parent_id: 3 });
    findFirst.mockResolvedValue({ id: 3, type: 'expense' });
    await expect(service.update(1, 5, { type: 'income' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('cash/bank on current non-asset head → 400', async () => {
    findFirstOrThrow.mockResolvedValue(current);
    await expect(service.update(1, 5, { is_cash_bank: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('missing head (P2025) bubbles up', async () => {
    findFirstOrThrow.mockRejectedValue(prismaError('P2025'));
    await expect(service.update(1, 99, { type: 'asset' })).rejects.toMatchObject({
      code: 'P2025',
    });
  });
});

describe('AccHeadService.remove', () => {
  it('deletes with school_id in where', async () => {
    del.mockResolvedValue(undefined);
    await service.remove(1, 5);
    expect(del).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it.each(['P2025', 'P2003'])('%s bubbles up for global filter', async (code) => {
    del.mockRejectedValue(prismaError(code));
    await expect(service.remove(1, 5)).rejects.toMatchObject({ code });
  });
});
