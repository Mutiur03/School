import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { RegistrationSettingsClass8Service } from "./registrationSettingsClass8.service.js";

export class RegistrationSettingsClass8Controller {
  static createOrUpdateClass8Reg = asyncHandler(async (req: Request, res: Response) => {
    const class8Reg = await RegistrationSettingsClass8Service.createOrUpdateClass8Reg(req.body);
    res.status(200).json(new ApiResponse(200, class8Reg, "Class Eight Registration updated successfully"));
  });

  static getClass8Reg = asyncHandler(async (_req: Request, res: Response) => {
    const class8Reg = await RegistrationSettingsClass8Service.getClass8Reg();
    res.status(200).json(new ApiResponse(200, class8Reg, "Class Eight Registration fetched successfully"));
  });

  static deleteClass8RegNotice = asyncHandler(async (_req: Request, res: Response) => {
    await RegistrationSettingsClass8Service.deleteClass8RegNotice();
    res.status(200).json(new ApiResponse(200, null, "Notice deleted successfully"));
  });

  static getClass8NoticeUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationSettingsClass8Service.getClass8NoticeUploadUrl(req.body);
    res.status(200).json(new ApiResponse(200, result, "Upload URL generated successfully"));
  });
}
