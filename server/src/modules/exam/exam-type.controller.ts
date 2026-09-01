import { Request, Response } from 'express';
import { ExamTypeService } from './exam-type.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class ExamTypeController {
  static listAll = asyncHandler(async (_req: Request, res: Response) => {
    const types = await ExamTypeService.listAll();
    return res.status(200).json(new ApiResponse(200, types, 'Exam types fetched successfully'));
  });

  static listAssigned = asyncHandler(async (_req: Request, res: Response) => {
    const types = await ExamTypeService.listAssigned();
    return res.status(200).json(new ApiResponse(200, types, 'Exam types fetched successfully'));
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const created = await ExamTypeService.create(req.body);
    return res.status(201).json(new ApiResponse(201, created, 'Exam type created successfully'));
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      throw new ApiError(400, 'Invalid exam type id');
    }

    const updated = await ExamTypeService.update(id, req.body);
    return res.status(200).json(new ApiResponse(200, updated, 'Exam type updated successfully'));
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      throw new ApiError(400, 'Invalid exam type id');
    }

    const deleted = await ExamTypeService.delete(id);
    return res.status(200).json(new ApiResponse(200, deleted, 'Exam type deleted successfully'));
  });

  static setSchoolTypes = asyncHandler(async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId as string, 10);
    if (Number.isNaN(schoolId)) {
      throw new ApiError(400, 'Invalid school id');
    }

    const result = await ExamTypeService.setSchoolTypes(schoolId, req.body.exam_type_ids);
    return res.status(200).json(new ApiResponse(200, result, 'School exam types updated'));
  });
}
