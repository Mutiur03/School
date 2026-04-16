import { Request, Response } from "express";
import { NoticeService } from "./notice.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

const service = new NoticeService();

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

export const addNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const { title, key, created_at } = req.body;
    if (!title || !key) {
      throw new ApiError(400, "title and key are required");
    }

    const result = await service.createNotice(
      { title, key, created_at },
      req.schoolId,
    );
    return res
      .status(201)
      .json(new ApiResponse(201, result, "Notice added successfully"));
  },
);

export const getNoticesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit } = req.query;
    const take =
      limit !== undefined ? parseInt(limit as string, 10) : undefined;

    if (limit !== undefined && Number.isNaN(take)) {
      throw new ApiError(400, "limit must be a valid number");
    }

    const result = await service.getNotices(take, req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Notices fetched successfully"));
  },
);

export const updateNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, key, created_at } = req.body;

    const parsedId = parseInt(id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, "Invalid notice id");
    }

    const result = await service.updateNotice(
      parsedId,
      {
        title,
        key,
        created_at,
      },
      req.schoolId,
    );
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Notice updated successfully"));
  },
);

export const deleteNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const parsedId = parseInt(id as string, 10);
    if (Number.isNaN(parsedId)) {
      throw new ApiError(400, "Invalid notice id");
    }

    await service.deleteNotice(parsedId, req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Notice deleted successfully"));
  },
);
