import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateHolidayDto } from './dto/create-holiday.dto.js';
import type { UpdateHolidayDto } from './dto/update-holiday.dto.js';

const dateOnly = (value: string) => new Date(value).toISOString().split('T')[0];

@Injectable()
export class HolidayService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async createHoliday(schoolId: number, dto: CreateHolidayDto) {
    if (new Date(dto.start_date) > new Date(dto.end_date)) {
      throw new BadRequestException('Start date cannot be after end date');
    }
    return this.prisma.holidays.create({
      data: {
        school_id: schoolId,
        title: dto.title,
        start_date: dateOnly(dto.start_date),
        end_date: dateOnly(dto.end_date),
        description: dto.description ?? null,
        is_optional: dto.is_optional ?? false,
      },
    });
  }

  getHolidays(schoolId: number) {
    return this.prisma.holidays.findMany({
      where: { school_id: schoolId },
      orderBy: { start_date: 'asc' },
    });
  }

  async updateHoliday(schoolId: number, id: number, dto: UpdateHolidayDto) {
    const { start_date, end_date, ...rest } = dto;
    return this.prisma.holidays.update({
      where: { id, school_id: schoolId },
      data: {
        ...rest,
        ...(start_date && { start_date: dateOnly(start_date) }),
        ...(end_date && { end_date: dateOnly(end_date) }),
      },
    });
  }

  async deleteHoliday(schoolId: number, id: number) {
    await this.prisma.holidays.delete({ where: { id, school_id: schoolId } });
  }
}
