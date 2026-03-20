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

  static getSmsStats = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const data = await SmsLogsService.getSmsStats(
      {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      },
      req.user,
    );
    res.status(200).json(data);
  });
}
