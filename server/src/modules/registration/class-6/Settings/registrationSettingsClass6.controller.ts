import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { RegistrationSettingsClass6Service } from "./registrationSettingsClass6.service.js";

export class RegistrationSettingsClass6Controller {
  static createOrUpdateClass6Reg = asyncHandler(async (req: Request, res: Response) => {
    const class6Reg = await RegistrationSettingsClass6Service.createOrUpdateClass6Reg(req.body);
    res.status(200).json(new ApiResponse(200, class6Reg, "Class Six Registration updated successfully"));
  });

  static getClass6Reg = asyncHandler(async (_req: Request, res: Response) => {
    const class6Reg = await RegistrationSettingsClass6Service.getClass6Reg();
    res.status(200).json(new ApiResponse(200, class6Reg, "Class Six Registration fetched successfully"));
  });

  static deleteClass6RegNotice = asyncHandler(async (_req: Request, res: Response) => {
    await RegistrationSettingsClass6Service.deleteClass6RegNotice();
    res.status(200).json(new ApiResponse(200, null, "Notice deleted successfully"));
  });

  static getClass6NoticeUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationSettingsClass6Service.getClass6NoticeUploadUrl(req.body);
    res.status(200).json(new ApiResponse(200, result, "Upload URL generated successfully"));
  });
}
