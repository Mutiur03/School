import { prisma } from '@/config/prisma.js';
import { ApiError } from '@/utils/ApiError.js';

export class HolidayService {
  static async createHoliday(data: {
    title: string;
    start_date: string;
    end_date: string;
    description?: string;
    is_optional?: boolean;
  }) {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }

    if (startDate > endDate) {
      throw new ApiError(400, 'Start date cannot be after end date');
    }

    try {
      return await prisma.holidays.create({
        data: {
          title: data.title,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          description: data.description ?? null,
          is_optional: Boolean(data.is_optional),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ApiError(409, 'A holiday with this information already exists');
      }
      throw error;
    }
  }

  static async getHolidays() {
    return prisma.holidays.findMany({
      orderBy: { start_date: 'asc' },
    });
  }

  static async deleteHoliday(id: number) {
    return prisma.holidays.delete({ where: { id } });
  }

  static async updateHoliday(
    id: number,
    data: {
      title?: string;
      start_date?: string;
      end_date?: string;
      description?: string;
      is_optional?: boolean;
    },
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;

    if (data.start_date !== undefined) {
      const startDate = new Date(data.start_date);
      if (Number.isNaN(startDate.getTime())) {
        throw new ApiError(400, 'Invalid start_date format');
      }
      updateData.start_date = startDate.toISOString().split('T')[0];
    }

    if (data.end_date !== undefined) {
      const endDate = new Date(data.end_date);
      if (Number.isNaN(endDate.getTime())) {
        throw new ApiError(400, 'Invalid end_date format');
      }
      updateData.end_date = endDate.toISOString().split('T')[0];
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_optional !== undefined) updateData.is_optional = Boolean(data.is_optional);

    try {
      return await prisma.holidays.update({
        where: { id },
        data: updateData,
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new ApiError(404, 'Holiday not found');
      }
      throw error;
    }
  }
}
