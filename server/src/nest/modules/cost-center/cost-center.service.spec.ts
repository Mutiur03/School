import { jest } from '@jest/globals';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { CostCenterService } from './cost-center.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const findMany = jest.fn<Fn>();
const findFirstOrThrow = jest.fn<Fn>();
const create = jest.fn<Fn>();
const update = jest.fn<Fn>();
const del = jest.fn<Fn>();
const prisma = {
  acc_cost_centers: { findMany, findFirstOrThrow, create, update, delete: del },
} as unknown as PrismaClient;
const service = new CostCenterService(prisma);

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: 'test' });

afterEach(() => jest.resetAllMocks());

describe('CostCenterService', () => {
  it('findAll filters by school_id, sorted by name', async () => {
    findMany.mockResolvedValue([]);
    await service.findAll(1);
    expect(findMany).toHaveBeenCalledWith({ where: { school_id: 1 }, orderBy: { name: 'asc' } });
  });

  it('findOne scopes by id and school_id', async () => {
    findFirstOrThrow.mockResolvedValue({ id: 5 });
    await service.findOne(1, 5);
    expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it('create sets school_id', async () => {
    create.mockResolvedValue({ id: 1 });
    await service.create(1, { name: 'Lab', code: 'L1' });
    expect(create).toHaveBeenCalledWith({ data: { name: 'Lab', code: 'L1', school_id: 1 } });
  });

  it('create P2002 bubbles up for global filter', async () => {
    create.mockRejectedValue(prismaError('P2002'));
    await expect(service.create(1, { name: 'Lab' })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('update scopes by id and school_id', async () => {
    update.mockResolvedValue({ id: 5 });
    await service.update(1, 5, { is_active: false });
    expect(update).toHaveBeenCalledWith({
      where: { id: 5, school_id: 1 },
      data: { is_active: false },
    });
  });

  it('update P2025 bubbles up for global filter', async () => {
    update.mockRejectedValue(prismaError('P2025'));
    await expect(service.update(1, 99, { name: 'X' })).rejects.toMatchObject({ code: 'P2025' });
  });

  it('remove deletes with school_id in where', async () => {
    del.mockResolvedValue(undefined);
    await service.remove(1, 5);
    expect(del).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it.each(['P2025', 'P2003'])('remove %s bubbles up for global filter', async (code) => {
    del.mockRejectedValue(prismaError(code));
    await expect(service.remove(1, 5)).rejects.toMatchObject({ code });
  });
});
