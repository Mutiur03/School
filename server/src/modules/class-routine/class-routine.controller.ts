import { Request, Response } from 'express';
import { ClassRoutineService } from './class-routine.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class ClassRoutineController {
  static getPresignedUrl = asyncHandler(async (req: Request, res: Response) => {
    const { filename, contentType } = req.query;

    if (typeof filename !== 'string' || typeof contentType !== 'string') {
      throw new ApiError(400, 'filename and contentType are required');
    }

    const result = await ClassRoutineService.getPresignedUploadUrl(filename, contentType);
    return res
      .status(200)
      .json(new ApiResponse(200, result, 'Presigned URL generated successfully'));
  });

  static uploadPdf = asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.body;

    if (!key) {
      throw new ApiError(400, 'key is required');
    }

    const result = await ClassRoutineService.createPdf(key);
    return res
      .status(201)
      .json(new ApiResponse(201, result, 'Class routine PDF saved successfully'));
  });

  static listPdfs = asyncHandler(async (_req: Request, res: Response) => {
    const result = await ClassRoutineService.listPdfs();
    return res
      .status(200)
      .json(new ApiResponse(200, result, 'Class routine PDFs fetched successfully'));
  });

  static deletePdf = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid PDF id');
    }

    await ClassRoutineService.deletePdf(parsedId);
    return res.status(200).json(new ApiResponse(200, null, 'PDF deleted successfully'));
  });

  static updatePdf = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid PDF id');
    }

    const { key } = req.body;
    const result = await ClassRoutineService.updatePdf(parsedId, key);
    return res.status(200).json(new ApiResponse(200, result, 'PDF updated successfully'));
  });
}
