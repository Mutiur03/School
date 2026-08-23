import { Request, Response } from 'express';
import { HolidayService } from './holiday.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class HolidayController {
  static addHoliday = asyncHandler(async (req: Request, res: Response) => {
    const { title, start_date, end_date, description, is_optional } = req.body;

    if (!title || !start_date || !end_date) {
      throw new ApiError(400, 'title, start_date, and end_date are required');
    }

    const result = await HolidayService.createHoliday({
      title,
      start_date,
      end_date,
      description,
      is_optional,
    });

    return res.status(201).json(new ApiResponse(201, result, 'Holiday created successfully'));
  });

  static getHolidays = asyncHandler(async (_req: Request, res: Response) => {
    const result = await HolidayService.getHolidays();
    return res.status(200).json(new ApiResponse(200, result, 'Holidays fetched successfully'));
  });

  static deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid holiday ID');
    }

    await HolidayService.deleteHoliday(parsedId);
    return res.status(200).json(new ApiResponse(200, null, 'Holiday deleted successfully'));
  });

  static updateHoliday = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid holiday ID');
    }

    const { title, start_date, end_date, description, is_optional } = req.body;

    const result = await HolidayService.updateHoliday(parsedId, {
      title,
      start_date,
      end_date,
      description,
      is_optional,
    });

    return res.status(200).json(new ApiResponse(200, result, 'Holiday updated successfully'));
  });
}
