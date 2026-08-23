import { Request, Response } from 'express';
import { ExamService } from './exam.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';

export class ExamController {
  static addExam = asyncHandler(async (req: Request, res: Response) => {
    const { exams } = req.body;
    const createdExams = await ExamService.createExams(exams);

    return res.status(201).json(new ApiResponse(201, createdExams, 'Exam added successfully'));
  });

  static getExams = asyncHandler(async (_req: Request, res: Response) => {
    const exams = await ExamService.getExams();
    return res.status(200).json(new ApiResponse(200, exams, 'Exams fetched successfully'));
  });

  static updateExam = asyncHandler(async (req: Request, res: Response) => {
    const parsedExamId = parseInt(req.params.examId as string, 10);
    if (Number.isNaN(parsedExamId)) {
      throw new ApiError(400, 'Invalid exam id');
    }

    const updated = await ExamService.updateExam(parsedExamId, req.body);
    return res.status(200).json(new ApiResponse(200, updated, 'Exam updated successfully'));
  });

  static updateVisibility = asyncHandler(async (req: Request, res: Response) => {
    const parsedExamId = parseInt(req.params.examId as string, 10);
    if (Number.isNaN(parsedExamId)) {
      throw new ApiError(400, 'Invalid exam id');
    }

    const { visible } = req.body;
    const { exam, queued } = await ExamService.updateVisibility(parsedExamId, visible);

    return res.status(200).json({
      ...new ApiResponse(200, exam, `Exam visibility updated to ${visible}`),
      queued,
    });
  });

  static deleteExam = asyncHandler(async (req: Request, res: Response) => {
    const parsedExamId = parseInt(req.params.examId as string, 10);
    if (Number.isNaN(parsedExamId)) {
      throw new ApiError(400, 'Invalid exam id');
    }

    const deleted = await ExamService.deleteExam(parsedExamId);
    return res.status(200).json(new ApiResponse(200, deleted, 'Exam deleted successfully'));
  });

  static getPresignedUrl = asyncHandler(async (req: Request, res: Response) => {
    const { filename, contentType } = req.query;

    if (typeof filename !== 'string' || typeof contentType !== 'string') {
      throw new ApiError(400, 'filename and contentType are required');
    }

    const result = await ExamService.getRoutinePresignedUrl(filename, contentType);
    return res
      .status(200)
      .json(new ApiResponse(200, result, 'Presigned URL generated successfully'));
  });

  static uploadRoutinePdf = asyncHandler(async (req: Request, res: Response) => {
    const parsedExamId = parseInt(req.params.examId as string, 10);
    if (Number.isNaN(parsedExamId)) {
      throw new ApiError(400, 'Invalid exam id');
    }

    const { key } = req.body;
    if (!key) {
      throw new ApiError(400, 'key is required');
    }

    const updatedExam = await ExamService.uploadRoutinePdf(parsedExamId, key);
    return res
      .status(200)
      .json(new ApiResponse(200, updatedExam, 'PDF routine saved successfully'));
  });

  static removeRoutinePdf = asyncHandler(async (req: Request, res: Response) => {
    const parsedExamId = parseInt(req.params.examId as string, 10);
    if (Number.isNaN(parsedExamId)) {
      throw new ApiError(400, 'Invalid exam id');
    }

    const updatedExam = await ExamService.removeRoutinePdf(parsedExamId);
    return res
      .status(200)
      .json(new ApiResponse(200, updatedExam, 'PDF routine removed successfully'));
  });
}
