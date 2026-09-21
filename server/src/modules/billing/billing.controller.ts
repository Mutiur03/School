import { Response } from 'express';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiError } from '@/utils/ApiError.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { BillingService } from './billing.service.js';

const parseSchoolId = (raw: string | undefined) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid school id');
  return id;
};

export class BillingController {
  static getCurrentAccess = asyncHandler(async (req: any, res: Response) => {
    if (!req.schoolId) throw new ApiError(400, 'School context missing');
    const access = await BillingService.getAccessForSchool(req.schoolId);
    res.status(200).json(new ApiResponse(200, access, 'Subscription access fetched successfully'));
  });

  static getCurrent = asyncHandler(async (req: any, res: Response) => {
    if (!req.schoolId) throw new ApiError(400, 'School context missing');
    const subscription = await BillingService.getForSchool(req.schoolId);
    res
      .status(200)
      .json(new ApiResponse(200, subscription, 'Billing details fetched successfully'));
  });

  static getForSchool = asyncHandler(async (req: any, res: Response) => {
    const subscription = await BillingService.getForSchool(parseSchoolId(req.params.id));
    res
      .status(200)
      .json(new ApiResponse(200, subscription, 'Billing details fetched successfully'));
  });

  static updateForSchool = asyncHandler(async (req: any, res: Response) => {
    const subscription = await BillingService.updateForSchool(
      parseSchoolId(req.params.id),
      req.body,
    );
    res
      .status(200)
      .json(new ApiResponse(200, subscription, 'Billing details updated successfully'));
  });
}
