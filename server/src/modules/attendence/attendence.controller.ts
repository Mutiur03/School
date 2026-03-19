import asyncHandler from "@/utils/asyncHandler.js";
import { AttendenceService } from "./attendence.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import { Request, Response } from "express";

export class AttendenceController {
  static getAttendenceController = asyncHandler(async (req: Request, res: Response) => {
    const { month, year, level, section } = req.query;
    const data = await AttendenceService.getAllAttendence({
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      level: level ? parseInt(level as string) : undefined,
      section: section as string,
    });
    res.status(200).json(new ApiResponse(200, data, "Attendance records fetched successfully"));
  });

  static addAttendenceController = asyncHandler(async (req: Request, res: Response) => {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      throw new ApiError(400, "Invalid records format");
    }
    const result = await AttendenceService.addAttendence(records);
    res.status(200).json(new ApiResponse(200, result, "Attendance processed successfully"));
  });
}
