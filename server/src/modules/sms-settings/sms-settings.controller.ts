import { Request, Response } from "express";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { SmsSettingsService } from "./sms-settings.service.js";
import asyncHandler from "@/utils/asyncHandler.js";

export class SmsSettingsController {
  static getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await SmsSettingsService.getSettings();
    return res.status(200).json(new ApiResponse(200, settings, "SMS settings retrieved"));
  });

  static getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await SmsSettingsService.getSettings();
    const publicSettings = {
      is_active: settings.is_active,
      send_to_present: settings.send_to_present,
      send_to_absent: settings.send_to_absent,
      present_template: settings.present_template,
      absent_template: settings.absent_template,
      sms_balance: settings.sms_balance
    };
    return res.status(200).json(new ApiResponse(200, publicSettings, "Public SMS settings retrieved"));
  });

  static updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await SmsSettingsService.updateSettings(req.body);
    return res.status(200).json(new ApiResponse(200, settings, "SMS settings updated"));
  });

  static getBalance = asyncHandler(async (_req: Request, res: Response) => {
    const balance = await SmsSettingsService.getBalance();
    return res.status(200).json(new ApiResponse(200, balance, "SMS balance retrieved"));
  });

  static updateBalance = asyncHandler(async (req: Request, res: Response) => {
    const { amount } = req.body;
    const settings = await SmsSettingsService.updateBalance(amount);
    return res.status(200).json(new ApiResponse(200, settings, "SMS balance updated successfully"));
  });

  static sendTestSMS = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, message } = req.body;
    const result = await SmsSettingsService.sendTestSMS(phoneNumber, message);
    return res.status(200).json(new ApiResponse(200, result, "Test SMS sent"));
  });

  static getCalculateCount = asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.query;
    if (!text || typeof text !== "string") {
      return res.status(400).json(new ApiResponse(400, null, "Text parameter is required"));
    }
    const result = SmsSettingsService.calculateSMSCount(text);
    return res.status(200).json(new ApiResponse(200, result, "SMS count calculated"));
  });
}
