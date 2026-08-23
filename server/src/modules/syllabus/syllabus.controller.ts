import { Request, Response } from 'express';
import { SyllabusService } from './syllabus.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class SyllabusController {
  static getPresignedUrl = asyncHandler(async (req: Request, res: Response) => {
    const { filename, contentType } = req.query;

    if (typeof filename !== 'string' || typeof contentType !== 'string') {
      throw new ApiError(400, 'filename and contentType are required');
    }

    const result = await SyllabusService.getPresignedUploadUrl(filename, contentType);
    return res
      .status(200)
      .json(new ApiResponse(200, result, 'Presigned URL generated successfully'));
  });

  static uploadSyllabus = asyncHandler(async (req: Request, res: Response) => {
    const { key, class: classNum, year } = req.body;

    if (!key) {
      throw new ApiError(400, 'key is required');
    }

    const result = await SyllabusService.createSyllabus(
      { key, class: parseInt(classNum, 10), year: parseInt(year, 10) },
      req.schoolId,
    );

    return res.status(201).json(new ApiResponse(201, result, 'Syllabus uploaded successfully'));
  });

  static listSyllabus = asyncHandler(async (req: Request, res: Response) => {
    const { class: classNum, year } = req.query;

    const result = await SyllabusService.listSyllabus(
      {
        class: typeof classNum === 'string' ? classNum : undefined,
        year: typeof year === 'string' ? year : undefined,
      },
      req.schoolId,
    );

    return res.status(200).json(new ApiResponse(200, result, 'Syllabuses fetched successfully'));
  });

  static deleteSyllabus = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid syllabus id');
    }

    await SyllabusService.deleteSyllabus(parsedId, req.schoolId);
    return res.status(200).json(new ApiResponse(200, null, 'Syllabus deleted successfully'));
  });

  static updateSyllabus = asyncHandler(async (req: Request, res: Response) => {
    const parsedId = parseInt(req.params.id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, 'Invalid syllabus id');
    }

    const { class: classNum, year, key } = req.body;

    const result = await SyllabusService.updateSyllabus(
      parsedId,
      {
        class: parseInt(classNum, 10),
        year: parseInt(year, 10),
        key,
      },
      req.schoolId,
    );

    return res.status(200).json(new ApiResponse(200, result, 'Syllabus updated successfully'));
  });
}
