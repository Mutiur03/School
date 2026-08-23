import { Request, Response } from 'express';
import { PromotionService } from './promotion.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class PromotionController {
  static updatePassFailStatus = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const result = await PromotionService.updatePassFailStatus(year);

    if (result.updated === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, 'No students found for the specified year'));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result, 'Pass/Fail status updated successfully'));
  });

  static promoteStudents = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const result = await PromotionService.promoteStudents(year);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          'Promotion, merit update and roll assignment completed by group',
        ),
      );
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status, id } = req.body;

    if (!id || !status) {
      throw new ApiError(400, 'id and status are required');
    }

    await PromotionService.updateEnrollmentStatus(id, status);

    return res.status(200).json(new ApiResponse(200, null, 'Status updated successfully'));
  });
}
