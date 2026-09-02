import { Request, Response } from 'express';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { SmsSettingsService } from './sms-settings.service.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { SMSService } from '@/utils/sms.service.js';

export class SmsSettingsController {
  static getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await SmsSettingsService.getSettings();
    return res.status(200).json(new ApiResponse(200, settings, 'SMS settings retrieved'));
  });

  static getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await SmsSettingsService.getSettings();
    const { estimatedSms } = await SmsSettingsService.getBalance();
    const publicSettings = {
      is_active: settings.is_active,
      send_to_present: settings.send_to_present,
      send_to_absent: settings.send_to_absent,
      present_template: settings.present_template,
      absent_template: settings.absent_template,
      sms_balance: estimatedSms,
    };
    return res
      .status(200)
      .json(new ApiResponse(200, publicSettings, 'Public SMS settings retrieved'));
  });

  static updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await SmsSettingsService.updateSettings(req.body);
    return res.status(200).json(new ApiResponse(200, settings, 'SMS settings updated'));
  });

  static getBalance = asyncHandler(async (_req: Request, res: Response) => {
    const balance = await SmsSettingsService.getBalance();
    return res.status(200).json(new ApiResponse(200, balance, 'SMS balance retrieved'));
  });

  static sendTestSMS = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, message } = req.body;
    const result = await SmsSettingsService.sendTestSms(phoneNumber, message);
    return res.status(200).json(new ApiResponse(200, result, 'Test SMS sent'));
  });

  static getCalculateCount = asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.query;
    if (!text || typeof text !== 'string') {
      return res.status(400).json(new ApiResponse(400, null, 'Text parameter is required'));
    }
    const result = SMSService.calculateSMSCount(text);
    return res.status(200).json(new ApiResponse(200, result, 'SMS count calculated'));
  });

  static getCredentials = asyncHandler(async (req: any, res: Response) => {
    const schoolId = parseInt(req.params.id);
    if (isNaN(schoolId))
      return res.status(400).json(new ApiResponse(400, null, 'Invalid school id'));
    const credentials = await SmsSettingsService.getCredentialsForSchool(schoolId);
    return res.status(200).json(new ApiResponse(200, credentials, 'SMS credentials retrieved'));
  });

  static updateCredentials = asyncHandler(async (req: any, res: Response) => {
    const schoolId = parseInt(req.params.id);
    if (isNaN(schoolId))
      return res.status(400).json(new ApiResponse(400, null, 'Invalid school id'));
    const credentials = await SmsSettingsService.updateCredentialsForSchool(schoolId, req.body);
    return res.status(200).json(new ApiResponse(200, credentials, 'SMS credentials updated'));
  });

  static getOverview = asyncHandler(async (_req: Request, res: Response) => {
    const overview = await SmsSettingsService.getOverview();
    return res.status(200).json(new ApiResponse(200, overview, 'SMS overview retrieved'));
  });

  static addBalanceForSchool = asyncHandler(async (req: any, res: Response) => {
    const schoolId = parseInt(req.params.id);
    if (isNaN(schoolId))
      return res.status(400).json(new ApiResponse(400, null, 'Invalid school id'));
    const { amount } = req.body;
    const result = await SmsSettingsService.addBalanceForSchool(schoolId, amount);
    return res.status(200).json(new ApiResponse(200, result, 'SMS balance updated successfully'));
  });
}
