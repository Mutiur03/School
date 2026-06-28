import type { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { AdmissionService } from "./admission.service.js";

export class AdmissionController {
  static createOrUpdateAdmission = asyncHandler(
    async (req: Request, res: Response) => {
      const notice = await AdmissionService.createOrUpdateAdmission(req.body);
      res.status(200).json({
        success: true,
        message: "Settings saved",
        data: notice,
      });
    },
  );

  static getAdmission = asyncHandler(async (_req: Request, res: Response) => {
    const data = await AdmissionService.getAdmission();
    res.status(200).json(data);
  });

  static deleteAdmissionNotice = asyncHandler(
    async (_req: Request, res: Response) => {
      const updated = await AdmissionService.deleteAdmissionNotice();
      res.status(200).json({
        success: true,
        message: "Notice removed",
        data: updated,
      });
    },
  );

  static getNoticeUploadUrl = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await AdmissionService.getNoticeUploadUrl(req.body);
      res
        .status(200)
        .json(new ApiResponse(200, result, "Upload URL generated successfully"));
    },
  );
}
