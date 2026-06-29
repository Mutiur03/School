import { Request, Response } from "express";
import { CitizenCharterService } from "./citizen-charter.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

const service = new CitizenCharterService();

export const getPresignedUrlController = asyncHandler(
  async (req: Request, res: Response) => {
    const { filename, contentType } = req.query;

    if (typeof filename !== "string" || typeof contentType !== "string") {
      throw new ApiError(400, "filename and contentType are required");
    }

    const result = await service.getPresignedUploadUrl(filename, contentType);

    return res
      .status(200)
      .json(
        new ApiResponse(200, result, "Presigned URL generated successfully"),
      );
  },
);

export const upsertCitizenCharterController = asyncHandler(
  async (req: Request, res: Response) => {
    const { key } = req.body;

    if (!key || typeof key !== "string") {
      throw new ApiError(400, "key is required");
    }

    const result = await service.upsertCharter(key, req.schoolId);

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Document uploaded successfully"));
  },
);

export const getCitizenCharterController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getCharter(req.schoolId);
    return res.status(200).json(result);
  },
);
