import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { FeeWaiverService } from './fee-waiver.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const waivers = {
  findMany: jest.fn<Fn>(),
  findFirstOrThrow: jest.fn<Fn>(),
  create: jest.fn<Fn>(),
  update: jest.fn<Fn>(),
  delete: jest.fn<Fn>(),
};
const studentsCount = jest.fn<Fn>();
const headsCount = jest.fn<Fn>();
const prisma = {
  fee_waivers: waivers,
  students: { count: studentsCount },
  fee_heads: { count: headsCount },
} as unknown as PrismaClient;
const service = new FeeWaiverService(prisma);

const stored = { id: 1, percent: false, value: { toString: () => '100' } };

beforeEach(() => {
  studentsCount.mockResolvedValue(1);
  headsCount.mockResolvedValue(1);
});
afterEach(() => jest.resetAllMocks());

describe('FeeWaiverService', () => {
  it('findAll scopes by school and the given filters', async () => {
    waivers.findMany.mockResolvedValue([]);
    await service.findAll(1, { year: 2026, student_id: 7 });
    expect(waivers.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 1, year: 2026, student_id: 7 } }),
    );
  });

  it('create sets school_id after tenant-checking student and head; value becomes a number', async () => {
    waivers.create.mockResolvedValue(stored);
    const res = await service.create(1, { student_id: 7, year: 2026, fee_head_id: 3, value: 100 });
    expect(studentsCount).toHaveBeenCalledWith({ where: { id: 7, school_id: 1 } });
    expect(headsCount).toHaveBeenCalledWith({ where: { id: 3, school_id: 1 } });
    expect(waivers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { student_id: 7, year: 2026, fee_head_id: 3, value: 100, school_id: 1 },
      }),
    );
    expect(res.value).toBe(100);
  });

  it('create without a head skips the head lookup (all waivable heads)', async () => {
    waivers.create.mockResolvedValue(stored);
    await service.create(1, { student_id: 7, year: 2026, value: 10, percent: true });
    expect(headsCount).not.toHaveBeenCalled();
  });

  it('create rejects percent over 100', async () => {
    await expect(
      service.create(1, { student_id: 7, year: 2026, percent: true, value: 101 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(waivers.create).not.toHaveBeenCalled();
  });

  it.each([
    ['student', () => studentsCount.mockResolvedValue(0)],
    ['fee head', () => headsCount.mockResolvedValue(0)],
  ])('create rejects an unknown %s', async (_n, arrange) => {
    arrange();
    await expect(
      service.create(1, { student_id: 7, year: 2026, fee_head_id: 3, value: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update validates the merged percent/value pair', async () => {
    waivers.findFirstOrThrow.mockResolvedValue({ ...stored, percent: false, value: 150 });
    await expect(service.update(1, 1, { percent: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(waivers.update).not.toHaveBeenCalled();
  });

  it('update scopes by id and school_id', async () => {
    waivers.findFirstOrThrow.mockResolvedValue(stored);
    waivers.update.mockResolvedValue(stored);
    await service.update(1, 1, { value: 50 });
    expect(waivers.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, school_id: 1 }, data: { value: 50 } }),
    );
  });

  it('remove deletes with school_id in where; P2025 bubbles up', async () => {
    waivers.delete.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }));
    await expect(service.remove(1, 9)).rejects.toMatchObject({ code: 'P2025' });
    expect(waivers.delete).toHaveBeenCalledWith({ where: { id: 9, school_id: 1 } });
  });
});
