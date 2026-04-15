import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { RegistrationSettingsClass9Service } from "./registrationSettingsClass9.service.js";

export class RegistrationSettingsClass9Controller {
  static createOrUpdateClass9Reg = asyncHandler(async (req: Request, res: Response) => {
    const class9Reg = await RegistrationSettingsClass9Service.createOrUpdateClass9Reg(req.body);
    res.status(200).json(new ApiResponse(200, class9Reg, "Class 9 Registration updated successfully"));
  });

  static getClass9Reg = asyncHandler(async (_req: Request, res: Response) => {
    const class9Reg = await RegistrationSettingsClass9Service.getClass9Reg();
    res.status(200).json(new ApiResponse(200, class9Reg, "Class 9 Registration fetched successfully"));
  });

  static deleteClass9RegNotice = asyncHandler(async (_req: Request, res: Response) => {
    await RegistrationSettingsClass9Service.deleteClass9RegNotice();
    res.status(200).json(new ApiResponse(200, null, "Notice deleted successfully"));
  });

  static getClass9NoticeUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationSettingsClass9Service.getClass9NoticeUploadUrl(req.body);
    res.status(200).json(new ApiResponse(200, result, "Upload URL generated successfully"));
  });
}
