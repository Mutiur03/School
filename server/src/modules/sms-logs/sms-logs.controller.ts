import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { SmsLogsService } from "./sms-logs.service.js";

type AuthedRequest = Request & { user?: any };

export class SmsLogsController {
  static getSmsLogs = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { status, date, page, limit } = req.query;
    const data = await SmsLogsService.getSmsLogs(
      {
        status: status as string | undefined,
        date: date as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      req.user,
    );

    res.status(200).json(data);
  });

  static retrySms = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { smsLogIds } = req.body;
    const result = await SmsLogsService.retrySms(smsLogIds);
    res.status(result.status).json(result.body);
  });

  static deleteSmsLogs = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { smsLogIds } = req.body;
    const result = await SmsLogsService.deleteSmsLogs(smsLogIds);
    res.status(result.status).json(result.body);
  });

  static getSmsUsageStats = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { days } = req.query;
    const result = await SmsLogsService.getSmsUsageStats(days ? Number(days) : 30);
    res.status(result.status).json(result.body);
  });

  static sendBulkSmsByClass = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { classNames, message } = req.body;
    const result = await SmsLogsService.sendBulkSmsByClass(classNames, message);
    res.status(200).json(result);
  });

  static getStudentCountByClasses = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const classNames = (req.query.classes as string || "").split(",").map(Number).filter(n => !isNaN(n));
    const result = await SmsLogsService.getStudentCountByClasses(classNames);
    res.status(200).json(result);
  });
}
