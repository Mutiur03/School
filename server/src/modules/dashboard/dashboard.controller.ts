import { Request, Response } from "express";
import { DashboardService } from "./dashboard.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";

export class DashboardController {
  static getAllDashboardData = asyncHandler(async (_req: Request, res: Response) => {
    const allData = await DashboardService.getDashboardData();

    res.status(200).json(
      new ApiResponse(
        200,
        allData,
        allData.announcements.length === 0 &&
          allData.events.length === 0 &&
          allData.examSchedule.length === 0
          ? "Dashboard data retrieved successfully (no announcements, events, or exams found)"
          : "All dashboard data retrieved successfully"
      )
    );
  });
}
