import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { HolidayService } from './holiday.service.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const findMany = jest.fn<Fn>();
const create = jest.fn<Fn>();
const update = jest.fn<Fn>();
const del = jest.fn<Fn>();
const prisma = { holidays: { findMany, create, update, delete: del } } as unknown as PrismaClient;
const service = new HolidayService(prisma);
const dto = { title: 'Eid', start_date: '2026-03-30T10:00:00Z', end_date: '2026-04-01' };

describe('HolidayService.getHolidays', () => {
  afterEach(() => jest.resetAllMocks());

  it('filters by school_id, sorted by start_date', async () => {
    findMany.mockResolvedValue([]);
    await service.getHolidays(1);
    expect(findMany).toHaveBeenCalledWith({ where: { school_id: 1 }, orderBy: { start_date: 'asc' } });
  });
});

describe('HolidayService.createHoliday', () => {
  afterEach(() => jest.resetAllMocks());

  it('stores date-only strings and defaults', async () => {
    create.mockResolvedValue({ id: 1 });
    await service.createHoliday(1, dto);
    expect(create).toHaveBeenCalledWith({
      data: {
        school_id: 1,
        title: 'Eid',
        start_date: '2026-03-30',
        end_date: '2026-04-01',
        description: null,
        is_optional: false,
      },
    });
  });

  it('start after end → 400, no insert', async () => {
    await expect(service.createHoliday(1, { ...dto, start_date: '2026-05-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('P2002 bubbles up for global filter', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.createHoliday(1, dto)).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('HolidayService.updateHoliday', () => {
  afterEach(() => jest.resetAllMocks());

  it('strips time from dates on update', async () => {
    update.mockResolvedValue({ id: 1 });
    await service.updateHoliday(1, 1, { start_date: '2026-06-01T08:00:00Z', end_date: '2026-06-02' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 1, school_id: 1 },
      data: { start_date: '2026-06-01', end_date: '2026-06-02' },
    });
  });

  it('partial update: only title → dates not in data', async () => {
    update.mockResolvedValue({ id: 1 });
    await service.updateHoliday(1, 1, { title: 'New' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 1, school_id: 1 },
      data: { title: 'New' },
    });
  });

  it('P2025 (not found / wrong tenant) bubbles up for global filter', async () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' }),
    );
    await expect(service.updateHoliday(1, 99, { title: 'X' })).rejects.toMatchObject({ code: 'P2025' });
  });
});

describe('HolidayService.deleteHoliday', () => {
  afterEach(() => jest.resetAllMocks());

  it('deletes with school_id in where', async () => {
    del.mockResolvedValue(undefined);
    await service.deleteHoliday(1, 5);
    expect(del).toHaveBeenCalledWith({ where: { id: 5, school_id: 1 } });
  });

  it('P2025 bubbles up for global filter', async () => {
    del.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' }),
    );
    await expect(service.deleteHoliday(1, 99)).rejects.toMatchObject({ code: 'P2025' });
  });
});
