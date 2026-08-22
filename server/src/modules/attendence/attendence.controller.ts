import asyncHandler from '@/utils/asyncHandler.js';
import { AttendenceService } from './attendence.service.js';
import { AttendanceSheetService } from './attendence-sheet.service.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { ApiError } from '@/utils/ApiError.js';
import { Request, Response } from 'express';

export class AttendenceController {
  static getAttendenceController = asyncHandler(async (req: Request, res: Response) => {
    const { month, year, level, section } = req.query;
    const parseIntParam = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    const data = await AttendenceService.getAllAttendence({
      month: parseIntParam(month),
      year: parseIntParam(year),
      level: parseIntParam(level),
      section: typeof section === 'string' && section.trim() ? section.trim() : undefined,
    });
    res.status(200).json(new ApiResponse(200, data, 'Attendance records fetched successfully'));
  });

  static addAttendenceController = asyncHandler(async (req: Request, res: Response) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      throw new ApiError(400, 'Invalid records format');
    }
    const result = await AttendenceService.addAttendence(records);
    res.status(200).json(new ApiResponse(200, result, 'Attendance processed successfully'));
  });

  static saveAndSendAttendanceController = asyncHandler(async (req: Request, res: Response) => {
    const { records, date, level, section, year } = req.body;
    if (!records || !Array.isArray(records)) {
      throw new ApiError(400, 'Invalid records format');
    }
    if (!date || !level || !section || !year) {
      throw new ApiError(400, 'Missing required parameters');
    }

    const result = await AttendenceService.saveAndSendAttendanceSMS({
      records,
      date: date as string,
      level: parseInt(level as string),
      section: section as string,
      year: parseInt(year as string),
    });

    const message = result.smsError
      ? `Attendance saved, but SMS failed: ${result.smsError}`
      : 'Attendance saved and SMS process completed';

    res.status(200).json(new ApiResponse(200, result, message));
  });

  static getAttendanceStatsController = asyncHandler(async (req: Request, res: Response) => {
    const { date, level, section, year } = req.query;
    if (!date || !level || !section || !year) {
      throw new ApiError(400, 'Missing required query parameters');
    }

    const result = await AttendenceService.getAttendanceStats({
      date: date as string,
      level: parseInt(level as string),
      section: section as string,
      year: parseInt(year as string),
    });

    res
      .status(200)
      .json(new ApiResponse(200, result, 'Attendance statistics fetched successfully'));
  });

  static sendAttendanceSMSController = asyncHandler(async (req: Request, res: Response) => {
    const { date, level, section, year } = req.body;
    if (!date || !level || !section || !year) {
      throw new ApiError(400, 'Missing required parameters');
    }

    const result = await AttendenceService.sendAttendanceSMS({
      date: date as string,
      level: parseInt(level as string),
      section: section as string,
      year: parseInt(year as string),
    });

    res.status(200).json(new ApiResponse(200, result, 'Attendance SMS process completed'));
  });

  /** Download monthly attendance sheet PDF (queue or inline). Streams PDF bytes. */
  static downloadAttendanceSheetController = asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(String(req.query.year ?? ''), 10);
    const level = parseInt(String(req.query.level ?? ''), 10);
    const section = String(req.query.section ?? '').trim();

    // UI uses 0–11 month index; pass monthIndex=1. Otherwise month is 1–12.
    let month = parseInt(String(req.query.month ?? ''), 10);
    const useIndex = req.query.monthIndex === 'true' || req.query.monthIndex === '1';
    if (useIndex) {
      if (!Number.isFinite(month) || month < 0 || month > 11) {
        throw new ApiError(400, 'monthIndex requires month 0–11');
      }
      month = month + 1;
    }

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(level) || !section) {
      throw new ApiError(400, 'year, month, level, and section are required');
    }
    if (month < 1 || month > 12) {
      throw new ApiError(400, 'month must be 1–12 (or pass monthIndex=1 with 0–11)');
    }

    const inlineQ = req.query.inline;
    const inline =
      inlineQ === 'true' || inlineQ === '1'
        ? true
        : inlineQ === 'false' || inlineQ === '0'
          ? false
          : undefined;

    const { buffer, filename } = await AttendanceSheetService.serve(
      year,
      month,
      level,
      section,
      req.user,
      { inline },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  });
}
