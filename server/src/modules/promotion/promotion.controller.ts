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

  static getPassRules = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);
    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }
    const rules = await PromotionService.getPassRules(year);
    return res.status(200).json(new ApiResponse(200, rules, 'Pass rules fetched'));
  });

  static savePassRules = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);
    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : req.body;
    if (!Array.isArray(rules)) {
      throw new ApiError(400, 'rules array is required');
    }
    const saved = await PromotionService.savePassRules(year, rules);
    return res.status(200).json(new ApiResponse(200, saved, 'Pass rules saved'));
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

  static previewPromotion = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const preview = await PromotionService.previewPromotion(year);

    return res.status(200).json(new ApiResponse(200, preview, 'Promotion preview ready'));
  });

  static getYearStats = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const stats = await PromotionService.getYearStats(year);

    return res.status(200).json(new ApiResponse(200, stats, 'Year stats fetched'));
  });

  static previewGraduation = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const preview = await PromotionService.previewGraduation(year);

    return res.status(200).json(new ApiResponse(200, preview, 'Graduation preview ready'));
  });

  static graduateStudents = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(req.params.year as string, 10);

    if (Number.isNaN(year)) {
      throw new ApiError(400, 'Invalid year parameter');
    }

    const result = await PromotionService.graduateStudents(year);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          `Graduation complete: ${result.graduated} graduated, ${result.retained} retained in class 10`,
        ),
      );
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status, id } = req.body;

    if (!id || !status) {
      throw new ApiError(400, 'id and status are required');
    }

    const allowed = new Set(['Passed', 'Failed', 'Pending', 'Graduated']);
    if (!allowed.has(String(status))) {
      throw new ApiError(400, 'Invalid status');
    }

    await PromotionService.updateEnrollmentStatus(Number(id), String(status));

    return res.status(200).json(new ApiResponse(200, null, 'Status updated successfully'));
  });
}
